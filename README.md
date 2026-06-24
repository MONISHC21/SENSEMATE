# SENSEMATE — AI-POWERED ACCESSIBILITY COMPANION

> **"See. Hear. Communicate."**  
> An advanced full-stack intelligence platform designed to improve spatial awareness, independence, and cross-channel communication for Visually Impaired, Hearing-Impaired, and Speech-Impaired individuals.

---

## 🌟 PROJECT OVERVIEW
**SenseMate** acts as an intelligent assistive bridge, bridging the gap between individuals with different sensory profiles. The system features modular vision models, text extraction characters (OCR), verbal transcription, vocal neural synthesis, and gestural translation.

Developed as a highly responsive, lightweight MVP, it is engineered to run seamlessly on standard client devices (including a 4GB RAM CPU-only laptop) using standard browser Media APIs on the frontend and a robust, secure **Gemini Full-Stack API architecture** on the backend.

---

## 🛠️ ARCHITECTURE & TECH STACK

### System Flow
```text
┌────────────────────────────────────────────────────────┐
│                   GUI LAYER (React 19)                 │
│  - Spatial Grid Dashboard   - Media Capture Handlers   │
│  - Accessible Fonts/Colors  - Live Canvas Overlay      │
└───────────────────────────┬────────────────────────────┘
                            │ (POST /api/* via JSON Base64)
                            ▼
┌────────────────────────────────────────────────────────┐
│                 SERVER LAYER (Express)                 │
│  - Lazy-initialized Clients  - Base64 Frame Parser     │
│  - PCM 24kHz Audio Compiler  - Security Guards         │
└───────────────────────────┬────────────────────────────┘
                            │ (Telemetry + @google/genai)
                            ▼
┌────────────────────────────────────────────────────────┐
│                     INTELLIGENCE                       │
│  - gemini-3.5-flash        - gemini-3.1-flash-tts      │
│  - YOLOv8 Scene Analysis   - Neural Voices Playback    │
└────────────────────────────────────────────────────────┘
```

### Key Frameworks
* **Frontend UI:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Web Speech API.
* **Backend API:** Node.js, Express, tsx, dotenv, esbuild.
* **AI Engine:** `@google/genai` TypeScript SDK (including `gemini-3.5-flash` for vision/transcription and `gemini-3.1-flash-tts-preview` for premium neural speakers).

---

## 🚀 CORE FEATURE MODULES

1. **Object Detection Assistant:** Utilizes `gemini-3.5-flash` to identify critical objects (people, chairs, bottles, cell phones, laptops, backpacks, cars, buses, bicycles) with relative spatial orientation (left, center, right, near, far) and provides smart voice-guided warnings with a 5-second cooldown system.
2. **OCR Text Reader:** Scans books, transit signs, or medicine labels, extracting printed lines, calculating general confidence, and reading text aloud.
3. **Speech to Text:** Records speech directly from the user's microphone and outputs high-fidelity transcription to assist hearing-impaired users.
4. **Vocal Synthesizer (TTS):** Converts entered text into speech using a choice of local browser synthesis or premium neural voices (*Zephyr, Kore, Puck, Charon, Fenrir*) using `gemini-3.1-flash-tts-preview`.
5. **Sign Language Translator:** Translates sign gestures (*Hello, Help, Thank You, Yes, No*) in real-time.
6. **Accessibility Communication Bridge:** Creates a side-by-side conversation playground facilitating multi-modal conversations (e.g., Deaf user signing -> spoken as voice; Blind user speaking -> written as text).

---

## 📂 PROJECT STRUCTURE
```text
SenseMate/
├── server.ts                  # Full-stack Node.js server with Gemini integrations
├── package.json               # Modular script handlers and npm declarations
├── requirements.txt           # Python baseline dependency sheet for legacy compatibility
├── index.html                 # Browser SPA mount entry point
├── metadata.json              # Frame permissions and capabilities metadata
├── src/
│   ├── App.tsx                # Main Application Controller with header navigation
│   ├── main.tsx               # Client entry point
│   ├── index.css              # Custom Tailwind configuration
│   ├── types.ts               # Shared TypeScript types & tab interfaces
│   ├── utils/
│   │   └── speech.ts          # Unified Web Speech & Premium PCM audio decoding
│   └── components/
│       ├── MainDashboard.tsx  # Spatial navigation grid hub
│       ├── CameraFeed.tsx     # Reusable webcam stream controller
│       ├── ObjectDetection.tsx# Real-time YOLO-simulated warning logs
│       ├── OCRReader.tsx      # Multi-source document scanner
│       ├── SpeechToText.tsx   # Microphone recorder and transcription panel
│       ├── TextToSpeech.tsx   # Speed and pitch voice generator
│       ├── GestureTranslator.tsx # Sign sign guide & camera translator
│       ├── CommunicationBridge.tsx # Cross-channel chat bridges
│       └── AboutPage.tsx      # Academic credentials and profile cards
```

---

## 📥 INSTALLATION & RUN GUIDE

### Prerequisites
* **Node.js:** v18 or newer
* **Gemini API Key:** Accessible from the Secrets section

### Quickstart Command
1. Install project packages:
   ```bash
   npm install
   ```
2. Set up environment secrets in your `.env` or Secrets config panel:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the portal in your browser at: `http://localhost:3000`

---

## 🧭 FUTURE ROADMAP

### Phase 2 Extension
* **Smart Glasses Integration:** Directly forward video streams from wearable glasses to the detection assistant.
* **SOS Emergency Alerts:** Incorporate voice-triggered fallback coordinates using maps and SMS signals.
* **Currency & Scene Recognition:** Multi-national bank-note validation and descriptive scene summary narrated seamlessly.
* **Multi-Language Support:** Instant translation between 15 global spoken and sign profiles.

---

## 🎓 ACADEMIC CREDITS
* **Project Name:** SenseMate MVP
* **Lead Developer:** Monish Nandha Balan
* **Institution:** SRM Institute of Science and Technology
* **Department:** Electronics and Communication Engineering with Data Science
* **Academic License:** Apache-2.0
