import { useState, useEffect, useRef } from "react";
import { Hand, Volume2, Info, RefreshCw, Layers, ShieldAlert, Cpu, Zap, BookOpen } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { GestureResponse } from "../types";
import { classifyGesture, loadGestureModel, isGestureModelLoaded, classifyASLLetter, getHandKeypoints, ASLLetter } from "../utils/gestureEngine";

type RecognitionMode = 'signs' | 'asl';

const ASL_ALPHABET_GUIDE: { letter: string; hint: string }[] = [
  { letter: 'A', hint: 'Fist, thumb beside index' },
  { letter: 'B', hint: 'All 4 fingers up, thumb tucked' },
  { letter: 'D', hint: 'Index only up, no thumb' },
  { letter: 'F', hint: 'Index+thumb pinch, 3 fingers up' },
  { letter: 'I', hint: 'Pinky only up' },
  { letter: 'K', hint: 'Index+middle+thumb up' },
  { letter: 'L', hint: 'Index up + thumb to side' },
  { letter: 'O', hint: 'All fingers curved to thumb' },
  { letter: 'R', hint: 'Index+middle crossed' },
  { letter: 'S', hint: 'Fist, thumb over fingers' },
  { letter: 'T', hint: 'Fist, thumb between index+middle' },
  { letter: 'U', hint: 'Index+middle up, close together' },
  { letter: 'V', hint: 'Index+middle up, spread apart (peace)' },
  { letter: 'W', hint: 'Index+middle+ring up' },
  { letter: 'X', hint: 'Index finger slightly curled/hooked' },
  { letter: 'Y', hint: 'Thumb+pinky up (hang loose)' },
];

const SIGN_GUIDE = [
  { name: "Hello",     description: "Open hand — 4 fingers extended, palm facing camera." },
  { name: "Stop",      description: "All 5 up — 4 fingers + thumb fully extended, palm forward." },
  { name: "Yes",       description: "Thumbs up — all 4 fingers folded down, thumb raised." },
  { name: "No",        description: "Horns — index + pinky up, middle + ring folded." },
  { name: "Thank You", description: "3 fingers — index + middle + ring up, together." },
  { name: "Water",     description: "W sign — index + middle + ring spread wide apart." },
  { name: "Peace",     description: "V sign — index + middle up, spread apart (peace)." },
  { name: "Come",      description: "Beckon — index + middle up, close together." },
  { name: "Love",      description: "ILY — index + pinky + thumb up, middle + ring folded." },
  { name: "Call Me",   description: "Phone — thumb + pinky up, other 3 fingers folded." },
  { name: "Point",     description: "Index only — single finger pointing, others curled." },
  { name: "Okay",      description: "O shape — thumb + index tip touching, other 3 up." },
  { name: "Please",    description: "Open palm — 3 fingers + thumb spread to side." },
  { name: "Sorry",     description: "S fist — closed fist, thumb over knuckles." },
  { name: "Help",      description: "SOS fist — closed fist, thumb-side distress signal." },
];

