import { useState, useEffect, useRef } from "react";
import { Eye, ShieldAlert, Volume2, Play, Square, RefreshCw, Layers, Cpu, Zap } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { DetectedObject } from "../types";
import { detectObjects, loadObjectDetectionModel, isObjectModelLoaded, CocoDetection } from "../utils/objectDetectionEngine";

export default function ObjectDetection() {
  const [isActive, setIsActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState<number>(3);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnnouncedRef = useRef<Map<string, number>>(new Map());
  const isScanningRef = useRef(false);

  // Preload model on mount
  useEffect(() => {
    setModelLoading(true);
    loadObjectDetectionModel()
      .then(() => {
        setModelReady(true);
        setModelLoading(false);
      })
      .catch((err) => {
        setError(`Failed to load detection model: ${err.message}`);
        setModelLoading(false);
      });

    speakText(
      "Object Detection Assistant activated. AI model loading. Press Scan Now or enable continuous scan to detect obstacles.",
      "system"
    );
    setIsActive(true);
    return () => {
      setIsActive(false);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcut: Spacebar for manual scan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && isActive && !isScanningRef.current && modelReady) {
        e.preventDefault();
        triggerSingleScan();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, modelReady]);

  // Continuous scan loop
  useEffect(() => {
    let active = true;
    const runLoop = async () => {
      if (!isContinuous || !isActive || !active || !modelReady) return;
      if (!isScanningRef.current) await triggerSingleScan();
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

  const triggerSingleScan = async () => {
    if (isScanningRef.current) return;
    const videoElem = document.getElementById("camera-video-element") as HTMLVideoElement;
    if (!videoElem || videoElem.readyState < 2) {
      setError("Camera is not fully ready. Please wait a moment.");
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setError(null);

    try {
      const { objects: detected, rawPredictions } = await detectObjects(videoElem);
      setDetections(detected);
      drawOverlays(detected, rawPredictions, videoElem);

      const now = Date.now();
      const announcements: string[] = [];
      detected.forEach((obj) => {
        const key = `${obj.label}-${obj.position}`;
        const last = lastAnnouncedRef.current.get(key) || 0;
        if (now - last > 5000) {
          announcements.push(obj.warning);
          lastAnnouncedRef.current.set(key, now);
        }
      });

      if (announcements.length > 0) {
        const speech = announcements.join(". ");
        setLogs((prev) => [`🔊 Spoken: "${speech}"`, ...prev.slice(0, 19)]);
        speakText(speech, "system");
      } else if (detected.length === 0) {
        setLogs((prev) => ["ℹ️ Scan complete. No obstacles detected.", ...prev.slice(0, 19)]);
      }
    } catch (err: any) {
      setError(err.message || "Detection failed. Please try again.");
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  };

  const drawOverlays = (
    objs: DetectedObject[],
    raw: CocoDetection[],
    video: HTMLVideoElement
  ) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sync canvas DOM dimensions to its rendered CSS size
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0) canvas.width = rect.width;
    if (rect.height > 0) canvas.height = rect.height;

    const scaleX = canvas.width / (video.videoWidth || canvas.width);
    const scaleY = canvas.height / (video.videoHeight || canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw zone dividers
    ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 3, 0); ctx.lineTo(canvas.width / 3, canvas.height);
    ctx.moveTo((canvas.width * 2) / 3, 0); ctx.lineTo((canvas.width * 2) / 3, canvas.height);
    ctx.stroke();

    // Draw real COCO-SSD bounding boxes
    raw.filter(p => p.score > 0.35).forEach((pred, i) => {
      const [bx, by, bw, bh] = pred.bbox;
      const x = bx * scaleX;
      const y = by * scaleY;
      const w = bw * scaleX;
      const h = bh * scaleY;
      const conf = Math.round(pred.score * 100);
      const label = pred.class.toUpperCase();

      ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
      ctx.strokeStyle = i === 0 ? "rgb(129, 140, 248)" : "rgb(94, 234, 212)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();

      const textW = ctx.measureText(`${label} ${conf}%`).width + 20;
      ctx.fillStyle = i === 0 ? "rgb(99, 102, 241)" : "rgb(20, 184, 166)";
      ctx.beginPath();
      ctx.roundRect(x, Math.max(0, y - 22), textW, 22, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`${label} ${conf}%`, x + 6, Math.max(14, y - 6));
    });
  };

  return (
    <div id="object-detection-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <Eye className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-lg text-slate-100">Live Spatial Guidance</h3>
                <p className="font-sans text-xs text-slate-400">COCO-SSD real-time object detection — runs in browser</p>
              </div>
            </div>

            {modelLoading ? (
              <span className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-mono font-medium text-amber-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                LOADING AI...
              </span>
            ) : modelReady ? (
              <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-mono font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AI READY [CPU]
              </span>
            ) : (
              <span className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-[10px] font-mono font-medium text-rose-400">
                MODEL ERROR
              </span>
            )}
          </div>

          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <CameraFeed isActive={isActive} overlayCanvasRef={overlayCanvasRef} className="w-full h-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <button
              id="continuous-scan-btn"
              onClick={() => setIsContinuous(!isContinuous)}
              disabled={!modelReady}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl font-sans text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isContinuous
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/10"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {isContinuous ? (
                <><Square className="h-4 w-4" /> Stop Continuous ({scanIntervalSeconds}s)</>
              ) : (
                <><Play className="h-4 w-4" /> Start Continuous ({scanIntervalSeconds}s)</>
              )}
            </button>

            <button
              id="scan-now-btn"
              onClick={triggerSingleScan}
              disabled={isScanning || !modelReady}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-55 disabled:cursor-not-allowed text-slate-100 rounded-2xl font-sans text-sm font-medium border border-slate-700 transition-all"
            >
              {isScanning ? (
                <><RefreshCw className="h-4 w-4 animate-spin text-indigo-400" /> Analyzing...</>
              ) : modelLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin text-amber-400" /> Loading Model...</>
              ) : (
                <><Zap className="h-4 w-4 text-indigo-400" /> Scan Now [Spacebar]</>
              )}
            </button>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                Scan Interval
              </span>
              <span className="font-mono text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md font-semibold">
                {scanIntervalSeconds}s
              </span>
            </div>
            <input
              type="range" min="1" max="15" step="1"
              value={scanIntervalSeconds}
              onChange={(e) => setScanIntervalSeconds(Number(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
              <span>1s (Fast)</span>
              <span>3s (Default)</span>
              <span>15s (Slow)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal font-sans">
              All detection runs locally — no API calls. You can safely set 1s for real-time tracking.
            </p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col h-[280px] shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            Detected Obstacles
          </h4>

          {error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-400 p-4 overflow-y-auto">
              <ShieldAlert className="h-8 w-8 text-rose-500 mb-2 shrink-0" />
              <p className="font-sans text-xs leading-normal">{error}</p>
            </div>
          ) : detections.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
              <ShieldAlert className="h-8 w-8 text-slate-600 mb-2" />
              <p className="font-sans text-xs">No active detections</p>
              <p className="font-sans text-[10px] text-slate-600 max-w-xs mt-1">
                {modelLoading ? "AI model loading..." : "Enable continuous scan or click Scan Now."}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll">
              {detections.map((obj, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/85 rounded-xl hover:border-indigo-500/20 transition-all">
                  <div className="flex flex-col">
                    <span className="font-sans font-semibold text-xs text-indigo-300">{obj.label.toUpperCase()}</span>
                    <span className="font-sans text-[10px] text-slate-400 mt-0.5">Position: {obj.position}</span>
                    <span className="font-sans text-[11px] text-emerald-400/95 font-medium mt-1">⚠️ "{obj.warning}"</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-4">
                    <span className="font-mono text-xs font-semibold text-slate-300">{obj.confidence}%</span>
                    <span className="font-sans text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Conf</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 min-h-[220px] shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-indigo-400" />
            Voice Assistance Log
          </h4>
          {logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600">
              <p className="font-sans text-xs italic">Voice announcements will appear here...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll font-mono text-xs text-slate-400">
              {logs.map((log, idx) => (
                <div key={idx} className={`p-2 rounded-lg border text-[11px] ${idx === 0 ? "bg-indigo-950/20 text-indigo-200 border-indigo-500/20 font-medium" : "bg-slate-950 text-slate-400 border-slate-950"}`}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
