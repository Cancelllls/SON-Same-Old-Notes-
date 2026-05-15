# --- Stage 1: Build Frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --silent
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Backend ---
FROM python:3.12-slim
WORKDIR /app

<<<<<<< HEAD
# Install system dependencies
=======
# Install system dependencies (FFmpeg is required for AI engine)
>>>>>>> 73233a251ce18d1e6a6b8aaf4c1b811c751f0aca
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
<<<<<<< HEAD

# Copy backend source code
COPY backend/ ./backend/
# Create __init__.py if it doesn't exist
RUN touch backend/__init__.py

# Copy frontend build assets
=======
# Ensure all security/AI libraries are present
RUN pip install --no-cache-dir torch torchaudio demucs pytubefix bcrypt python-jose[cryptography]

# Copy backend source code
COPY backend/ ./backend/

# Copy frontend build assets to be served by FastAPI
>>>>>>> 73233a251ce18d1e6a6b8aaf4c1b811c751f0aca
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Create storage directories
RUN mkdir -p backend/uploads backend/outputs

<<<<<<< HEAD
# Expose port (Cloud Run default)
EXPOSE 8080

# Start command (respecting PORT environment variable via main.py)
=======
# Expose port (Cloud Run/default)
EXPOSE 8000

# Start command
>>>>>>> 73233a251ce18d1e6a6b8aaf4c1b811c751f0aca
CMD ["python3", "-m", "backend.main"]
