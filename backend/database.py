from sqlalchemy import create_engine, Column, String, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./backend/stemsplitter.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class AudioTask(Base):
    __tablename__ = "audio_tasks"

    file_id = Column(String, primary_key=True, index=True)
    filename = Column(String)
    status = Column(String) # queued, processing, completed, failed
    results = Column(JSON, nullable=True) # List of file names
    folder = Column(String, nullable=True) # Stem folder name
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)
