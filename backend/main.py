from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import bcrypt
import os
import shutil
import subprocess
import secrets
import datetime
import logging
from pathlib import Path
from jose import JWTError, jwt
from .database import SessionLocal, AudioTask, User

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("StemSplitter")

# Security Config
SECRET_KEY = secrets.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

app = FastAPI(title="StemSplitter Pro API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    # Content Security Policy - allowed media from self and data
    response.headers["Content-Security-Policy"] = "default-src 'self'; media-src 'self' blob: *; connect-src 'self' *; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: *;"
    return response

# Path Configuration (Cloud Run uses /tmp for writable storage)
# In production, this should be a bucket or persistent volume.
STORAGE_BASE = Path("/tmp/stemsplitter")
UPLOAD_DIR = STORAGE_BASE / "uploads"
OUTPUT_DIR = STORAGE_BASE / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

logger.info(f"Startup: Storage initialized at {STORAGE_BASE}")

# Mount static files for output stems
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Frontend Configuration
FRONTEND_DIR = Path("/app/frontend-dist")
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path("frontend-dist")

if FRONTEND_DIR.exists():
    # Mount assets folder for JS/CSS
    assets_path = FRONTEND_DIR / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")
    logger.info(f"Startup: Frontend mounted from {FRONTEND_DIR}")
else:
    logger.warning("Startup: Frontend directory not found!")

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Auth Helpers
def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

# --- API Routes ---

@app.get("/api/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.datetime.utcnow()}

@app.post("/api/register")
async def register(email: str, password: str, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = secrets.token_hex(8)
    db_user = User(id=user_id, email=email, hashed_password=get_password_hash(password))
    db.add(db_user)
    db.commit()
    return {"message": "User created successfully"}

@app.post("/api/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

# --- Task Processing ---

def separate_audio_task(file_id: str, input_path: Path):
    try:
        logger.info(f"Task {file_id}: Starting separation")
        
        db = SessionLocal()
        task = db.query(AudioTask).filter(AudioTask.file_id == file_id).first()
        if task:
            task.status = "processing"
            db.commit()
        db.close()
        
        # Run Demucs
        # Note: We use -n htdemucs for better quality/speed balance
        cmd = [
            "demucs", 
            "-n", "htdemucs", 
            "--device", "cpu",
            "-o", str(OUTPUT_DIR), 
            str(input_path)
        ]
        
        process = subprocess.run(cmd, capture_output=True, text=True)
        
        if process.returncode != 0:
            logger.error(f"Task {file_id}: Demucs failed. Error: {process.stderr}")
            raise Exception("AI Engine failure")

        stem_name = input_path.stem
        # Demucs creates folder: OUTPUT_DIR / model_name / input_filename_stem
        result_dir = OUTPUT_DIR / "htdemucs" / stem_name
        
        db = SessionLocal()
        task = db.query(AudioTask).filter(AudioTask.file_id == file_id).first()
        
        if result_dir.exists() and task:
            files = [f.name for f in result_dir.glob("*.wav")]
            if files:
                task.status = "completed"
                task.results = files
                task.folder = stem_name
                logger.info(f"Task {file_id}: Completed. Stems: {files}")
            else:
                task.status = "failed"
                task.error = "No stem files found in output"
        elif task:
            task.status = "failed"
            task.error = f"Output directory not found: {result_dir}"
            
        db.commit()
        db.close()
        
    except Exception as e:
        logger.exception(f"Task {file_id}: Exception during processing")
        db = SessionLocal()
        task = db.query(AudioTask).filter(AudioTask.file_id == file_id).first()
        if task:
            task.status = "failed"
            task.error = str(e)
            db.commit()
        db.close()

@app.post("/api/upload")
async def upload_audio(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_id = secrets.token_hex(16)
    ext = Path(file.filename).suffix.lower()
    if ext not in [".mp3", ".wav", ".flac", ".ogg"]:
        raise HTTPException(status_code=400, detail="Unsupported file format")
        
    file_path = UPLOAD_DIR / f"{file_id}{ext}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    db_task = AudioTask(
        file_id=file_id, 
        filename=file.filename, 
        status="queued", 
        owner_id=current_user.id
    )
    db.add(db_task)
    db.commit()
    
    background_tasks.add_task(separate_audio_task, file_id, file_path)
    return {"file_id": file_id, "status": "queued"}

@app.get("/api/status/{file_id}")
async def get_status(file_id: str, db: Session = Depends(get_db)):
    task = db.query(AudioTask).filter(AudioTask.file_id == file_id).first()
    if not task: return {"status": "not_found"}
    return {
        "status": task.status, 
        "results": task.results, 
        "folder": task.folder, 
        "error": task.error,
        "filename": task.filename
    }

@app.get("/api/history")
async def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(AudioTask).filter(AudioTask.owner_id == current_user.id).order_by(AudioTask.created_at.desc()).limit(20).all()

# --- Frontend Serving ---

@app.get("/")
async def serve_root():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return Response(content=index_file.read_text(), media_type="text/html")
    return {"message": "StemSplitter Pro API - Interface missing", "status": "healthy"}

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Exclude API and Outputs from SPA catch-all
    if full_path.startswith("api") or full_path.startswith("outputs") or full_path.startswith("assets"):
        raise HTTPException(status_code=404)
        
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return Response(content=index_file.read_text(), media_type="text/html")
    raise HTTPException(status_code=404)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
