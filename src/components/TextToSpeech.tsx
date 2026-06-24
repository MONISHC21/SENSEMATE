/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Volume2, VolumeX, Sparkles, RefreshCw, Sliders, ChevronDown, AlignLeft } from "lucide-react";
import { speakText } from "../utils/speech";

export default function TextToSpeech() {
  const [text, setText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'system' | 'premium'>('premium');
  const [premiumVoice, setPremiumVoice] = useState<string>('Zephyr');
  
  // Controls
  const [speed, setSpeed] = useState<number>(1.0); // 0.5 to 2.0
  const [volume, setVolume] = useState<number>(1.0); // 0.0 to 1.0
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    speakText(
      "Text to speech translator activated. Enter text, choose your voice settings, and hear natural speech feedback.",
      "system"
    );
  }, []);

  const handleSpeak = async () => {
    if (!text.trim()) {
      setError("Please input some text before requesting translation.");
      return;
    }

    setIsSpeaking(true);
    setError(null);

    try {
      await speakText(text, voiceMode, {
        rate: speed,
        volume: volume,
        voiceName: premiumVoice,
      });
    } catch (err: any) {
      console.error(err);
      setError("Failed to synthesize speech audio. Falling back to default system voice.");
      // Fallback
      await speakText(text, 'system', { rate: speed, volume });
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleStop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const sampleTexts = [
    { label: "Instruction Booklet", text: "Take one tablet of Ibuprofen with food every eight hours. Do not exceed three tablets in twenty-four hours." },
    { label: "Transit Sign", text: "Caution. Platform wet. Please wait behind the yellow line for the approaching train." },
    { label: "Greeting Bridge", text: "Hello! Welcome to SRM Institute of Science and Technology. It is an honor to assist you today with our SenseMate companion." }
  ];

  return (
    <div id="text-to-speech-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Settings Panel */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col gap-5 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800/85 pb-4">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Sliders className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-lg text-slate-100">Vocal Synthesizer</h3>
              <p className="font-sans text-xs text-slate-400">Configure speed, volume, and engines</p>
            </div>
          </div>

          {/* Engine Mode */}
          <div className="flex flex-col gap-2">
            <span className="font-sans text-xs font-semibold text-slate-300">Speech Engine</span>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 border border-slate-800 rounded-xl">
              <button
                id="tts-engine-system"
                onClick={() => setVoiceMode('system')}
                className={`py-2 text-xs font-sans font-medium rounded-lg transition-colors border ${
                  voiceMode === 'system'
                    ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/20'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                Browser Synthesis
              </button>
              <button
                id="tts-engine-premium"
                onClick={() => setVoiceMode('premium')}
                className={`py-2 text-xs font-sans font-medium rounded-lg transition-colors border ${
                  voiceMode === 'premium'
                    ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/20'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                ⭐ Premium AI (Gemini)
              </button>
            </div>
          </div>

          {/* Voice select if Premium */}
          {voiceMode === 'premium' && (
            <div className="flex flex-col gap-2">
              <label htmlFor="premium-voice-select-v2" className="font-sans text-xs font-semibold text-slate-300">
                Premium AI Voice Tone
              </label>
              <div className="relative">
                <select
                  id="premium-voice-select-v2"
                  value={premiumVoice}
                  onChange={(e) => setPremiumVoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/40 appearance-none cursor-pointer"
                >
                  <option value="Zephyr">Zephyr (Warm & Professional)</option>
                  <option value="Kore">Kore (Clear & Formal)</option>
                  <option value="Puck">Puck (Cheerful & Energetic)</option>
                  <option value="Charon">Charon (Deeps & Calm)</option>
                  <option value="Fenrir">Fenrir (Relaxed & Natural)</option>
                </select>
                <ChevronDown className="absolute right-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Controls Sliders */}
          <div className="flex flex-col gap-4 bg-slate-950 border border-slate-800/80 p-4 rounded-2xl">
            {/* Speed / Rate */}
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
                disabled={voiceMode === 'premium'} // Premium model has fixed natural speech speed
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-45"
              />
              {voiceMode === 'premium' && (
                <span className="font-sans text-[9px] text-slate-500 block leading-tight mt-0.5">
                  *AI voices utilize optimal natural neural speeds.
                </span>
              )}
            </div>

            {/* Volume */}
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

      {/* Right: Text Input & Synthesize */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <AlignLeft className="h-4.5 w-4.5 text-indigo-400" />
              <h4 className="font-sans font-semibold text-sm text-slate-200">
                Text to Speak Input
              </h4>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-sans text-[10px] text-slate-500 font-medium">Insert Quick Sample:</span>
              {sampleTexts.map((sample, idx) => (
                <button
                  key={idx}
                  id={`sample-text-btn-${idx}`}
                  onClick={() => { setText(sample.text); setError(null); }}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 hover:border-indigo-500/20 rounded text-[10px] text-slate-400 hover:text-indigo-300 font-sans transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            {isSpeaking && voiceMode === 'premium' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-500">
                <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                <p className="font-sans text-xs">Generating Premium Neural Speech...</p>
                <p className="font-sans text-[10px] text-slate-600 max-w-xs">
                  We are using gemini-3.1-flash-tts-preview to compile realistic human audio waves.
                </p>
              </div>
            ) : (
              <textarea
                id="tts-input-textarea"
                value={text}
                onChange={(e) => { setText(e.target.value); setError(null); }}
                className="flex-1 w-full bg-slate-950 border border-slate-800/80 p-4 rounded-2xl text-slate-100 font-sans text-sm focus:outline-none focus:border-indigo-500/50 resize-none leading-relaxed custom-scroll"
                placeholder="Type or paste text here to read aloud. Try typing medical directions, signage labels, or general dialogs..."
              />
            )}

            {error && (
              <div className="p-3 bg-rose-500/[0.03] border border-rose-500/10 rounded-xl text-rose-400 font-sans text-[11px] mt-3">
                ⚠️ {error}
              </div>
            )}

            {/* Speaking playback triggers */}
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
                    Synthesizing Vocal...
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
