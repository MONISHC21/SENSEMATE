import { useState, useEffect, useRef } from "react";
import { MessageSquare, Volume2, Mic, MicOff, Hand, Send, Trash2, ShieldAlert, RefreshCw } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { BridgeMessage } from "../types";
import { classifyGesture } from "../utils/gestureEngine";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function CommunicationBridge() {
  const [messages, setMessages] = useState<BridgeMessage[]>([
    {
      id: "1",
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString(),
      senderType: "deaf_user",
      originalModality: "sign_language",
      originalValue: "Thank You (Sign)",
      translatedModality: "both",
      translatedValue: "Thank you for helping me find my prescription.",
    },
    {
      id: "2",
      timestamp: new Date().toLocaleTimeString(),
      senderType: "blind_user",
      originalModality: "speech",
      originalValue: "Spoken Speech Audio",
      translatedModality: "text",
      translatedValue: "You are very welcome! The bottle is on the top shelf.",
    },
  ]);

  const [activeRole, setActiveRole] = useState<"deaf" | "blind" | "speech_impaired">("deaf");
  const [isProcessing, setIsProcessing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    speakText(
      "Accessibility Communication Bridge active. Toggle deaf, blind, or speech impaired views to translate conversations between modalities.",
      "system"
    );

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setLiveTranscript("");
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        if (final.trim()) {
          setLiveTranscript(final.trim());
          addMessage("blind_user", "speech", "Spoken Speech Audio", "text", final.trim());
          setIsListening(false);
        } else {
          setLiveTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "aborted" && event.error !== "no-speech") {
          setError(`Microphone error: ${event.error}. Please try again.`);
        }
        setIsListening(false);
        setLiveTranscript("");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, []);

  const addMessage = (
    senderType: BridgeMessage["senderType"],
    originalModality: BridgeMessage["originalModality"],
    originalValue: string,
    translatedModality: BridgeMessage["translatedModality"],
    translatedValue: string
  ) => {
    const newMessage: BridgeMessage = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      senderType,
      originalModality,
      originalValue,
      translatedModality,
      translatedValue,
    };
    setMessages((prev) => [newMessage, ...prev]);
  };

  // Scenario A: Deaf user shows hand gesture → spoken for blind user
  const handleCaptureDeafSign = async () => {
    const videoElem = document.getElementById("camera-video-element") as HTMLVideoElement;
    if (!videoElem || videoElem.readyState < 2) {
      setError("Webcam stream is not ready. Please wait.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const data = await classifyGesture(videoElem);
      if (data.gesture && data.gesture !== "Unknown") {
        addMessage("deaf_user", "sign_language", `${data.gesture} (Sign)`, "both", data.meaning);
        await speakText(data.meaning, "system");
      } else {
        setError("Gesture not recognized. Show your hand clearly in the frame and try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process sign translation.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Scenario B: Blind user speaks → typed text for deaf user
  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    } else {
      setLiveTranscript("");
      setError(null);
      try { recognitionRef.current.start(); } catch {
        recognitionRef.current.stop();
        setTimeout(() => { try { recognitionRef.current.start(); } catch {} }, 300);
      }
    }
  };

  // Scenario C: Speech-impaired types text → spoken for others
  const handleSendSpeechImpairedText = async () => {
    if (!typedText.trim()) return;
    setError(null);
    setIsProcessing(true);
    try {
      const messageVal = typedText;
      setTypedText("");
      addMessage("hearing_impaired_user", "text", messageVal, "speech", `Synthesized: "${messageVal}"`);
      await speakText(messageVal, "system");
    } catch (err: any) {
      setError("Speech synthesizer failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = () => setMessages([]);

  return (
    <div id="comm-bridge-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-5 shadow-xl min-h-[460px]">
          <div className="flex flex-col gap-1 border-b border-slate-800/85 pb-4">
            <h3 className="font-sans font-semibold text-lg text-slate-100 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              Communication Modality Bridge
            </h3>
            <p className="font-sans text-xs text-slate-400">
              Offline AI — gesture, speech & text across all disabilities
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-2xl">
            {(["deaf", "blind", "speech_impaired"] as const).map((role) => {
              const labels: Record<typeof role, { label: string; icon: any }> = {
                deaf: { label: "Deaf User", icon: Hand },
                blind: { label: "Blind User", icon: Mic },
                speech_impaired: { label: "Speech Assist", icon: MessageSquare },
              };
              const Icon = labels[role].icon;
              return (
                <button
                  key={role}
                  id={`role-${role}-btn`}
                  onClick={() => { setActiveRole(role); setError(null); }}
                  className={`py-2.5 text-xs font-sans font-medium rounded-xl transition-all flex flex-col items-center gap-1 ${
                    activeRole === role
                      ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/20 shadow-md"
                      : "text-slate-400 border border-transparent hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {labels[role].label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col">
            {activeRole === "deaf" && (
              <div id="bridge-deaf-panel" className="flex flex-col gap-4 flex-1">
                <p className="font-sans text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  💡 <strong>Deaf User Mode:</strong> Show a hand gesture. The AI classifies it and speaks it aloud for blind companions — all offline via MediaPipe Hands.
                </p>
                <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/3] max-h-[220px]">
                  <CameraFeed isActive={activeRole === "deaf"} className="w-full h-full" />
                </div>
                <button
                  id="bridge-capture-sign-btn"
                  onClick={handleCaptureDeafSign}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 text-white font-semibold rounded-2xl font-sans text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Classifying gesture...</>
                  ) : (
                    <><Hand className="h-4 w-4" /> Translate Gesture to Speech</>
                  )}
                </button>
              </div>
            )}

            {activeRole === "blind" && (
              <div id="bridge-blind-panel" className="flex flex-col gap-4 justify-between flex-1 py-2">
                <p className="font-sans text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  💡 <strong>Blind User Mode:</strong> Press the mic and speak. Your words are transcribed instantly on-screen for deaf/hearing-impaired companions — using the Web Speech API.
                </p>

                <div className="flex flex-col items-center justify-center gap-4 flex-1">
                  <div className="relative">
                    {isListening && (
                      <span className="absolute inset-0 rounded-full bg-rose-500/15 animate-ping scale-150" />
                    )}
                    <button
                      id="bridge-mic-btn"
                      onClick={toggleListening}
                      className={`h-20 w-20 rounded-full flex items-center justify-center border transition-all ${
                        isListening
                          ? "bg-rose-600 border-rose-500 hover:bg-rose-500"
                          : "bg-indigo-600 border-indigo-500 hover:bg-indigo-500"
                      }`}
                    >
                      {isListening ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
                    </button>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 tracking-wider">
                    {isListening ? "● LISTENING — speak now" : "CLICK MIC TO SPEAK"}
                  </span>
                  {liveTranscript && (
                    <div className="w-full px-3 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-indigo-300 text-xs font-sans italic text-center">
                      "{liveTranscript}..."
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeRole === "speech_impaired" && (
              <div id="bridge-speech-panel" className="flex flex-col gap-4 flex-1">
                <p className="font-sans text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  💡 <strong>Speech Assist Mode:</strong> Type your message. The system synthesizes it aloud via the browser Speech Synthesis API — instant, offline, unlimited.
                </p>
                <textarea
                  id="bridge-speech-textarea"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  className="flex-1 w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-slate-100 font-sans text-sm focus:outline-none focus:border-indigo-500/40 resize-none min-h-[140px] custom-scroll"
                  placeholder="Type anything here — press Send to speak it aloud..."
                />
                <button
                  id="bridge-send-speech-btn"
                  onClick={handleSendSpeechImpairedText}
                  disabled={!typedText.trim() || isProcessing}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 text-white font-semibold rounded-2xl font-sans text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Synthesize and Speak Aloud
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-500/[0.03] border border-rose-500/10 rounded-xl text-rose-400 font-sans text-[11px] mt-4 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[460px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <h4 className="font-sans font-semibold text-sm text-slate-200 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              Bridge Chat History
            </h4>
            {messages.length > 0 && (
              <button
                id="clear-bridge-history-btn"
                onClick={clearHistory}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                title="Clear history"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-10">
              <MessageSquare className="h-10 w-10 text-slate-700 mb-3" />
              <p className="font-sans text-xs">No conversations yet</p>
              <p className="font-sans text-[10px] text-slate-600 max-w-xs mt-1">
                Use Deaf Sign, Blind Voice, or Speech Assist panels above to start bridging.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[380px] custom-scroll">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 border rounded-2xl flex flex-col gap-2 hover:border-indigo-500/15 transition-all ${
                    msg.senderType === "deaf_user"
                      ? "bg-indigo-950/10 border-indigo-500/20"
                      : msg.senderType === "blind_user"
                      ? "bg-slate-950 border-slate-800"
                      : "bg-emerald-950/10 border-emerald-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {msg.senderType === "deaf_user"
                        ? "👋 Deaf User (Gesture)"
                        : msg.senderType === "blind_user"
                        ? "🗣️ Blind User (Voice)"
                        : "📝 Speech Assist (Typed)"}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">{msg.timestamp}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-sans text-[10px] text-slate-500 italic">Input: {msg.originalValue}</p>
                      <p className="font-sans text-xs font-semibold text-slate-200 mt-1 leading-relaxed">
                        👉 {msg.translatedValue}
                      </p>
                    </div>
                    <button
                      id={`speak-msg-btn-${msg.id}`}
                      onClick={() => speakText(msg.translatedValue, "system")}
                      className="p-2 bg-slate-900/80 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 border border-slate-800 shrink-0 transition-colors"
                      title="Read aloud"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
