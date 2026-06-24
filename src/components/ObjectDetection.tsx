/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Eye, ShieldAlert, Sparkles, Volume2, Play, Square, RefreshCw, Layers, Cpu } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { DetectedObject } from "../types";
import { getApiHeaders, callVisionApi } from "../utils/api";

export default function ObjectDetection() {
  const [isActive, setIsActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState<number>(15);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [voiceMode, setVoiceMode] = useState<'system' | 'premium'>('system');
  const [premiumVoice, setPremiumVoice] = useState<string>('Zephyr');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<any>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnnouncedRef = useRef<Map<string, number>>(new Map());
  const isScanningRef = useRef(false);

  // Listen to keyboard shortcut (Spacebar) for manual scanning when tab is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && isActive && !isScanningRef.current) {
        e.preventDefault();
        triggerSingleScan();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive]);

  // Handle continuous scanning lifecycle via adaptive recursive timeout
  useEffect(() => {
    let isComponentActive = true;

    const runLoop = async () => {
      if (!isContinuous || !isActive || !isComponentActive) return;

      if (!isScanningRef.current) {
        await triggerSingleScan();
      }

      if (isContinuous && isActive && isComponentActive) {
        scanTimeoutRef.current = setTimeout(runLoop, scanIntervalSeconds * 1000);
      }
    };

    if (isContinuous && isActive) {
      runLoop();
    } else {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    }

    return () => {
      isComponentActive = false;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [isContinuous, isActive, scanIntervalSeconds]);

  // Speak welcome message when component opens
  useEffect(() => {
    speakText(
      "Object Detection Assistant activated. Click continuous scan, or press spacebar anytime to analyze what's in front of you.",
      "system"
    );
    setIsActive(true);
    return () => {
      setIsActive(false);
    };
  }, []);

  const triggerSingleScan = async () => {
    if (isScanningRef.current) return;

    const videoElem = document.getElementById("camera-video-element") as any;
    if (!videoElem || !videoElem.captureFrame) {
      setError("Camera is not fully ready. Please wait.");
      return;
    }

    const frameData = videoElem.captureFrame();
    if (!frameData) {
      setError("Failed to capture image frame.");
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setError(null);

    try {
      const data = await callVisionApi("detect", frameData);
      const detected: DetectedObject[] = data.objects || [];
      setDetections(detected);

      // Draw standard simulation bounding boxes on overlay canvas
      drawOverlays(detected);

      // Cooldown alerts system (Avoid repeating announcments for the same object within 5s)
      const now = Date.now();
      const announcements: string[] = [];

      detected.forEach((obj) => {
        const key = `${obj.label}-${obj.position}`;
        const lastAnnouncedTime = lastAnnouncedRef.current.get(key) || 0;

        if (now - lastAnnouncedTime > 5000) {
          announcements.push(obj.warning);
          lastAnnouncedRef.current.set(key, now);
        }
      });

      if (announcements.length > 0) {
        const compiledSpeech = announcements.join(". ");
        setLogs((prev) => [`🔊 Spoken: "${compiledSpeech}"`, ...prev.slice(0, 19)]);
        speakText(compiledSpeech, voiceMode, { voiceName: premiumVoice });
      } else if (detected.length === 0) {
        setLogs((prev) => ["ℹ️ Scan complete. No obstacles detected.", ...prev.slice(0, 19)]);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "";
      const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("exhausted");
      const isTransient = errMsg.includes("503") || errMsg.toLowerCase().includes("unavailable") || errMsg.toLowerCase().includes("busy");

      if (isRateLimit) {
        setError("Rate limit / quota reached. Continuous scan has been paused to protect your API limits. Please try again in 30 seconds.");
        setIsContinuous(false);
        speakText("Rate limit reached. Continuous scan paused.", "system");
      } else if (isTransient) {
        setError("Gemini servers are currently busy under high demand. Continuous scan has been paused. Please try manual scanning in a few seconds.");
        setIsContinuous(false);
        speakText("Gemini servers busy. Continuous scan paused.", "system");
      } else {
        setError(errMsg || "Something went wrong during detection.");
      }
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  };

  const drawOverlays = (objs: DetectedObject[]) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw guidance zones visually
    ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
    ctx.lineWidth = 1;
    // vertical division lines
    ctx.beginPath();
    ctx.moveTo(canvas.width / 3, 0);
    ctx.lineTo(canvas.width / 3, canvas.height);
    ctx.moveTo((canvas.width * 2) / 3, 0);
    ctx.lineTo((canvas.width * 2) / 3, canvas.height);
    ctx.stroke();

    // Draw simulated YOLO boxes based on position metadata
    objs.forEach((obj) => {
      ctx.fillStyle = "rgba(99, 102, 241, 0.1)";
      ctx.strokeStyle = "rgb(129, 140, 248)";
      ctx.lineWidth = 2.5;

      let x = canvas.width / 3;
      let y = canvas.height / 3;
      let w = canvas.width / 3;
      let h = canvas.height / 3;

      const pos = obj.position.toLowerCase();
      if (pos.includes("left")) {
        x = canvas.width * 0.05;
        w = canvas.width * 0.35;
      } else if (pos.includes("right")) {
        x = canvas.width * 0.6;
        w = canvas.width * 0.35;
      } else {
        x = canvas.width * 0.32;
        w = canvas.width * 0.36;
      }

      if (pos.includes("near")) {
        y = canvas.height * 0.25;
        h = canvas.height * 0.6;
      } else {
        y = canvas.height * 0.15;
        h = canvas.height * 0.45;
      }

      // Rounded rect draw
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      // Label background
      ctx.fillStyle = "rgb(129, 140, 248)";
      ctx.beginPath();
      ctx.roundRect(x, y - 24, ctx.measureText(obj.label).width + 24, 24, [4, 4, 0, 0]);
      ctx.fill();

      // Label text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px 'JetBrains Mono', monospace";
      ctx.fillText(`${obj.label.toUpperCase()} (${obj.confidence}%)`, x + 6, y - 8);
    });
  };

  return (
    <div id="object-detection-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Area: Cam Feed & Controls */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <Eye className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-lg text-slate-100">Live Spatial Guidance</h3>
                <p className="font-sans text-xs text-slate-400">YOLOv8 simulation & Real-time proximity warnings</p>
              </div>
            </div>
            
            <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-mono font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ONLINE [CPU]
            </span>
          </div>

          {/* Camera View */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <CameraFeed
              isActive={isActive}
              overlayCanvasRef={overlayCanvasRef}
              className="w-full h-full"
            />
          </div>

          {/* Control Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <button
              id="continuous-scan-btn"
              onClick={() => setIsContinuous(!isContinuous)}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl font-sans text-sm font-medium transition-all ${
                isContinuous
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/10"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {isContinuous ? (
                <>
                  <Square className="h-4.5 w-4.5" />
                  Stop Continuous Scan ({scanIntervalSeconds}s)
                </>
              ) : (
                <>
                  <Play className="h-4.5 w-4.5" />
                  Start Continuous Scan ({scanIntervalSeconds}s)
                </>
              )}
            </button>

            <button
              id="scan-now-btn"
              onClick={triggerSingleScan}
              disabled={isScanning}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-55 disabled:cursor-not-allowed text-slate-100 rounded-2xl font-sans text-sm font-medium border border-slate-700 transition-all"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin text-indigo-400" />
                  Analyzing Scene...
                </>
              ) : (
                <>
                  <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                  Scan Now [Spacebar]
                </>
              )}
            </button>
          </div>

          {/* Scan Frequency Settings */}
          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                Scan Frequency Interval
              </span>
              <span className="font-mono text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md font-semibold">
                {scanIntervalSeconds}s interval
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <input
                id="scan-frequency-slider"
                type="range"
                min="1"
                max="30"
                step="1"
                value={scanIntervalSeconds}
                onChange={(e) => setScanIntervalSeconds(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
              <span>1s (Real-Time)</span>
              <span>15s (Default)</span>
              <span>30s (Slow)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal font-sans">
              Adjust the continuous background scan rate. You can safely lower this to 1s-3s for fast, responsive tracking when running offline via local Ollama or with a dedicated Gemini key.
            </p>
          </div>
        </div>

        {/* Audio Setting Panel */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-5 w-5 text-indigo-400 shrink-0" />
            <div>
              <span className="font-sans text-xs font-semibold text-slate-200 block">Voice Output Selection</span>
              <span className="font-sans text-[10px] text-slate-400 block sm:inline">Choose browser or premium natural AI voices.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="voice-mode-system-btn"
              onClick={() => setVoiceMode('system')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                voiceMode === 'system'
                  ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/35'
                  : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-400'
              }`}
            >
              System Voice
            </button>
            <button
              id="voice-mode-premium-btn"
              onClick={() => setVoiceMode('premium')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                voiceMode === 'premium'
                  ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/35'
                  : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-400'
              }`}
            >
              ⭐ Premium (Gemini)
            </button>
            {voiceMode === 'premium' && (
              <select
                id="premium-voice-select"
                value={premiumVoice}
                onChange={(e) => setPremiumVoice(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2 py-1.5 text-slate-300"
              >
                <option value="Zephyr">Zephyr</option>
                <option value="Kore">Kore</option>
                <option value="Puck">Puck</option>
                <option value="Charon">Charon</option>
                <option value="Fenrir">Fenrir</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Right Area: Results List & Cooldown log */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Detected Objects list */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col h-[280px] shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-indigo-400" />
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
                Toggle Continuous Scan or capture a single frame to start tracking obstacles.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll">
              {detections.map((obj, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/85 rounded-xl hover:border-indigo-500/20 transition-all"
                >
                  <div className="flex flex-col">
                    <span className="font-sans font-semibold text-xs text-indigo-300">
                      {obj.label.toUpperCase()}
                    </span>
                    <span className="font-sans text-[10px] text-slate-400 mt-0.5">
                      Position: {obj.position}
                    </span>
                    <span className="font-sans text-[11px] text-emerald-400/95 font-medium mt-1">
                      ⚠️ "{obj.warning}"
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-4">
                    <span className="font-mono text-xs font-semibold text-slate-300">
                      {obj.confidence}%
                    </span>
                    <span className="font-sans text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">
                      Conf
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cooldown guidance announcements log */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 min-h-[220px] shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Volume2 className="h-4.5 w-4.5 text-indigo-400" />
            Voice Assistance Alerts Log
          </h4>

          {logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600">
              <p className="font-sans text-xs italic">Announcements history will appear here...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scroll font-mono text-xs text-slate-400 leading-relaxed">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border border-slate-950 text-[11px] ${
                    idx === 0
                      ? "bg-indigo-950/20 text-indigo-200 border-indigo-500/20 font-medium"
                      : "bg-slate-950 text-slate-400"
                  }`}
                >
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
