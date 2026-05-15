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

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./backend/
RUN touch backend/__init__.py

# Copy frontend build assets
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Create storage directories
RUN mkdir -p backend/uploads backend/outputs

# Expose port (Cloud Run default)
EXPOSE 8080

# Start command
CMD ["python3", "-m", "backend.main"]
