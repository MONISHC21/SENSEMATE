---
name: Offline AI Architecture
description: All AI runs in the browser — no API keys, no quotas. Engine mapping and key decisions.
---

# SenseMate Offline AI Architecture

## Feature → Engine mapping
| Feature | Library | Entry point |
|---|---|---|
| Object Detection | `@tensorflow-models/coco-ssd` + `@tensorflow/tfjs` | `src/utils/objectDetectionEngine.ts` |
| OCR | `tesseract.js` | `src/utils/ocrEngine.ts` |
| Gesture / Sign Language | `@tensorflow-models/hand-pose-detection` (tfjs runtime) | `src/utils/gestureEngine.ts` |
| Speech-to-Text | `window.SpeechRecognition` / `webkitSpeechRecognition` | inline in SpeechToText.tsx + CommunicationBridge.tsx |
| Text-to-Speech | `window.speechSynthesis` | `src/utils/speech.ts` (mode arg now ignored) |

## Key decisions

- `objectDetectionEngine.ts` runs COCO-SSD directly on the `<video>` element; returns both typed `DetectedObject[]` (position strings for UI) and raw `CocoDetection[]` (real bbox for canvas overlay).
- `gestureEngine.ts` uses `runtime: 'tfjs'` (not mediapipe CDN) so the model downloads via npm bundle. Gesture classification is rule-based finger landmark comparison — no ML classifier needed.
- `speech.ts` second `mode` parameter is kept for API compat but ignored — always uses Web Speech Synthesis.
- `GestureName` union type must match the `GestureResponse` interface in `src/types.ts`.
- `vite.config.ts` uses `allowedHosts: true as const` to satisfy Vite's type system (not just `true`).
- `CommunicationBridge.tsx` uses Web Speech Recognition (continuous=false, single-shot) for Blind User mode; MediaPipe gesture for Deaf User mode.

**Why:** Gemini API had quota limits and required a paid key. Browser-native inference is unlimited, private, and works offline after first model download.
