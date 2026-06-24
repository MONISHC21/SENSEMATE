import { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, RefreshCw, Sliders, AlignLeft, ChevronDown } from "lucide-react";
import { speakText } from "../utils/speech";

export default function TextToSpeech() {
  const [text, setText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const voicesLoadedRef = useRef(false);

  useEffect(() => {
    speakText(
      "Text to speech translator activated. Enter text, choose your voice, and hear natural speech feedback.",
      "system"
    );
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0 && !voicesLoadedRef.current) {
        voicesLoadedRef.current = true;
        setVoices(available);
        const englishVoice = available.find(v => v.lang.startsWith('en')) || available[0];
        if (englishVoice) setSelectedVoice(englishVoice.name);
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const handleSpeak = async () => {
    if (!text.trim()) {
      setError("Please enter some text before speaking.");
      return;
    }
    setIsSpeaking(true);
    setError(null);
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.volume = volume;
        if (selectedVoice) {
          const voice = voices.find(v => v.name === selectedVoice);
          if (voice) utterance.voice = voice;
        }
        await new Promise<void>((resolve) => {
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        });
      }
    } catch (err: any) {
      setError("Failed to synthesize speech. Check browser permissions.");
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleStop = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const sampleTexts = [
    { label: "Medicine Label", text: "Take one tablet of Ibuprofen with food every eight hours. Do not exceed three tablets in twenty-four hours." },
    { label: "Transit Sign", text: "Caution. Platform wet. Please wait behind the yellow line for the approaching train." },
    { label: "Greeting", text: "Hello! Welcome to SenseMate, your AI accessibility companion. How may I assist you today?" },
  ];

  return (
    <div id="text-to-speech-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col gap-5 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800/85 pb-4">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Sliders className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-lg text-slate-100">Vocal Synthesizer</h3>
              <p className="font-sans text-xs text-slate-400">Browser speech synthesis — unlimited & free</p>
            </div>
          </div>

          {voices.length > 0 && (
            <div className="flex flex-col gap-2">
              <label htmlFor="voice-select" className="font-sans text-xs font-semibold text-slate-300">
                Voice Selection
              </label>
              <div className="relative">
                <select
                  id="voice-select"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/40 appearance-none cursor-pointer"
                >
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 bg-slate-950 border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-medium text-slate-300">Speech Rate</span>
                <span className="font-mono text-xs text-indigo-400">{speed.toFixed(1)}x</span>
              </div>
              <input
                id="speed-slider"
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-medium text-slate-300">Volume</span>
                <span className="font-mono text-xs text-indigo-400">{(volume * 100).toFixed(0)}%</span>
              </div>
              <input
                id="volume-slider"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <AlignLeft className="h-4.5 w-4.5 text-indigo-400" />
              <h4 className="font-sans font-semibold text-sm text-slate-200">Text to Speak Input</h4>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-sans text-[10px] text-slate-500 font-medium">Samples:</span>
              {sampleTexts.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => { setText(sample.text); setError(null); }}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 hover:border-indigo-500/20 rounded text-[10px] text-slate-400 hover:text-indigo-300 font-sans transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <textarea
              id="tts-input-textarea"
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              className="flex-1 w-full bg-slate-950 border border-slate-800/80 p-4 rounded-2xl text-slate-100 font-sans text-sm focus:outline-none focus:border-indigo-500/50 resize-none leading-relaxed custom-scroll min-h-[200px]"
              placeholder="Type or paste text here to read aloud. Try typing medical directions, signage labels, or general dialogs..."
            />

            {error && (
              <div className="p-3 bg-rose-500/[0.03] border border-rose-500/10 rounded-xl text-rose-400 font-sans text-[11px] mt-3">
                ⚠️ {error}
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-slate-800/80 pt-4 mt-4">
              <button
                id="tts-speak-trigger-btn"
                onClick={handleSpeak}
                disabled={isSpeaking || !text.trim()}
                className="flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 disabled:cursor-not-allowed text-white rounded-2xl font-sans text-sm font-semibold shadow-lg shadow-indigo-600/15 transition-all"
              >
                {isSpeaking ? (
                  <>
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                    Speaking...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4.5 w-4.5" />
                    Synthesize Speech Output
                  </>
                )}
              </button>

              {isSpeaking && (
                <button
                  id="tts-stop-trigger-btn"
                  onClick={handleStop}
                  className="px-4 py-3.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 rounded-2xl font-sans text-sm font-semibold transition-colors"
                >
                  <VolumeX className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
