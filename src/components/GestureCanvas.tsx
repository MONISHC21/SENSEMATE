import { useState, useEffect, useRef, useCallback } from "react";
import { Pen, Eraser, Trash2, RefreshCw, Palette, Minus, Plus, Hand, Cpu, AlertTriangle, SwitchCamera } from "lucide-react";
import { loadGestureModel, getHandKeypoints } from "../utils/gestureEngine";
import { speakText } from "../utils/speech";
import type { Keypoint } from "@tensorflow-models/hand-pose-detection";

type DrawMode = 'draw' | 'erase' | 'lift';

const COLORS = [
  '#6366f1', '#22d3ee', '#f43f5e', '#f59e0b', '#22c55e',
  '#a855f7', '#ffffff', '#f8fafc',
];

const SKELETON_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  kps: Keypoint[],
  vidW: number, vidH: number,
  canW: number, canH: number,
  mirror: boolean,
) {
  const toX = (x: number) => mirror ? (1 - x / vidW) * canW : (x / vidW) * canW;
  const toY = (y: number) => (y / vidH) * canH;

  ctx.strokeStyle = 'rgba(99,102,241,0.7)';
  ctx.lineWidth = 1.5;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(toX(kps[a].x), toY(kps[a].y));
    ctx.lineTo(toX(kps[b].x), toY(kps[b].y));
    ctx.stroke();
  }
  for (let i = 0; i < kps.length; i++) {
    const cx = toX(kps[i].x);
    const cy = toY(kps[i].y);
    ctx.beginPath();
    ctx.arc(cx, cy, i === 8 ? 6 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === 8 ? '#f43f5e' : i % 4 === 0 ? '#6366f1' : 'rgba(147,197,253,0.8)';
    ctx.fill();
  }
}