export default function GestureTranslator() {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState<number>(2);
  const [mode, setMode] = useState<RecognitionMode>('signs');
  const [translatedGesture, setTranslatedGesture] = useState<GestureResponse | null>(null);
  const [aslLetter, setAslLetter] = useState<{ letter: ASLLetter; confidence: number; debugInfo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const modeRef = useRef<RecognitionMode>('signs');

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    speakText("Sign Language Translator activated. AI hand model loading.", "system");
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
      if (!isProcessingRef.current) await triggerScan();
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
  }, [isContinuous, isActive, scanIntervalSeconds, modelReady, mode]);

  const triggerScan = async () => {
    if (isProcessingRef.current) return;
    const videoElem = document.getElementById("camera-video-element") as HTMLVideoElement;
    if (!videoElem || videoElem.readyState < 2) {
      setError("Webcam stream is not ready. Please wait a moment.");
      return;
    }
    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      if (modeRef.current === 'asl') {
        const result = await getHandKeypoints(videoElem);
        if (!result) {
          setAslLetter({ letter: '?', confidence: 0, debugInfo: 'No hand detected in frame' });
        } else {
          const asl = classifyASLLetter(result.keypoints);
          setAslLetter(asl);
          if (asl.letter !== '?') speakText(`Letter ${asl.letter}`, "system");
        }
      } else {
        const data: GestureResponse = await classifyGesture(videoElem);
        setTranslatedGesture(data);
        if (data.gesture && data.gesture !== 'Unknown') {
          speakText(`${data.gesture}. ${data.meaning}`, "system");
        } else if (data.gesture === 'Unknown' && !isContinuous) {
          speakText("Gesture not recognized. Please position your hand clearly in center.", "system");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to classify hand gesture.");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleModeSwitch = (m: RecognitionMode) => {
    setMode(m);
    setAslLetter(null);
    setTranslatedGesture(null);
    setError(null);
  };

  const letterColor = (conf: number) =>
    conf >= 85 ? 'text-emerald-400' : conf >= 70 ? 'text-amber-400' : 'text-slate-500';

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

          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
            <button
              onClick={() => handleModeSwitch('signs')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-sans font-semibold transition-all ${
                mode === 'signs' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Hand className="h-3.5 w-3.5" /> Sign Language
            </button>
            <button
              onClick={() => handleModeSwitch('asl')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-sans font-semibold transition-all ${
                mode === 'asl' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> ASL Alphabet
            </button>
          </div>

          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <CameraFeed isActive={isActive} className="w-full h-full" />
            {/* Mode badge overlay */}
            <div className="absolute top-3 left-3 z-30 px-2.5 py-1 bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 rounded-full text-[10px] font-mono font-semibold text-indigo-300">
              {mode === 'asl' ? '🔤 ASL ALPHABET MODE' : '✋ SIGN LANGUAGE MODE'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <button
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
              onClick={triggerScan}
              disabled={isProcessing || !modelReady}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-55 disabled:cursor-not-allowed text-slate-100 rounded-2xl font-sans text-sm font-medium border border-slate-700 transition-all"
            >
              {isProcessing ? (
                <><RefreshCw className="h-4 w-4 animate-spin text-indigo-400" /> Classifying...</>
              ) : (
                <><Zap className="h-4 w-4 text-indigo-400" /> {mode === 'asl' ? 'Read Letter' : 'Translate Gesture'}</>
              )}
            </button>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" /> Scan Interval
              </span>
              <span className="font-mono text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md font-semibold">{scanIntervalSeconds}s</span>
            </div>
            <input type="range" min="1" max="10" step="1" value={scanIntervalSeconds}
              onChange={(e) => setScanIntervalSeconds(Number(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer" />
            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
              <span>1s (Real-Time)</span><span>2s (Default)</span><span>10s (Slow)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6 flex flex-col gap-4">
        {/* Output card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col shadow-lg" style={{ minHeight: 240 }}>
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-4">
            {mode === 'asl' ? 'ASL Letter Output' : 'Translation Output'}
          </h4>

          {isProcessing ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="h-7 w-7 text-indigo-400 animate-spin mb-1" />
              <p className="font-sans text-xs">Analyzing hand landmarks...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-400">
              <ShieldAlert className="h-8 w-8 text-rose-500 mb-2" />
              <p className="font-sans text-xs">{error}</p>
            </div>
          ) : mode === 'asl' ? (
            aslLetter ? (
              <div className="flex-1 flex flex-col gap-3">
                {/* Big letter display */}
                <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-[9px] text-slate-500 uppercase tracking-widest font-semibold">ASL Letter</span>
                    <span className={`font-mono font-black leading-none ${aslLetter.letter !== '?' ? letterColor(aslLetter.confidence) : 'text-slate-600'}`}
                      style={{ fontSize: '5rem' }}>
                      {aslLetter.letter}
                    </span>
                    {aslLetter.letter !== '?' && (
                      <button
                        onClick={() => speakText(`Letter ${aslLetter.letter}`, "system")}
                        className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 mt-1"
                      >
                        <Volume2 className="h-3 w-3" /> Speak letter
                      </button>
                    )}
                  </div>
                  {aslLetter.letter !== '?' && (
                    <div className="flex flex-col items-center border-l border-slate-800 pl-5 ml-3 shrink-0">
                      <span className={`font-mono text-2xl font-bold ${letterColor(aslLetter.confidence)}`}>{aslLetter.confidence}%</span>
                      <span className="font-sans text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Confidence</span>
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 mt-2">
                        <div className={`h-1.5 rounded-full ${aslLetter.confidence >= 85 ? 'bg-emerald-500' : aslLetter.confidence >= 70 ? 'bg-amber-500' : 'bg-slate-600'}`}
                          style={{ width: `${aslLetter.confidence}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {aslLetter.debugInfo && (
                  <div className="bg-slate-950/80 border border-slate-800/60 px-3 py-2 rounded-xl flex items-center gap-2">
                    <Cpu className="h-3 w-3 text-slate-500 shrink-0" />
                    <span className="font-mono text-[10px] text-slate-400">
                      Landmarks: <span className="text-indigo-300">{aslLetter.debugInfo}</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
                <BookOpen className="h-9 w-9 text-slate-700 mb-2" />
                <p className="font-sans text-xs">Show an ASL letter to the camera</p>
                <p className="font-sans text-[10px] text-slate-600 mt-1">Click "Read Letter" or enable Auto-Detect</p>
              </div>
            )
          ) : (
            translatedGesture ? (
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
                    {translatedGesture.gesture !== 'Unknown' && (
                      <button onClick={() => speakText(translatedGesture.meaning, "system")}
                        className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 mt-1">
                        <Volume2 className="h-3 w-3" /> Read aloud
                      </button>
                    )}
                  </div>
                  {translatedGesture.gesture !== 'Unknown' && (
                    <div className="flex flex-col items-end border-l border-slate-800/80 pl-5 ml-4 shrink-0">
                      <span className="font-mono text-2xl font-bold text-emerald-400">{translatedGesture.confidenceScore}%</span>
                      <span className="font-sans text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Accuracy</span>
                    </div>
                  )}
                </div>
                {translatedGesture.debugInfo && (
                  <div className="bg-slate-950/80 border border-slate-800/60 px-3 py-2 rounded-xl flex items-center gap-2">
                    <Cpu className="h-3 w-3 text-slate-500 shrink-0" />
                    <span className="font-mono text-[10px] text-slate-400">
                      Fingers: <span className="text-indigo-300">{translatedGesture.debugInfo}</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
                <Hand className="h-9 w-9 text-slate-700 mb-2 animate-pulse" />
                <p className="font-sans text-xs">Awaiting gesture input</p>
                <p className="font-sans text-[10px] text-slate-600 mt-1">
                  {modelLoading ? "MediaPipe model loading..." : "Show a hand gesture, then click Translate."}
                </p>
              </div>
            )
          )}
        </div>

        {/* Reference guide */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg" style={{ minHeight: 220 }}>
          <h4 className="font-sans font-semibold text-sm text-slate-200 border-b border-slate-800/80 pb-3 mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-400" />
            {mode === 'asl' ? 'ASL Alphabet Guide' : 'Sign Gesture Guide'}
          </h4>

          {mode === 'asl' ? (
            <div className="flex-1 overflow-y-auto pr-1 custom-scroll">
              <div className="grid grid-cols-2 gap-1.5">
                {ASL_ALPHABET_GUIDE.map(g => (
                  <div key={g.letter} className="flex items-start gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl hover:border-indigo-500/15 transition-colors">
                    <span className="font-mono font-black text-indigo-300 text-base w-5 shrink-0">{g.letter}</span>
                    <p className="font-sans text-[10px] text-slate-400 leading-snug mt-0.5">{g.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll">
              {SIGN_GUIDE.map(item => (
                <div key={item.name} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1 hover:border-indigo-500/10 transition-colors">
                  <span className="font-sans font-semibold text-xs text-indigo-300">{item.name}</span>
                  <p className="font-sans text-[11px] text-slate-400 leading-normal">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
