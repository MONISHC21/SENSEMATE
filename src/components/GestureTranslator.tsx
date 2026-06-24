/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Hand, Sparkles, Volume2, Info, RefreshCw, Layers, ShieldAlert, Cpu } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { GestureResponse } from "../types";
import { getApiHeaders, callVisionApi } from "../utils/api";

export default function GestureTranslator() {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState<number>(15);
  
  const [translatedGesture, setTranslatedGesture] = useState<GestureResponse | null>(null);
  const [voiceMode, setVoiceMode] = useState<'system' | 'premium'>('system');
  const [premiumVoice, setPremiumVoice] = useState<string>('Zephyr');
  const [error, setError] = useState<string | null>(null);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    speakText(
      "Sign Language Translator activated. Show gestures like Hello, Help, Thank You, Yes, or No in front of your webcam to translate them.",
      "system"
    );
    setIsActive(true);
    return () => {
      setIsActive(false);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  // Continuous tracking using recursive adaptive timeout
  useEffect(() => {
    let isComponentActive = true;

    const runLoop = async () => {
      if (!isContinuous || !isActive || !isComponentActive) return;

      if (!isProcessingRef.current) {
        await triggerGestureScan();
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

  const triggerGestureScan = async () => {
    if (isProcessingRef.current) return;

    const videoElem = document.getElementById("camera-video-element") as any;
    if (!videoElem || !videoElem.captureFrame) {
      setError("Webcam stream is not ready. Please verify.");
      return;
    }

    const frameData = videoElem.captureFrame();
    if (!frameData) {
      setError("Failed to capture image.");
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      const data: GestureResponse = await callVisionApi("gesture", frameData);
      setTranslatedGesture(data);

      if (data.gesture && data.gesture !== 'Unknown') {
        const textToSpeak = `${data.gesture}. Means: ${data.meaning}`;
        speakText(textToSpeak, voiceMode, { voiceName: premiumVoice });
      } else if (data.gesture === 'Unknown' && !isContinuous) {
        speakText("Gesture not recognized. Please position your hand clearly in center.", "system");
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "";
      const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("exhausted");
      const isTransient = errMsg.includes("503") || errMsg.toLowerCase().includes("unavailable") || errMsg.toLowerCase().includes("busy");

      if (isRateLimit) {
        setError("Rate limit / quota reached. Continuous scan has been paused to protect your API limits. Please try again in 30 seconds.");
        setIsContinuous(false);
        speakText("Rate limit reached. Continuous gesture translation paused.", "system");
      } else if (isTransient) {
        setError("Gemini servers are currently busy. Continuous scan has been paused. Please try manual gesture translation in a few seconds.");
        setIsContinuous(false);
        speakText("Gemini servers busy. Continuous gesture translation paused.", "system");
      } else {
        setError(errMsg || "Failed to classify hand sign.");
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Static Gesture Guideline helper list
  const gestureGuidelines = [
    { name: "Hello", description: "Open flat hand, fingers together, palm facing out, moved gently near your forehead in a salute." },
    { name: "Help", description: "Flat dominant hand patting or resting vertically on top of an open, horizontal palm." },
    { name: "Thank You", description: "Touch fingertips of open flat hand to your lips, then move hand down and out towards person." },
    { name: "Yes", description: "Form a soft fist, tilt or nod it up and down from the wrist like a nodding head." },
    { name: "No", description: "Extend index and middle fingers together, tap them flatly against your extended thumb." }
  ];

  return (
    <div id="gesture-translator-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Area: Cam Feed & Controls */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <Hand className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-lg text-slate-100">Sign Language Translator</h3>
                <p className="font-sans text-xs text-slate-400">MediaPipe rules backed by Gemini Vision translation</p>
              </div>
            </div>

            <span className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-mono font-medium text-indigo-300">
              <Layers className="h-3 w-3" />
              VISION AI
            </span>
          </div>

          {/* Camera Container */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <CameraFeed isActive={isActive} className="w-full h-full" />
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <button
              id="continuous-gesture-btn"
              onClick={() => setIsContinuous(!isContinuous)}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl font-sans text-sm font-medium transition-all ${
                isContinuous
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/10"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {isContinuous ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                  Continuous Sign (Active {scanIntervalSeconds}s)
                </>
              ) : (
                <>
                  <Layers className="h-4.5 w-4.5" />
                  Auto-Detect Signs ({scanIntervalSeconds}s)
                </>
              )}
            </button>

            <button
              id="translate-gesture-now-btn"
              onClick={triggerGestureScan}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-55 disabled:cursor-not-allowed text-slate-100 rounded-2xl font-sans text-sm font-medium border border-slate-700 transition-all"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin text-indigo-400" />
                  Classifying Sign...
                </>
              ) : (
                <>
                  <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                  Translate Gesture
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

        {/* Audio settings */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-5 w-5 text-indigo-400 shrink-0" />
            <div>
              <span className="font-sans text-xs font-semibold text-slate-200 block">Voice Output Selection</span>
              <span className="font-sans text-[10px] text-slate-400">Hear gestures translated out loud</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="gesture-voice-system-btn"
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
              id="gesture-voice-premium-btn"
              onClick={() => setVoiceMode('premium')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                voiceMode === 'premium'
                  ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/35'
                  : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-400'
              }`}
            >
              ⭐ Premium (Gemini)
            </button>
          </div>
        </div>
      </div>

      {/* Right Area: Gesture outputs & Guide */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        {/* Output box */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col h-[230px] shadow-lg">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-4">
            Translation Output
          </h4>

          {isProcessing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-500">
              <RefreshCw className="h-7 w-7 text-indigo-400 animate-spin mb-1" />
              <p className="font-sans text-xs">Analyzing sign gestures...</p>
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
                Show flat palms or fist signals like "Hello" or "Help" in center of the frame, then translate.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between bg-slate-950 border border-slate-850 p-4 rounded-2xl">
              <div className="flex flex-col gap-1">
                <span className="font-sans text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Recognized Gesture</span>
                <span className="font-sans font-bold text-3xl text-indigo-300">
                  {translatedGesture.gesture}
                </span>
                <span className="font-sans text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                  📢 Meaning: "{translatedGesture.meaning}"
                </span>
              </div>
              <div className="flex flex-col items-end border-l border-slate-800/80 pl-5 ml-4 shrink-0">
                <span className="font-mono text-2xl font-bold text-emerald-400">
                  {translatedGesture.confidenceScore}%
                </span>
                <span className="font-sans text-[9px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                  Accuracy
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Reference Cheat Sheet */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[230px]">
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Info className="h-4.5 w-4.5 text-indigo-400" />
            Sign Gesture Reference Guide
          </h4>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll max-h-[170px]">
            {gestureGuidelines.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl flex flex-col gap-1 hover:border-indigo-500/10 transition-colors"
              >
                <span className="font-sans font-semibold text-xs text-indigo-300">
                  {item.name}
                </span>
                <p className="font-sans text-[11px] text-slate-400 leading-normal">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
