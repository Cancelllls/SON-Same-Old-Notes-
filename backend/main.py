from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil
import os
import subprocess
from pathlib import Path
from .database import SessionLocal, AudioTask

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("backend/uploads")
OUTPUT_DIR = Path("backend/outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Dependency to get DB session
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
        
        # Run demucs: -n mdx_extra for high quality, -o for output dir
        subprocess.run([
            "demucs",
            "-n", "mdx_extra",
            "-o", str(OUTPUT_DIR),
            str(input_path)
        ], check=True)
        
        # Determine the output folder
        stem_name = input_path.stem
        result_dir = OUTPUT_DIR / "mdx_extra" / stem_name
        
        if result_dir.exists():
            files = [str(f.name) for f in result_dir.glob("*.wav")]
            update_task_status(file_id, "completed", results=files, folder=stem_name)
        else:
            update_task_status(file_id, "failed", error="Output directory not found")
            
    except Exception as e:
        update_task_status(file_id, "failed", error=str(e))

@app.post("/upload")
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    import secrets
    file_id = secrets.token_hex(8)
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create DB entry
    db_task = AudioTask(file_id=file_id, filename=file.filename, status="queued")
    db.add(db_task)
    db.commit()
    
    background_tasks.add_task(separate_audio, file_id, file_path)
    
    return {"file_id": file_id, "status": "queued"}

@app.get("/status/{file_id}")
async def get_status(file_id: str, db: Session = Depends(get_db)):
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