export default function GestureCanvas() {
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(5);
  const [mode, setMode] = useState<DrawMode>('lift');
  const [gestureLabel, setGestureLabel] = useState('No hand detected');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraLoading, setCameraLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const skelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const prevPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPoseTimeRef = useRef<number>(0);
  const colorRef = useRef(color);
  const brushRef = useRef(brushSize);
  const historyRef = useRef<ImageData[]>([]);
  const facingRef = useRef<'user' | 'environment'>('user');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushRef.current = brushSize; }, [brushSize]);
  useEffect(() => { facingRef.current = facingMode; }, [facingMode]);

  // Start camera with given facing mode
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    setCameraLoading(true);
    setError(null);
    // Stop previous stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: facing } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err: any) {
      setError('Camera access denied. Please allow camera permissions.');
    } finally {
      setCameraLoading(false);
    }
  }, []);

  useEffect(() => {
    speakText("Gesture Drawing Canvas. Point your index finger to draw. Show your full hand to clear. Use the peace sign to erase.", "system");
    loadGestureModel()
      .then(() => { setModelReady(true); setModelLoading(false); })
      .catch(err => { setError(err.message); setModelLoading(false); });
    startCamera('user');
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [startCamera]);

  const flipCamera = useCallback(() => {
    const next = facingRef.current === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    prevPointRef.current = null;
    startCamera(next);
  }, [startCamera]);

  const clearCanvas = useCallback(() => {
    const dc = drawCanvasRef.current;
    if (!dc) return;
    const ctx = dc.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, dc.width, dc.height);
    prevPointRef.current = null;
    historyRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const dc = drawCanvasRef.current;
    if (!dc || historyRef.current.length === 0) return;
    const ctx = dc.getContext('2d');
    if (!ctx) return;
    const snapshot = historyRef.current.pop()!;
    ctx.putImageData(snapshot, 0, 0);
    prevPointRef.current = null;
  }, []);

  const saveSnapshot = useCallback(() => {
    const dc = drawCanvasRef.current;
    if (!dc) return;
    const ctx = dc.getContext('2d');
    if (!ctx) return;
    if (historyRef.current.length >= 20) historyRef.current.shift();
    historyRef.current.push(ctx.getImageData(0, 0, dc.width, dc.height));
  }, []);

  useEffect(() => {
    if (!modelReady) return;
    const POSE_MS = 80;

    const loop = async (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (ts - lastPoseTimeRef.current < POSE_MS) return;
      lastPoseTimeRef.current = ts;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const dc = drawCanvasRef.current;
      const sc = skelCanvasRef.current;
      if (!dc || !sc) return;

      const scRect = sc.getBoundingClientRect();
      if (scRect.width > 0) { sc.width = scRect.width; sc.height = scRect.height; }

      const result = await getHandKeypoints(video).catch(() => null);
      const sCtx = sc.getContext('2d');
      if (!sCtx) return;
      sCtx.clearRect(0, 0, sc.width, sc.height);

      if (!result) {
        setGestureLabel('No hand detected — hold your hand up in camera');
        prevPointRef.current = null;
        setMode('lift');
        return;
      }

      const { keypoints: kps, videoWidth: vW, videoHeight: vH } = result;
      const isMirror = facingRef.current === 'user';

      // Draw skeleton overlay
      drawSkeleton(sCtx, kps, vW, vH, sc.width, sc.height, isMirror);

      // Determine gesture
      const fingerUp = (tip: number, pip: number) => kps[tip].y < kps[pip].y;
      const iUp = fingerUp(8, 6);
      const mUp = fingerUp(12, 10);
      const rUp = fingerUp(16, 14);
      const pUp = fingerUp(20, 18);
      const extended = [iUp, mUp, rUp, pUp].filter(Boolean).length;

      // Convert index tip to drawing canvas coords, respecting mirror
      const tipX = isMirror
        ? (1 - kps[8].x / vW) * dc.width
        : (kps[8].x / vW) * dc.width;
      const tipY = (kps[8].y / vH) * dc.height;

      // Also draw cursor circle on the skeleton overlay
      const cursorX = isMirror
        ? (1 - kps[8].x / vW) * sc.width
        : (kps[8].x / vW) * sc.width;
      const cursorY = (kps[8].y / vH) * sc.height;
      sCtx.beginPath();
      sCtx.arc(cursorX, cursorY, 10, 0, Math.PI * 2);
      sCtx.strokeStyle = 'rgba(244,63,94,0.9)';
      sCtx.lineWidth = 2;
      sCtx.stroke();

      if (extended >= 3) {
        clearCanvas();
        setGestureLabel('Open hand — Canvas CLEARED');
        prevPointRef.current = null;
        setMode('lift');
        return;
      }

      let newMode: DrawMode = 'lift';
      let label = 'Fist — Pen Up';

      if (iUp && mUp && !rUp && !pUp) {
        newMode = 'erase';
        label = 'Peace ✌ — Erasing';
      } else if (iUp && !mUp && !rUp && !pUp) {
        newMode = 'draw';
        label = '☝ Index — Drawing';
      }

      if (newMode === 'draw' && mode !== 'draw') saveSnapshot();
      setMode(newMode);
      setGestureLabel(label);

      const dCtx = dc.getContext('2d');
      if (!dCtx) return;

      if (newMode === 'draw' || newMode === 'erase') {
        if (prevPointRef.current) {
          const dist = Math.hypot(tipX - prevPointRef.current.x, tipY - prevPointRef.current.y);
          if (dist > 0.5 && dist < 120) {
            dCtx.beginPath();
            dCtx.moveTo(prevPointRef.current.x, prevPointRef.current.y);
            dCtx.lineTo(tipX, tipY);
            if (newMode === 'erase') {
              dCtx.globalCompositeOperation = 'destination-out';
              dCtx.strokeStyle = 'rgba(0,0,0,1)';
              dCtx.lineWidth = brushRef.current * 5;
            } else {
              dCtx.globalCompositeOperation = 'source-over';
              dCtx.strokeStyle = colorRef.current;
              dCtx.lineWidth = brushRef.current;
            }
            dCtx.lineCap = 'round';
            dCtx.lineJoin = 'round';
            dCtx.stroke();
            dCtx.globalCompositeOperation = 'source-over';
          }
        }
        prevPointRef.current = { x: tipX, y: tipY };
      } else {
        prevPointRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [modelReady, clearCanvas, saveSnapshot, mode]);

  const modeIcon = mode === 'draw' ? <Pen className="h-3.5 w-3.5" /> : mode === 'erase' ? <Eraser className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />;
  const modeColor = mode === 'draw' ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25' : mode === 'erase' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-slate-400 bg-slate-800 border-slate-700';
  const isFront = facingMode === 'user';

  return (
    <div id="gesture-canvas-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Drawing Canvas */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col gap-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl"><Pen className="h-5 w-5 text-indigo-400" /></div>
              <div>
                <h3 className="font-sans font-semibold text-base text-slate-100">Gesture Drawing Canvas</h3>
                <p className="font-sans text-[11px] text-slate-400">Point index finger to draw • Peace sign to erase • Open hand to clear</p>
              </div>
            </div>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border ${modeColor}`}>
              {modeIcon} {mode.toUpperCase()}
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950" style={{ aspectRatio: '4/3' }}>
            <canvas
              ref={drawCanvasRef}
              width={800}
              height={600}
              className="absolute inset-0 w-full h-full z-10"
              style={{ background: 'transparent' }}
            />
            <div className="absolute inset-0 z-0 opacity-10"
              style={{ backgroundImage: 'linear-gradient(#6366f130 1px, transparent 1px), linear-gradient(90deg, #6366f130 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            {mode === 'lift' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="text-center">
                  <Hand className="h-12 w-12 text-slate-700 mx-auto mb-2" />
                  <p className="font-sans text-sm text-slate-600">Point your index finger at the camera to start drawing</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={clearCanvas} className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/25 text-rose-300 rounded-xl text-xs font-medium transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
            <button onClick={undo} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Undo
            </button>
            <div className="flex items-center gap-1.5 ml-2">
              <button onClick={() => setBrushSize(s => Math.max(1, s - 1))} className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400">
                <Minus className="h-3 w-3" />
              </button>
              <span className="font-mono text-[11px] text-slate-300 w-8 text-center">{brushSize}px</span>
              <button onClick={() => setBrushSize(s => Math.min(30, s + 1))} className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Palette className="h-3.5 w-3.5 text-slate-500" />
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Camera + Controls panel */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <span className="font-sans text-sm font-semibold text-slate-200">Hand Tracking</span>
            <div className="flex items-center gap-2">
              {modelLoading ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Loading AI...
                </span>
              ) : modelReady ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-300">
                  <Cpu className="h-3 w-3" /> AI READY
                </span>
              ) : (
                <span className="text-[10px] font-mono text-rose-400">ERROR</span>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="font-sans text-[11px] text-rose-300 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Camera PIP with skeleton overlay */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950" style={{ aspectRatio: '4/3' }}>
            {cameraLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90">
                <RefreshCw className="h-7 w-7 animate-spin text-indigo-400 mb-2" />
                <p className="font-sans text-[11px] text-slate-400">
                  {isFront ? 'Switching to front camera...' : 'Switching to rear camera...'}
                </p>
              </div>
            )}
            <video
              ref={videoRef}
              id="camera-video-element"
              autoPlay playsInline muted
              className={`w-full h-full object-cover ${isFront ? 'scale-x-[-1]' : ''}`}
            />
            <canvas
              ref={skelCanvasRef}
              className="absolute inset-0 w-full h-full z-10 pointer-events-none"
            />
            {/* Flip camera button */}
            <button
              onClick={flipCamera}
              title={isFront ? 'Switch to rear camera' : 'Switch to front camera'}
              className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-sm border border-slate-700/60 rounded-xl text-slate-300 hover:text-white transition-all text-[10px] font-sans font-medium shadow"
            >
              <SwitchCamera className="h-3.5 w-3.5" />
              {isFront ? 'Rear' : 'Front'}
            </button>
          </div>

          {/* Camera label */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>{isFront ? '🤳 Front camera (selfie)' : '📷 Rear camera (back)'}</span>
            <span className="text-indigo-400">{isFront ? 'Mirrored' : 'Normal view'}</span>
          </div>

          {/* Gesture status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${modeColor}`}>
            {modeIcon}
            <span className="font-sans text-[11px] font-medium">{gestureLabel}</span>
          </div>
        </div>

        {/* Gesture guide */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col gap-3 shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/60 pb-2">Gesture Controls</h4>
          <div className="space-y-0 text-[11px] font-sans">
            {[
              { icon: '☝', label: 'Index finger only', action: 'DRAW', color: 'text-indigo-300' },
              { icon: '✌', label: 'Peace sign (index + middle)', action: 'ERASE', color: 'text-amber-300' },
              { icon: '✊', label: 'Closed fist', action: 'PEN UP', color: 'text-slate-400' },
              { icon: '🖐', label: 'Open hand (3+ fingers)', action: 'CLEAR ALL', color: 'text-rose-300' },
            ].map(g => (
              <div key={g.label} className="flex items-center justify-between py-2 border-b border-slate-800/40 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{g.icon}</span>
                  <span className="text-slate-400">{g.label}</span>
                </div>
                <span className={`font-mono font-semibold text-[10px] ${g.color}`}>{g.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
