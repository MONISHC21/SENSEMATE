/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Info, User, GraduationCap, Award, Brain, Eye, Hand, Zap, ArrowRight, Layers, Cpu } from "lucide-react";
import detectionImg from "@assets/ref_detection.png";
import signLangImg  from "@assets/ref_signlang.png";
import mediapipeImg from "@assets/ref_mediapipe.png";
import pipelineImg  from "@assets/ref_pipeline.png";
import yoloImg      from "@assets/ref_yolo.png";

const AI_STACK = [
  {
    label: "Object Detection",
    engine: "TensorFlow.js + COCO-SSD",
    desc: "MobileNetV2-based model detects 80 object classes. Runs on CPU in-browser. Each class gets a unique YOLO-style colored bounding box with confidence %.",
    color: "indigo",
    icon: Eye,
  },
  {
    label: "OCR Engine",
    engine: "Tesseract.js v5",
    desc: "In-browser OCR extracts text from printed documents, signboards, prescriptions, and menus. Outputs to speech with paragraph-level structuring.",
    color: "violet",
    icon: Layers,
  },
  {
    label: "Sign Language AI",
    engine: "MediaPipe Hands (TF.js)",
    desc: "21-landmark hand pose detector classifies ASL alphabet letters A–Y and 5 core sign language gestures. Runs entirely offline — no cloud needed.",
    color: "emerald",
    icon: Hand,
  },
  {
    label: "Motion Detection",
    engine: "Frame Differencing (pure JS)",
    desc: "Pixel-level frame comparison with BFS flood fill groups moving pixels into bounding boxes. Voice alerts announce position and count of detected motion regions.",
    color: "amber",
    icon: Zap,
  },
  {
    label: "Speech Synthesis",
    engine: "Web Speech API",
    desc: "Browser-native TTS with voice, rate, and pitch controls. Works on Chrome, Edge, Safari, and Android WebView with no quota or API key.",
    color: "rose",
    icon: Cpu,
  },
  {
    label: "Speech Recognition",
    engine: "Web Speech Recognition API",
    desc: "Browser-native STT via SpeechRecognition for Chrome/Edge. Transcribes continuous speech in real-time. Requires full-tab access (not available in iframes).",
    color: "cyan",
    icon: Brain,
  },
];

const PIPELINE_STEPS = [
  "Camera Input",
  "Frame Capture",
  "AI Inference",
  "Post-processing",
  "Voice Output",
];

