from sqlalchemy import create_engine, Column, String, JSON, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/stemsplitter.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tasks = relationship("AudioTask", back_populates="owner")

class AudioTask(Base):
    __tablename__ = "audio_tasks"

    file_id = Column(String, primary_key=True, index=True)
    filename = Column(String)
    status = Column(String) # queued, processing, completed, failed
    results = Column(JSON, nullable=True)
    folder = Column(String, nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    owner_id = Column(String, ForeignKey("users.id"))
    owner = relationship("User", back_populates="tasks")

# Create tables
Base.metadata.create_all(bind=engine)
