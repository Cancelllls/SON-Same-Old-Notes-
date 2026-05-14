# 🌌 StemSplitter Pro
### Professional AI-Powered Audio Source Separation

StemSplitter Pro is a high-performance, full-stack SaaS application designed for musicians, producers, and DJs. Utilizing Facebook's **Hybrid Transformer Demucs (HTDemucs)**, it provides studio-quality separation of any audio track into four distinct stems: **Vocals, Drums, Bass, and Other.**

![StemSplitter Pro](frontend/src/assets/hero.png)

---

## ✨ Key Features
- **Neural Separation Engine:** Powered by state-of-the-art AI (HTDemucs) optimized for high-fidelity extraction.
- **Premium Glassmorphism UI:** A sleek, modern interface with backdrop-blur effects and fluid animations.
- **Personal Separation Vault:** Securely store and revisit your previous separations via a JWT-authenticated history.
- **Cross-Platform:** Built for the web with **React + Vite** and ready for mobile with **Capacitor Android**.
- **Real-time Progress Monitoring:** Track the neural transformation of your audio with live status updates.
- **Instant Export:** High-quality WAV export for every generated stem.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 (TypeScript)
- **Build Tool:** Vite
- **Styling:** Vanilla CSS (Premium Glassmorphism Design System)
- **Mobile:** Capacitor (Native Android support)

### Backend
- **API Framework:** FastAPI (Python 3.12)
- **Database:** SQLite with SQLAlchemy ORM
- **Security:** JWT (JSON Web Tokens), Native `bcrypt` hashing
- **Audio Processing:** Demucs, PyTorch, Torchaudio, FFmpeg

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- FFmpeg (Required for audio processing)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   pip install torch torchaudio demucs bcrypt python-jose[cryptography]
   ```
3. Start the API server:
   ```bash
   python3 -m backend.main
   ```
   *The API will be available at `http://localhost:8000`*

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The UI will be available at `http://localhost:5173`*

---

## 🔒 Security & Optimization
- **JWT Authentication:** Secure user sessions with 7-day token expiry.
- **CORS Protection:** Configurable cross-origin resource sharing for production safety.
- **RAM-Efficient Processing:** Switched to the `htdemucs` model and CPU-explicit device mapping to ensure stability on limited-resource environments (e.g., cloud VMs).
- **Sanitized I/O:** Secure random file ID generation and path validation to prevent traversal attacks.

---

## 📱 Mobile Support
StemSplitter is mobile-ready. To build for Android:
```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
```

---

## 📄 License
Created as a professional portfolio project for AI-driven audio engineering.

---
*Built with ❤️ for the music community.*
