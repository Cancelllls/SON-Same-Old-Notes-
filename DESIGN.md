# Design Document: StemSplitter

StemSplitter is a web application that allows users to separate audio tracks into distinct components: Vocals, Drums, Bass, and Other.

## 1. Features
- **Audio Upload:** Support for MP3 and WAV files.
- **Stem Separation:** High-quality separation using the Facebook Demucs model.
- **Real-time Progress:** Visual feedback during upload and processing.
- **Multi-track Player:** Listen to individual stems directly in the browser.
- **Downloadable Stems:** Download separated tracks individually.

## 2. Tech Stack
- **Frontend:** React (TypeScript) with Vanilla CSS (Vibrant & Block-based style).
- **Backend:** Python (FastAPI).
- **Processing Engine:** `demucs` (Facebook Research).
- **Styling:** Vanilla CSS following the "Vibrant & Block-based" design system.

## 3. UI/UX Design System
Based on the `ui-ux-pro-max` recommendations:
- **Palette:** 
  - Background: `#0F0F23` (Deep Dark)
  - Primary: `#1E1B4B` (Navy)
  - Secondary: `#4338CA` (Indigo)
  - CTA/Success: `#22C55E` (Green)
  - Text: `#F8FAFC` (Off-white)
- **Typography:**
  - Headings: `Righteous`
  - Body: `Poppins`
- **Interactions:** 
  - Bold hover effects.
  - Large sections and gaps (48px+).
  - Smooth transitions (200-300ms).

## 4. Architecture
1. **Client (React):** Manages file selection, upload, and stem playback.
2. **API (FastAPI):** Receives files, triggers processing, and manages stem storage.
3. **Engine (Demucs):** Runs the separation model on the uploaded audio.

## 5. Implementation Plan
1. **Phase 1: Project Scaffolding**
   - Initialize FastAPI backend.
   - Initialize React (Vite) frontend.
2. **Phase 2: Backend Development**
   - Implement upload endpoint.
   - Integrate Demucs for stem separation.
   - Setup static file serving for results.
3. **Phase 3: Frontend Development**
   - Implement UI based on design system.
   - Create upload component and progress tracker.
   - Create multi-track player component.
4. **Phase 4: Integration & Testing**
   - Connect frontend to backend.
   - Test with various audio files.

## 6. Constraints & Safety
- **File Size Limit:** 10MB for prototype.
- **Processing Time:** Separation can take 30-60 seconds depending on hardware.
- **Format Support:** MP3/WAV only for now.
