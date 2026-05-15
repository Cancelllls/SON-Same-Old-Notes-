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

# Install system dependencies (FFmpeg is required for AI engine)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Ensure all security/AI libraries are present
RUN pip install --no-cache-dir torch torchaudio demucs pytubefix bcrypt python-jose[cryptography]

# Copy backend source code
COPY backend/ ./backend/

# Copy frontend build assets to be served by FastAPI
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Create storage directories
RUN mkdir -p backend/uploads backend/outputs

# Expose port (Cloud Run/default)
EXPOSE 8000

# Start command
CMD ["python3", "-m", "backend.main"]