export default function AboutPage() {
  return (
    <div id="about-page-container" className="flex flex-col gap-8 leading-relaxed">

      {/* ── Developer Profile + Summary Row ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col gap-5 shadow-xl text-center items-center h-full">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <User className="h-12 w-12" />
              </div>
              <span className="absolute bottom-0 right-0 h-4 w-4 bg-emerald-500 rounded-full border-2 border-slate-900" />
            </div>
            <div>
              <span className="font-sans text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Lead Developer & Researcher</span>
              <h3 className="font-sans font-bold text-xl text-slate-100 mt-1">Monish Nandha Balan</h3>
              <p className="font-sans text-xs text-slate-400 mt-1.5 leading-relaxed">
                Passionate engineer specializing in AI-driven Assistive Technology, Computer Vision, and Human-Computer Interfaces.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2.5 border-t border-slate-800/80 pt-4 text-left font-sans text-xs">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-850">
                <GraduationCap className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Institution</span>
                  <span className="text-slate-400 text-[11px] mt-0.5 block">SRM Institute of Science and Technology</span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-850">
                <Award className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Department</span>
                  <span className="text-slate-400 text-[11px] mt-0.5 block leading-relaxed">Electronics and Communication Engineering with Data Science</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/8 border border-indigo-500/15">
                <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="text-[10px] text-indigo-200 font-medium">SenseMate v1.0 — Academic MVP Project</span>
              </div>
            </div>
          </div>
        </div>

        {/* Project summary */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col gap-4 shadow-xl h-full">
            <div className="border-b border-slate-800/85 pb-4">
              <div className="flex items-baseline gap-3">
                <h3 className="font-sans font-bold text-2xl text-slate-100">
                  <span className="text-indigo-400">SenseMate</span>
                </h3>
                <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2.5 py-1 font-mono">MVP</span>
              </div>
              <p className="font-sans text-xs text-slate-400 font-medium mt-1 italic">See. Hear. Communicate.</p>
            </div>
            <p className="font-sans text-sm text-slate-300 leading-relaxed">
              SenseMate is a 100% browser-based, offline-capable AI accessibility platform. It helps <strong className="text-slate-100">visually impaired</strong>, <strong className="text-slate-100">hearing-impaired</strong>, and <strong className="text-slate-100">speech-impaired</strong> users through real-time computer vision, gesture recognition, OCR, and speech synthesis — with zero API costs, zero cloud dependency, and zero data leaving the device.
            </p>

            {/* Inference pipeline visual */}
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-1">
                  <span className="px-2.5 py-1 bg-slate-950 border border-indigo-500/20 text-indigo-200 rounded-full text-[10px] font-mono font-semibold">{step}</span>
                  {i < PIPELINE_STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-1">
              {[
                { label: "AI Models", value: "5", sub: "All in-browser" },
                { label: "Detectable Classes", value: "80+", sub: "COCO + ASL" },
                { label: "API Keys", value: "0", sub: "Fully offline" },
              ].map(s => (
                <div key={s.label} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center">
                  <span className="font-mono text-2xl font-black text-indigo-400">{s.value}</span>
                  <p className="font-sans text-[10px] text-slate-200 font-semibold mt-0.5">{s.label}</p>
                  <p className="font-sans text-[9px] text-slate-500">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Technology Stack ──────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <h4 className="font-sans font-bold text-base text-slate-100 mb-5 flex items-center gap-2 border-b border-slate-800/80 pb-4">
          <Cpu className="h-5 w-5 text-indigo-400" />
          AI Technology Stack — How Each Module Works
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AI_STACK.map(s => {
            const Icon = s.icon;
            const colors: Record<string, string> = {
              indigo: 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400',
              violet: 'border-violet-500/20 bg-violet-500/5 text-violet-400',
              emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
              amber: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
              rose: 'border-rose-500/20 bg-rose-500/5 text-rose-400',
              cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
            };
            return (
              <div key={s.label} className={`p-4 border rounded-2xl flex flex-col gap-2 ${colors[s.color]}`}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-sans font-semibold text-xs">{s.label}</span>
                </div>
                <code className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md w-fit">{s.engine}</code>
                <p className="font-sans text-[11px] text-slate-400 leading-relaxed mt-0.5">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Reference Architecture Images ───────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <h4 className="font-sans font-bold text-base text-slate-100 mb-5 flex items-center gap-2 border-b border-slate-800/80 pb-4">
          <Brain className="h-5 w-5 text-indigo-400" />
          Computer Vision Architecture — Reference Diagrams
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <img src={detectionImg} alt="YOLO-style Object Detection with bounding boxes" className="rounded-2xl w-full border border-slate-800 object-cover" />
            <p className="font-sans text-[11px] text-slate-400 leading-relaxed px-1">
              <span className="text-slate-200 font-semibold">Object Detection Output</span> — COCO-SSD produces per-class colored bounding boxes. Each box shows the class label and confidence score. Higher confidence = thicker box highlight.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <img src={yoloImg} alt="YOLO detection algorithm explanation" className="rounded-2xl w-full border border-slate-800 object-cover" />
            <p className="font-sans text-[11px] text-slate-400 leading-relaxed px-1">
              <span className="text-slate-200 font-semibold">YOLO Architecture</span> — The model outputs p₀ (object probability), x/y (center), w/h (size), and c₁…cₙ (class scores) for each grid cell in a single forward pass.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <img src={signLangImg} alt="ASL sign language gesture recognition showing V sign" className="rounded-2xl w-full border border-slate-800 object-cover" />
            <p className="font-sans text-[11px] text-slate-400 leading-relaxed px-1">
              <span className="text-slate-200 font-semibold">ASL Sign Recognition</span> — MediaPipe Hands detects 21 landmarks per hand. SenseMate classifies finger extension patterns to recognize ASL alphabet letters and core sign language gestures.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <img src={mediapipeImg} alt="MediaPipe hand tracking, pose tracking, and face tracking" className="rounded-2xl w-full border border-slate-800 object-cover" />
            <p className="font-sans text-[11px] text-slate-400 leading-relaxed px-1">
              <span className="text-slate-200 font-semibold">MediaPipe Capabilities</span> — The same MediaPipe framework powering SenseMate's gesture module also supports body pose estimation and face mesh tracking, making the architecture extensible to full-body accessibility use cases.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <img src={pipelineImg} alt="CNN detection and training pipeline diagram" className="rounded-2xl w-full border border-slate-800 object-cover max-h-64 object-top" />
          <p className="font-sans text-[11px] text-slate-400 leading-relaxed px-1 mt-2">
            <span className="text-slate-200 font-semibold">CNN Detection Pipeline</span> — During inference, each image frame is preprocessed and passed through the convolutional neural network to produce bounding box predictions and class probabilities. The pipeline runs at 5–15 FPS in-browser on CPU.
          </p>
        </div>
      </div>
    </div>
  );
}
