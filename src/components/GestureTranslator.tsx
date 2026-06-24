import { useState, useEffect, useRef } from "react";
import { Hand, Volume2, Info, RefreshCw, Layers, ShieldAlert, Cpu, Zap } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { GestureResponse } from "../types";
import { classifyGesture, loadGestureModel, isGestureModelLoaded } from "../utils/gestureEngine";

export default function GestureTranslator() {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState<number>(2);
  const [translatedGesture, setTranslatedGesture] = useState<GestureResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    speakText(
      "Sign Language Translator activated. AI hand model loading. Show gestures like Hello, Help, or Thank You.",
      "system"
    );
    setIsActive(true);

    loadGestureModel()
      .then(() => { setModelReady(true); setModelLoading(false); })
      .catch((err) => { setError(`Failed to load gesture model: ${err.message}`); setModelLoading(false); });

    return () => {
      setIsActive(false);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const runLoop = async () => {
      if (!isContinuous || !isActive || !active || !modelReady) return;
      if (!isProcessingRef.current) await triggerGestureScan();
      if (isContinuous && isActive && active) {
        scanTimeoutRef.current = setTimeout(runLoop, scanIntervalSeconds * 1000);
      }
    };
    if (isContinuous && isActive && modelReady) {
      runLoop();
    } else {
      if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
    }
    return () => {
      active = false;
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [isContinuous, isActive, scanIntervalSeconds, modelReady]);

  const triggerGestureScan = async () => {
    if (isProcessingRef.current) return;
    const videoElem = document.getElementById("camera-video-element") as HTMLVideoElement;
    if (!videoElem || videoElem.readyState < 2) {
      setError("Webcam stream is not ready. Please verify.");
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      const data: GestureResponse = await classifyGesture(videoElem);
      setTranslatedGesture(data);
      if (data.gesture && data.gesture !== 'Unknown') {
        speakText(`${data.gesture}. ${data.meaning}`, "system");
      } else if (data.gesture === 'Unknown' && !isContinuous) {
        speakText("Gesture not recognized. Please position your hand clearly in center.", "system");
      }
    } catch (err: any) {
      setError(err.message || "Failed to classify hand gesture.");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const gestureGuidelines = [
    { name: "Hello", description: "Open flat hand — all 4 fingers extended, palm facing camera." },
    { name: "Yes", description: "Closed fist with thumb up — all fingers curled down." },
    { name: "Help", description: "Closed fist without thumb, or single index finger raised." },
    { name: "Thank You", description: "Three fingers up — index, middle, and ring extended." },
    { name: "No", description: "Index and pinky extended, middle and ring fingers down (horns sign)." },
  ];

  return (
    <div id="gesture-translator-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <Hand className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-lg text-slate-100">Sign Language Translator</h3>
                <p className="font-sans text-xs text-slate-400">MediaPipe Hands — real-time offline gesture AI</p>
              </div>
            </div>

            {modelLoading ? (
              <span className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-mono font-medium text-amber-400">
                <RefreshCw className="h-3 w-3 animate-spin" /> LOADING...
              </span>
            ) : modelReady ? (
              <span className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-mono font-medium text-indigo-300">
                <Layers className="h-3 w-3" /> AI READY
              </span>
            ) : (
              <span className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-[10px] font-mono font-medium text-rose-400">
                MODEL ERROR
              </span>
            )}
          </div>

          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <CameraFeed isActive={isActive} className="w-full h-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <button
              id="continuous-gesture-btn"
              onClick={() => setIsContinuous(!isContinuous)}
              disabled={!modelReady}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl font-sans text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isContinuous
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {isContinuous ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Live Tracking ({scanIntervalSeconds}s)</>
              ) : (
                <><Layers className="h-4 w-4" /> Auto-Detect ({scanIntervalSeconds}s)</>
              )}
            </button>

            <button
              id="translate-gesture-now-btn"
              onClick={triggerGestureScan}
              disabled={isProcessing || !modelReady}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-55 disabled:cursor-not-allowed text-slate-100 rounded-2xl font-sans text-sm font-medium border border-slate-700 transition-all"
            >
              {isProcessing ? (
                <><RefreshCw className="h-4 w-4 animate-spin text-indigo-400" /> Classifying...</>
              ) : modelLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin text-amber-400" /> Loading...</>
              ) : (
                <><Zap className="h-4 w-4 text-indigo-400" /> Translate Gesture</>
              )}
            </button>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" /> Scan Interval
              </span>
              <span className="font-mono text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md font-semibold">
                {scanIntervalSeconds}s
              </span>
            </div>
            <input
              type="range" min="1" max="10" step="1"
              value={scanIntervalSeconds}
              onChange={(e) => setScanIntervalSeconds(Number(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
              <span>1s (Real-Time)</span>
              <span>2s (Default)</span>
              <span>10s (Slow)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal font-sans">
              Hand detection runs locally via MediaPipe — you can safely set 1s for fluid real-time tracking.
            </p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col h-[230px] shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-4">
            Translation Output
          </h4>

          {isProcessing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-500">
              <RefreshCw className="h-7 w-7 text-indigo-400 animate-spin mb-1" />
              <p className="font-sans text-xs">Analyzing hand landmarks...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-400">
              <ShieldAlert className="h-8 w-8 text-rose-500 mb-2" />
              <p className="font-sans text-xs">{error}</p>
            </div>
          ) : !translatedGesture ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
              <Hand className="h-9 w-9 text-slate-700 mb-2 animate-pulse" />
              <p className="font-sans text-xs">Awaiting gesture input</p>
              <p className="font-sans text-[10px] text-slate-600 max-w-xs mt-1">
                {modelLoading ? "MediaPipe model loading..." : "Show a hand gesture in the frame, then click Translate."}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Recognized Gesture</span>
                  <span className={`font-sans font-bold text-3xl ${translatedGesture.gesture === 'Unknown' ? 'text-slate-500' : 'text-indigo-300'}`}>
                    {translatedGesture.gesture}
                  </span>
                  <span className="font-sans text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                    📢 "{translatedGesture.meaning}"
                  </span>
                </div>
                {translatedGesture.gesture !== 'Unknown' && (
                  <div className="flex flex-col items-end border-l border-slate-800/80 pl-5 ml-4 shrink-0">
                    <span className="font-mono text-2xl font-bold text-emerald-400">
                      {translatedGesture.confidenceScore}%
                    </span>
                    <span className="font-sans text-[9px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                      Accuracy
                    </span>
                  </div>
                )}
              </div>
              {translatedGesture.debugInfo && (
                <div className="bg-slate-950/80 border border-slate-800/60 px-3 py-2 rounded-xl flex items-center gap-2">
                  <Cpu className="h-3 w-3 text-slate-500 shrink-0" />
                  <span className="font-mono text-[10px] text-slate-400">
                    Fingers detected: <span className="text-indigo-300">{translatedGesture.debugInfo}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[230px]">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-400" />
            Sign Gesture Reference Guide
          </h4>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll max-h-[180px]">
            {gestureGuidelines.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1 hover:border-indigo-500/10 transition-colors">
                <span className="font-sans font-semibold text-xs text-indigo-300">{item.name}</span>
                <p className="font-sans text-[11px] text-slate-400 leading-normal">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
