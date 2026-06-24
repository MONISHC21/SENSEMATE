import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, AlertTriangle, Play, Square, RefreshCw, Sliders, Volume2, ShieldAlert } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { detectMotion, captureFrameData, MotionRegion } from "../utils/motionEngine";

export default function MotionDetection() {
  const [isActive, setIsActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [sensitivity, setSensitivity] = useState(30);
  const [fps, setFps] = useState(8);
  const [motionRegions, setMotionRegions] = useState<MotionRegion[]>([]);
  const [motionRatio, setMotionRatio] = useState(0);
  const [alertLog, setAlertLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const lastRegionCountRef = useRef<number>(0);

  useEffect(() => {
    setIsActive(true);
    speakText("Motion Detection activated. Press Start to begin scanning for movement.", "system");
    return () => {
      setIsActive(false);
      stopDetection();
    };
  }, []);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    prevFrameRef.current = null;
    setMotionRegions([]);
    setMotionRatio(0);
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const runDetectionTick = useCallback(() => {
    const video = document.getElementById('camera-video-element') as HTMLVideoElement;
    if (!video || video.readyState < 2) return;

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    // Sync canvas size
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0) { canvas.width = rect.width; canvas.height = rect.height; }

    const curr = captureFrameData(video);
    if (!curr) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!prevFrameRef.current) {
      prevFrameRef.current = curr;
      return;
    }

    const { regions, motionRatio: ratio } = detectMotion(prevFrameRef.current, curr, sensitivity);
    prevFrameRef.current = curr;

    const scaleX = canvas.width / curr.width;
    const scaleY = canvas.height / curr.height;

    // Draw motion bounding boxes
    regions.forEach((r, i) => {
      const x = r.x * scaleX;
      const y = r.y * scaleY;
      const w = r.width * scaleX;
      const h = r.height * scaleY;
      const alpha = Math.min(0.9, 0.4 + r.intensity * 0.5);

      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.fillStyle = `rgba(74, 222, 128, 0.06)`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Label
      const label = `MOTION ${r.position.toUpperCase()}`;
      const textW = ctx.measureText(label).width + 14;
      ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
      ctx.beginPath();
      ctx.roundRect(x, Math.max(0, y - 20), textW, 20, [4, 4, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(label, x + 6, Math.max(13, y - 5));

      // Motion intensity bar at bottom of box
      ctx.fillStyle = `rgba(74, 222, 128, 0.3)`;
      ctx.fillRect(x, y + h - 4, w * r.intensity, 4);
    });

    setMotionRegions(regions);
    setMotionRatio(ratio);

    // Voice alert (throttled, only when motion appears)
    const now = Date.now();
    if (regions.length > 0 && (regions.length !== lastRegionCountRef.current || now - lastAlertTimeRef.current > 4000)) {
      lastAlertTimeRef.current = now;
      lastRegionCountRef.current = regions.length;
      const positions = [...new Set(regions.map(r => r.position))].join(' and ');
      const alertText = `Motion detected: ${regions.length} ${regions.length === 1 ? 'object' : 'objects'} moving on the ${positions}.`;
      setAlertLog(prev => [`⚡ ${alertText}`, ...prev.slice(0, 29)]);
      speakText(alertText, "system");
    } else if (regions.length === 0 && lastRegionCountRef.current > 0) {
      lastRegionCountRef.current = 0;
    }
  }, [sensitivity]);

  const startDetection = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    prevFrameRef.current = null;
    setIsRunning(true);
    setAlertLog([]);
    intervalRef.current = setInterval(runDetectionTick, Math.round(1000 / fps));
  }, [runDetectionTick, fps]);

  // Restart interval when fps changes while running
  useEffect(() => {
    if (isRunning) {
      startDetection();
    }
  }, [fps]);

  const intensityColor = motionRatio > 0.05 ? 'text-rose-400' : motionRatio > 0.01 ? 'text-amber-400' : 'text-emerald-400';
  const intensityLabel = motionRatio > 0.05 ? 'HIGH' : motionRatio > 0.01 ? 'MED' : 'LOW';

  return (
    <div id="motion-detection-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <Activity className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-lg text-slate-100">Motion Detection</h3>
                <p className="font-sans text-xs text-slate-400">Frame differencing — detects moving objects in real time</p>
              </div>
            </div>
            <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono font-semibold border ${isRunning ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              {isRunning ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE</> : 'IDLE'}
            </span>
          </div>

          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <CameraFeed isActive={isActive} overlayCanvasRef={overlayCanvasRef} className="w-full h-full" />
            {isRunning && motionRegions.length > 0 && (
              <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/80 backdrop-blur-sm rounded-full">
                <AlertTriangle className="h-3 w-3 text-white" />
                <span className="font-mono text-[10px] font-bold text-white">{motionRegions.length} MOVING</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={isRunning ? stopDetection : startDetection}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl font-sans text-sm font-medium transition-all ${
                isRunning
                  ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/10'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isRunning ? <><Square className="h-4 w-4" /> Stop Detection</> : <><Play className="h-4 w-4" /> Start Detection</>}
            </button>
            <button
              onClick={() => { setAlertLog([]); prevFrameRef.current = null; }}
              className="flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-sans text-sm font-medium border border-slate-700 transition-all"
            >
              <RefreshCw className="h-4 w-4" /> Reset Frame
            </button>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <Sliders className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-sans text-xs font-semibold text-slate-300">Detection Settings</span>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-sans text-[11px] text-slate-400">Sensitivity (lower = more sensitive)</span>
                <span className="font-mono text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">{sensitivity}</span>
              </div>
              <input type="range" min="10" max="80" step="5" value={sensitivity}
                onChange={e => setSensitivity(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer" />
              <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-0.5">
                <span>10 (Very Sensitive)</span><span>80 (Only Large Motion)</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-sans text-[11px] text-slate-400">Scan Rate</span>
                <span className="font-mono text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">{fps} fps</span>
              </div>
              <input type="range" min="2" max="15" step="1" value={fps}
                onChange={e => setFps(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer" />
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-3 shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            Live Motion Stats
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-center">
              <span className="font-mono text-2xl font-bold text-emerald-400">{motionRegions.length}</span>
              <p className="font-sans text-[10px] text-slate-500 mt-0.5">Moving Objects</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-center">
              <span className={`font-mono text-2xl font-bold ${intensityColor}`}>{intensityLabel}</span>
              <p className="font-sans text-[10px] text-slate-500 mt-0.5">Motion Level</p>
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="font-sans text-[10px] text-slate-400">Frame Motion Intensity</span>
              <span className="font-mono text-[10px] text-slate-300">{(motionRatio * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-200 ${motionRatio > 0.05 ? 'bg-rose-500' : motionRatio > 0.01 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, motionRatio * 500)}%` }}
              />
            </div>
          </div>
          {motionRegions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {motionRegions.slice(0, 4).map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-950 border border-emerald-500/15 rounded-xl">
                  <span className="font-sans text-xs text-emerald-300 font-medium">Moving object — {r.position}</span>
                  <span className="font-mono text-[10px] text-slate-400">{Math.round(r.width * r.height / 100)}px²</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 min-h-[220px] shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-emerald-400" />
            Motion Alert Log
          </h4>
          {alertLog.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-center">
              <ShieldAlert className="h-8 w-8 text-slate-700 mb-2" />
              <p className="font-sans text-xs italic">{isRunning ? 'Monitoring... alerts appear when motion is detected.' : 'Start detection to monitor for movement.'}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scroll font-mono text-xs">
              {alertLog.map((log, i) => (
                <div key={i} className={`p-2 rounded-lg border text-[11px] leading-relaxed ${i === 0 ? 'bg-emerald-950/30 text-emerald-200 border-emerald-500/20' : 'bg-slate-950 text-slate-400 border-slate-800/60'}`}>
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
