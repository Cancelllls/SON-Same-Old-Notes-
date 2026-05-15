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
from pathlib import Path
from jose import JWTError, jwt
from .database import SessionLocal, AudioTask, User

# Security Config
SECRET_KEY = secrets.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

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
    # Note: Content-Security-Policy might need adjustment for production
    response.headers["Content-Security-Policy"] = "default-src 'self'; media-src 'self' *; connect-src 'self' *; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: *;"
    return response

UPLOAD_DIR = Path("backend/uploads")
OUTPUT_DIR = Path("backend/outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

<<<<<<< HEAD
# Mount frontend if it exists
=======
# Mount frontend if it exists (for unified docker deployment)
>>>>>>> 73233a251ce18d1e6a6b8aaf4c1b811c751f0aca
FRONTEND_DIR = Path("frontend-dist")
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

@app.get("/")
async def root():
    try:
        if FRONTEND_DIR.exists() and (FRONTEND_DIR / "index.html").exists():
            return Response(content=(FRONTEND_DIR / "index.html").read_text(), media_type="text/html")
    except Exception as e:
        print(f"Error serving index.html: {e}")
    return {"message": "StemSplitter API is running", "status": "healthy"}

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

# Auth Routes
@app.post("/register")
async def register(email: str, password: str, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = secrets.token_hex(8)
    db_user = User(id=user_id, email=email, hashed_password=get_password_hash(password))
    db.add(db_user)
    db.commit()
    return {"message": "User created successfully"}

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

# Task Management
def update_task_status(file_id: str, status: str, results=None, folder=None, error=None):
    db = SessionLocal()
    task = db.query(AudioTask).filter(AudioTask.file_id == file_id).first()
    if task:
        task.status = status
        if results: task.results = results
        if folder: task.folder = folder
        if error: task.error = error
        db.commit()
    db.close()

def separate_audio(file_id: str, input_path: Path):
    try:
        update_task_status(file_id, "processing")
        # Run Demucs
        subprocess.run([
            "demucs", 
            "-n", "htdemucs", 
            "--device", "cpu",
            "-o", str(OUTPUT_DIR), 
            str(input_path)
        ], check=True)
        
        stem_name = input_path.stem
        result_dir = OUTPUT_DIR / "htdemucs" / stem_name
        
        if result_dir.exists():
            files = [str(f.name) for f in result_dir.glob("*.wav")]
            update_task_status(file_id, "completed", results=files, folder=stem_name)
        else:
            update_task_status(file_id, "failed", error="Output directory not found")
    except Exception as e:
        print(f"Demucs failed: {str(e)}")
        update_task_status(file_id, "failed", error=str(e))

# Core Routes
@app.post("/upload")
async def upload_audio(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_id = secrets.token_hex(16)
    ext = Path(file.filename).suffix.lower()
    file_path = UPLOAD_DIR / f"{file_id}{ext}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    db_task = AudioTask(file_id=file_id, filename=file.filename, status="queued", owner_id=current_user.id)
    db.add(db_task)
    db.commit()
    
    background_tasks.add_task(separate_audio, file_id, file_path)
    return {"file_id": file_id, "status": "queued"}

@app.get("/status/{file_id}")
async def get_status(file_id: str, db: Session = Depends(get_db)):
    task = db.query(AudioTask).filter(AudioTask.file_id == file_id).first()
    if not task: return {"status": "not_found"}
    return {"status": task.status, "results": task.results, "folder": task.folder, "error": task.error}

@app.get("/history")
async def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(AudioTask).filter(AudioTask.owner_id == current_user.id).order_by(AudioTask.created_at.desc()).limit(20).all()

<<<<<<< HEAD
# SPA Catch-all
=======
# SPA Catch-all (Must be last)
>>>>>>> 73233a251ce18d1e6a6b8aaf4c1b811c751f0aca
# SPA Catch-all
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    try:
        if FRONTEND_DIR.exists() and (FRONTEND_DIR / "index.html").exists():
            return Response(content=(FRONTEND_DIR / "index.html").read_text(), media_type="text/html")
    except Exception as e:
        print(f"Error in catch-all serving index.html: {e}")
    raise HTTPException(status_code=404)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, server_header=False)
