import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, RefreshCw, Volume2, Trash2, Clipboard, Check, HelpCircle, Sparkles, WifiOff } from "lucide-react";
import { speakText } from "../utils/speech";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function SpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [statusMessage, setStatusMessage] = useState("Click the microphone button to start listening.");
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    speakText(
      "Speech-to-text activated. Click the microphone button and speak clearly to transcribe audio into readable text.",
      "system"
    );

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setIsSupported(false);
      setError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage("Listening... Speak clearly into your microphone.");
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      if (final) {
        setTranscribedText((prev) => (prev ? prev + " " + final.trim() : final.trim()));
        setInterimText("");
        setStatusMessage("Speech recognized. Keep talking or stop when done.");
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setStatusMessage("No speech detected. Please speak clearly.");
        return;
      }
      if (event.error === "aborted") return;
      setError(`Recognition error: ${event.error}. Please try again.`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      setStatusMessage("Stopped listening. Click microphone to continue.");
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setError(null);
      try {
        recognitionRef.current.start();
      } catch {
        // Already started — restart
        recognitionRef.current.stop();
        setTimeout(() => {
          try { recognitionRef.current.start(); } catch {}
        }, 300);
      }
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(transcribedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSpeakText = () => {
    if (!transcribedText) return;
    speakText(transcribedText, "system");
  };

  const handleClearText = () => {
    setTranscribedText("");
    setInterimText("");
    setError(null);
    setStatusMessage("Click the microphone button to start listening.");
  };

  const displayText = transcribedText + (interimText ? " " + interimText : "");

  return (
    <div id="speech-to-text-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center text-center gap-6 shadow-xl min-h-[380px]">
          <div className="w-full flex items-center gap-3 border-b border-slate-800/85 pb-4 mb-2 text-left">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Mic className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-lg text-slate-100">Speech Translator</h3>
              <p className="font-sans text-xs text-slate-400">Browser Web Speech API — real-time & unlimited</p>
            </div>
          </div>

          {!isSupported ? (
            <div className="flex flex-col items-center gap-3 text-slate-500 py-6">
              <WifiOff className="h-10 w-10 text-rose-500" />
              <p className="font-sans text-xs text-rose-400 max-w-xs text-center leading-relaxed">
                Speech recognition requires Chrome, Edge, or Safari. Please switch browsers.
              </p>
            </div>
          ) : (
            <>
              <div className="relative flex items-center justify-center my-4">
                {isListening && (
                  <>
                    <span className="absolute h-28 w-28 rounded-full bg-rose-500/10 animate-ping" />
                    <span className="absolute h-24 w-24 rounded-full bg-rose-500/20 animate-pulse" />
                  </>
                )}
                <button
                  id="mic-recording-toggle-btn"
                  onClick={toggleListening}
                  className={`relative h-20 w-20 rounded-full flex items-center justify-center border transition-all ${
                    isListening
                      ? "bg-rose-600 border-rose-500 hover:bg-rose-500 shadow-lg shadow-rose-600/20"
                      : "bg-indigo-600 border-indigo-500 hover:bg-indigo-500 shadow-lg shadow-indigo-600/15"
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-8 w-8 text-white" />
                  ) : (
                    <Mic className="h-8 w-8 text-white" />
                  )}
                </button>
              </div>

              <div className="flex flex-col gap-1 w-full px-4">
                <span
                  id="speech-status-text"
                  className={`font-sans text-xs font-semibold uppercase tracking-wider ${
                    isListening ? "text-rose-400" : "text-indigo-400"
                  }`}
                >
                  {isListening ? "● LISTENING LIVE" : "MIC READY"}
                </span>
                <p className="font-sans text-xs text-slate-300 italic max-w-xs mx-auto mt-2 leading-relaxed">
                  "{statusMessage}"
                </p>
              </div>

              {interimText && (
                <div className="w-full px-3 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-indigo-300 text-xs font-sans italic text-left">
                  {interimText}...
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
              <h4 className="font-sans font-semibold text-sm text-slate-200">
                Transcribed Written Speech
              </h4>
            </div>

            {transcribedText && (
              <div className="flex items-center gap-2">
                <button
                  id="speak-back-btn"
                  onClick={handleSpeakText}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                  title="Speak transcript aloud"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                <button
                  id="copy-transcript-btn"
                  onClick={handleCopyText}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                  title="Copy to clipboard"
                >
                  {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
                </button>
                <button
                  id="clear-transcript-btn"
                  onClick={handleClearText}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                  title="Clear transcript"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-between">
            {error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-500/80 p-5 border border-rose-500/10 rounded-2xl bg-rose-500/[0.02]">
                <HelpCircle className="h-8 w-8 mb-2 text-rose-500" />
                <p className="font-sans text-xs font-semibold">Recognition Error</p>
                <p className="font-sans text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">{error}</p>
              </div>
            ) : !displayText ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-10">
                <Mic className="h-10 w-10 text-slate-700 mb-3 animate-pulse" />
                <p className="font-sans text-xs">Transcript empty</p>
                <p className="font-sans text-[10px] text-slate-600 max-w-sm mt-1 leading-relaxed">
                  Press the microphone button, speak clearly, and your words will appear here in real-time.
                </p>
              </div>
            ) : (
              <textarea
                id="transcription-output-textarea"
                value={displayText}
                onChange={(e) => setTranscribedText(e.target.value)}
                className="flex-1 w-full bg-slate-950 border border-slate-800/80 p-4 rounded-2xl text-slate-100 font-sans text-sm focus:outline-none focus:border-indigo-500/50 resize-none leading-relaxed custom-scroll"
                placeholder="Spoken words will appear here..."
              />
            )}

            {transcribedText && (
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-4">
                <span className="font-sans text-[10px] text-slate-500 font-mono">
                  Characters: {transcribedText.length} | Words: {transcribedText.split(/\s+/).filter(Boolean).length}
                </span>
                <button
                  id="speak-response-bridge-btn"
                  onClick={handleSpeakText}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-xl text-xs font-sans font-medium transition-colors"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Convert back to speech
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
