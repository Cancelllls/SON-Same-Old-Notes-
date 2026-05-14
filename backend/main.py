from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil
import os
import subprocess
import secrets
from pathlib import Path
from .database import SessionLocal, AudioTask

app = FastAPI()

# 1. Strict CORS Policy (Least Privilege)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://10.0.12.206:5173"], # Explicit origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"], # Restrict HTTP methods
    allow_headers=["Authorization", "Content-Type", "Accept"], # Explicit headers
)

# 2. Security Headers Middleware (OWASP Secure Headers)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Note: For audio elements, we allow media from the backend API
    response.headers["Content-Security-Policy"] = "default-src 'self'; media-src 'self' http://localhost:8000 http://127.0.0.1:8000;"
    return response

UPLOAD_DIR = Path("backend/uploads")
OUTPUT_DIR = Path("backend/outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Mount with limited access
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Security Constraints
MAX_FILE_SIZE = 15 * 1024 * 1024 # 15 MB limit to prevent DoS
ALLOWED_MIME_TYPES = {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac"}
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
        
        # 3. Secure Subprocess Execution (Array format avoids shell injection)
        subprocess.run([
            "demucs",
            "-n", "mdx_extra",
            "-o", str(OUTPUT_DIR),
            str(input_path)
        ], check=True)
        
        stem_name = input_path.stem
        result_dir = OUTPUT_DIR / "mdx_extra" / stem_name
        
        if result_dir.exists():
            files = [str(f.name) for f in result_dir.glob("*.wav")]
            update_task_status(file_id, "completed", results=files, folder=stem_name)
        else:
            update_task_status(file_id, "failed", error="Output generation failed.")
            
    except Exception as e:
        # 4. Error Masking: Log actual error internally, but don't expose stack traces to users
        print(f"[SECURITY LOG] Demucs failed for {file_id}: {str(e)}")
        update_task_status(file_id, "failed", error="Processing engine encountered an error.")

@app.post("/upload")
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 5. Input Validation: Strict MIME type checking
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported media type. Only MP3, WAV, and FLAC are allowed.")
    
    # Extract and validate extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Invalid file extension.")

    # 6. DoS Prevention: Enforce maximum file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Payload too large. Maximum file size is 15MB.")

    # 7. Path Traversal Prevention: Use secure randomized identifiers for filenames
    file_id = secrets.token_hex(16)
    secure_filename = f"{file_id}{ext}"
    file_path = UPLOAD_DIR / secure_filename
    
    # Safely save the file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Mask original filename to prevent client-side path injection issues
    safe_original_name = Path(file.filename).name
    db_task = AudioTask(file_id=file_id, filename=safe_original_name, status="queued")
    db.add(db_task)
    db.commit()
    
    background_tasks.add_task(separate_audio, file_id, file_path)
    
    return {"file_id": file_id, "status": "queued"}

@app.get("/status/{file_id}")
async def get_status(file_id: str, db: Session = Depends(get_db)):
    # 8. Strict Input Sanitization for ID parameters
    if not file_id.isalnum() or len(file_id) != 32:
         raise HTTPException(status_code=400, detail="Invalid file ID format")

    task = db.query(AudioTask).filter(AudioTask.file_id == file_id).first()
    if not task:
        return {"status": "not_found"}
    
    return {
        "status": task.status,
        "files": task.results,
        "folder": task.folder,
        "error": task.error
    }

@app.get("/history")
async def get_history(db: Session = Depends(get_db)):
    tasks = db.query(AudioTask).order_by(AudioTask.created_at.desc()).limit(10).all()
    return tasks

if __name__ == "__main__":
    import uvicorn
    # 9. Disable Server header to prevent fingerprinting
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, server_header=False)
