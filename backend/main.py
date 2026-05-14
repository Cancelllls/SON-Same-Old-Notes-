from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import bcrypt
from jose import JWTError, jwt
import shutil
import os
import subprocess
import secrets
import datetime
from pathlib import Path
from .database import SessionLocal, AudioTask, User

# Security Config
SECRET_KEY = secrets.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

# Relaxed CORS for debugging (Fixed for compatibility)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, # Must be False if origins is "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'; media-src 'self' http://localhost:8000 http://127.0.0.1:8000;"
    return response

UPLOAD_DIR = Path("backend/uploads")
OUTPUT_DIR = Path("backend/outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

@app.get("/")
async def root():
    return {"message": "StemSplitter API is running", "status": "healthy"}

# Helper functions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

# Core Routes
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
        # Switching to htdemucs: Faster and less RAM usage
        subprocess.run([
            "demucs", 
            "-n", "htdemucs", 
            "--device", "cpu",
            "-o", str(OUTPUT_DIR), 
            str(input_path)
        ], check=True)
        
        stem_name = input_path.stem
        # Updated to htdemucs subfolder
        result_dir = OUTPUT_DIR / "htdemucs" / stem_name
        
        if result_dir.exists():
            files = [str(f.name) for f in result_dir.glob("*.wav")]
            update_task_status(file_id, "completed", results=files, folder=stem_name)
        else:
            update_task_status(file_id, "failed", error="Output directory not found")
    except Exception as e:
        print(f"[SECURITY LOG] Demucs failed for {file_id}: {str(e)}")
        update_task_status(file_id, "failed", error="Processing engine encountered an error.")

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
    return {"status": task.status, "files": task.results, "folder": task.folder, "error": task.error}

@app.get("/history")
async def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(AudioTask).filter(AudioTask.owner_id == current_user.id).order_by(AudioTask.created_at.desc()).limit(20).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, server_header=False)
