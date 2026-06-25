import { useState, useEffect, useRef } from "react";
import { Eye, ShieldAlert, Volume2, Play, Square, RefreshCw, Layers, Cpu, Zap, MessageSquare } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { DetectedObject } from "../types";
import { detectObjects, loadObjectDetectionModel, isObjectModelLoaded, CocoDetection, generateSceneDescription } from "../utils/objectDetectionEngine";

export default function ObjectDetection() {
  const [isActive, setIsActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState<number>(3);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [sceneDescription, setSceneDescription] = useState<string | null>(null);
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

      // Generate and speak scene description
      const scene = generateSceneDescription(detected, rawPredictions);
      setSceneDescription(scene);

      const now = Date.now();
      const shouldAnnounce = detected.some(obj => {
        const key = `${obj.label}-${obj.position}`;
        const last = lastAnnouncedRef.current.get(key) || 0;
        return now - last > 5000;
      });

      if (shouldAnnounce || detected.length === 0) {
        detected.forEach(obj => {
          const key = `${obj.label}-${obj.position}`;
          lastAnnouncedRef.current.set(key, now);
        });
        setLogs((prev) => [`🔊 ${scene}`, ...prev.slice(0, 19)]);
        speakText(scene, "system");
      }
    } catch (err: any) {
      setError(err.message || "Detection failed. Please try again.");
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  };

  const CLASS_COLORS: Record<string, string> = {
    'person':       '#ef4444',
    'car':          '#22d3ee',
    'bus':          '#3b82f6',
    'truck':        '#6366f1',
    'bicycle':      '#eab308',
    'motorcycle':   '#f97316',
    'bottle':       '#22c55e',
    'laptop':       '#a855f7',
    'cell phone':   '#f43f5e',
    'chair':        '#fb923c',
    'couch':        '#d97706',
    'backpack':     '#14b8a6',
    'handbag':      '#8b5cf6',
    'clock':        '#94a3b8',
    'book':         '#84cc16',
    'cup':          '#ec4899',
    'dog':          '#f59e0b',
    'cat':          '#10b981',
    'bird':         '#06b6d4',
    'tv':           '#0ea5e9',
    'keyboard':     '#7c3aed',
    'mouse':        '#be185d',
    'remote':       '#78716c',
    'scissors':     '#dc2626',
    'fork':         '#65a30d',
    'knife':        '#b45309',
  };
  const getClassColor = (cls: string) => CLASS_COLORS[cls.toLowerCase()] ?? '#6366f1';

  const drawOverlays = (
    objs: DetectedObject[],
    raw: CocoDetection[],
    video: HTMLVideoElement
  ) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0) canvas.width = rect.width;
    if (rect.height > 0) canvas.height = rect.height;

    const scaleX = canvas.width / (video.videoWidth || canvas.width);
    const scaleY = canvas.height / (video.videoHeight || canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle zone dividers (left / center / right)
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "rgba(99, 102, 241, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 3, 0); ctx.lineTo(canvas.width / 3, canvas.height);
    ctx.moveTo((canvas.width * 2) / 3, 0); ctx.lineTo((canvas.width * 2) / 3, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw YOLO-style bounding boxes with class-specific colors
    const sorted = [...raw.filter(p => p.score > 0.35)].sort((a, b) => b.score - a.score);
    sorted.forEach((pred) => {
      const [bx, by, bw, bh] = pred.bbox;
      const x = bx * scaleX;
      const y = by * scaleY;
      const w = bw * scaleX;
      const h = bh * scaleY;
      const conf = Math.round(pred.score * 100);
      const cls = pred.class;
      const label = cls.toUpperCase();
      const color = getClassColor(cls);

      // Box fill
      ctx.fillStyle = `${color}14`; // ~8% opacity fill
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
      ctx.stroke();

      // Corner accents (YOLO-style tick marks at corners)
      const tick = Math.min(w, h) * 0.12 + 6;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = color;
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy], ci) => {
        ctx.beginPath();
        ctx.moveTo(cx + (ci % 2 === 0 ? tick : -tick), cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + (ci < 2 ? tick : -tick));
        ctx.stroke();
      });

      // Label pill: "{CLASS} {CONF}%"
      ctx.font = "bold 11px 'Courier New', monospace";
      const text = `${label}  ${conf}%`;
      const textW = ctx.measureText(text).width + 14;
      const tagH = 22;
      const tagY = y > tagH + 2 ? y - tagH : y + h;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, tagY, textW, tagH, [4, 4, y > tagH + 2 ? 0 : 4, y > tagH + 2 ? 0 : 4]);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.fillText(text, x + 7, tagY + 15);
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
        {/* Scene Description Card */}
        {sceneDescription && (
          <div className="bg-indigo-950/50 border border-indigo-500/30 p-4 rounded-2xl shadow-lg flex gap-3 items-start">
            <MessageSquare className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1 flex-1">
              <span className="font-sans text-[9px] text-indigo-400 uppercase tracking-widest font-semibold">Scene Description</span>
              <p className="font-sans text-xs text-slate-200 leading-relaxed">{sceneDescription}</p>
              <button
                onClick={() => speakText(sceneDescription, "system")}
                className="mt-1 self-start flex items-center gap-1.5 text-[10px] text-indigo-300 hover:text-indigo-200 font-medium transition-colors"
              >
                <Volume2 className="h-3 w-3" /> Read aloud again
              </button>
            </div>
          </div>
        )}

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
