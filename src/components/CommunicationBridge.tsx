/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Volume2, Mic, Hand, ArrowRight, RefreshCw, Send, Trash2, ShieldAlert } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { BridgeMessage } from "../types";
import { getApiHeaders, callVisionApi } from "../utils/api";

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
    }
  ]);

  const [activeRole, setActiveRole] = useState<'deaf' | 'blind' | 'speech_impaired'>('deaf');
  const [isProcessing, setIsProcessing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Mic state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    speakText(
      "Accessibility Communication Bridge active. Toggle deaf, blind, or speech impaired views to translate conversations between modalities.",
      "system"
    );
    return () => {
      stopMicrophone();
    };
  }, []);

  const addMessage = (
    senderType: BridgeMessage['senderType'],
    originalModality: BridgeMessage['originalModality'],
    originalValue: string,
    translatedModality: BridgeMessage['translatedModality'],
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

  // Scenario A: Deaf user holds up hand gesture, system speaks to blind user
  const handleCaptureDeafSign = async () => {
    const videoElem = document.getElementById("camera-video-element") as any;
    if (!videoElem || !videoElem.captureFrame) {
      setError("Webcam stream is not ready.");
      return;
    }

    const frameData = videoElem.captureFrame();
    if (!frameData) {
      setError("Failed to capture sign frame.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const data = await callVisionApi("gesture", frameData);
      if (data.gesture && data.gesture !== "Unknown") {
        const warning = data.meaning;
        addMessage("deaf_user", "sign_language", `${data.gesture} (Sign)`, "both", warning);
        // Instantly speak out loud so the blind user can hear the deaf user's message
        await speakText(warning, "system");
      } else {
        setError("Sign gesture not recognized clearly. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "";
      const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("exhausted");
      const isTransient = errMsg.includes("503") || errMsg.toLowerCase().includes("unavailable") || errMsg.toLowerCase().includes("busy");

      if (isRateLimit) {
        setError("Rate limit/quota reached. Please try again in 30 seconds to protect your API limits.");
        speakText("Rate limit reached. Please try again in 30 seconds.", "system");
      } else if (isTransient) {
        setError("Gemini servers are busy. Please try again in a few seconds.");
        speakText("Gemini servers busy. Please try again.", "system");
      } else {
        setError(errMsg || "Failed to process sign translation.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Scenario B: Blind user speaks into mic, system types text on screen for deaf/hearing-impaired user
  const startMicrophone = async () => {
    setError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        await transcribeBlindSpeech(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setError("Could not launch microphone for voice input.");
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const transcribeBlindSpeech = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(",")[1];
          const response = await fetch("/api/speech/transcribe", {
            method: "POST",
            headers: getApiHeaders(),
            body: JSON.stringify({ audio: base64Data, mimeType: blob.type }),
          });

          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || "Transcription request failed.");
          }

          const data = await response.json();
          const text = data.text || "";

          if (text.trim()) {
            // Add transcribed text on screen so hearing-impaired users can read it
            addMessage("blind_user", "speech", "Spoken Speech Audio", "text", text);
          } else {
            setError("No verbal words were spoken or detected.");
          }
        } catch (innerErr: any) {
          console.error(innerErr);
          const errMsg = innerErr.message || "";
          const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("exhausted");
          const isTransient = errMsg.includes("503") || errMsg.toLowerCase().includes("unavailable") || errMsg.toLowerCase().includes("busy");

          if (isRateLimit) {
            setError("Transcription failed: Rate limit/quota reached. Please wait a few seconds and try again.");
            speakText("Rate limit reached. Please try again.", "system");
          } else if (isTransient) {
            setError("Transcription failed: Gemini servers busy. Please try again.");
            speakText("Transcription failed. Gemini busy.", "system");
          } else {
            setError(errMsg || "Failed to transcribe audio.");
          }
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (err: any) {
      setError(err.message || "Failed to transcribe audio.");
      setIsProcessing(false);
    }
  };

  // Speech-impaired User typing text, synthesized out loud for others to hear
  const handleSendSpeechImpairedText = async () => {
    if (!typedText.trim()) return;
    setError(null);
    setIsProcessing(true);

    try {
      const messageVal = typedText;
      setTypedText("");
      addMessage("hearing_impaired_user", "text", messageVal, "speech", `Synthesized Vocals: "${messageVal}"`);
      // Speak the typed message out loud
      await speakText(messageVal, "system");
    } catch (err: any) {
      setError("Speech synthesizer failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  const handleSpeakHistoryItem = (val: string) => {
    speakText(val, "system");
  };

  return (
    <div id="comm-bridge-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Pane: Interactive Translators based on current active role */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-5 shadow-xl min-h-[460px]">
          <div className="flex flex-col gap-1 border-b border-slate-800/85 pb-4">
            <h3 className="font-sans font-semibold text-lg text-slate-100 flex items-center gap-2">
              <MessageSquare className="h-5.5 w-5.5 text-indigo-400" />
              Communication Modality Bridge
            </h3>
            <p className="font-sans text-xs text-slate-400">
              Translate cross-disability dialogues with voice, camera, and texts
            </p>
          </div>

          {/* Role selection tab button row */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-850 rounded-2xl">
            <button
              id="role-deaf-btn"
              onClick={() => { setActiveRole('deaf'); setError(null); }}
              className={`py-2.5 text-xs font-sans font-medium rounded-xl transition-all flex flex-col items-center gap-1 ${
                activeRole === 'deaf'
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20 shadow-md'
                  : 'text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <Hand className="h-4 w-4" />
              Deaf User Mode
            </button>
            <button
              id="role-blind-btn"
              onClick={() => { setActiveRole('blind'); setError(null); }}
              className={`py-2.5 text-xs font-sans font-medium rounded-xl transition-all flex flex-col items-center gap-1 ${
                activeRole === 'blind'
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20 shadow-md'
                  : 'text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <Mic className="h-4 w-4" />
              Blind User Mode
            </button>
            <button
              id="role-impaired-btn"
              onClick={() => { setActiveRole('speech_impaired'); setError(null); }}
              className={`py-2.5 text-xs font-sans font-medium rounded-xl transition-all flex flex-col items-center gap-1 ${
                activeRole === 'speech_impaired'
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20 shadow-md'
                  : 'text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Speech Assist
            </button>
          </div>

          {/* Interactive panel depending on selected Tab */}
          <div className="flex-1 flex flex-col">
            {activeRole === 'deaf' && (
              <div id="bridge-deaf-panel" className="flex flex-col gap-4 flex-1">
                <p className="font-sans text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-850">
                  💡 <strong>Scenario A (Deaf User):</strong> Hold up a sign language gesture to the camera. The system translates the sign and speaks it out loud so visually-impaired (blind) companions can hear you!
                </p>
                <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/3] max-h-[220px]">
                  <CameraFeed isActive={activeRole === 'deaf'} className="w-full h-full" />
                </div>
                <button
                  id="bridge-capture-sign-btn"
                  onClick={handleCaptureDeafSign}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 text-white font-semibold rounded-2xl font-sans text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Translating hand gesture...
                    </>
                  ) : (
                    <>
                      <Hand className="h-4 w-4" />
                      Translate Gesture to Speech Output
                    </>
                  )}
                </button>
              </div>
            )}

            {activeRole === 'blind' && (
              <div id="bridge-blind-panel" className="flex flex-col gap-6 justify-center items-center flex-1 py-4">
                <p className="font-sans text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-850 text-left w-full">
                  💡 <strong>Scenario B (Blind User):</strong> Record your voice. The system transcribes the speech to written text on screen, so hearing-impaired companions can read your words instantly!
                </p>
                
                <div className="flex flex-col items-center justify-center my-4">
                  <div className="relative">
                    {isRecording && (
                      <span className="absolute inset-0 rounded-full bg-rose-500/15 animate-ping scale-150" />
                    )}
                    <button
                      id="bridge-mic-btn"
                      onClick={isRecording ? stopMicrophone : startMicrophone}
                      className={`h-20 w-20 rounded-full flex items-center justify-center border transition-all ${
                        isRecording
                          ? "bg-rose-600 border-rose-500 hover:bg-rose-500"
                          : "bg-indigo-600 border-indigo-500 hover:bg-indigo-500"
                      }`}
                    >
                      <Mic className="h-8 w-8 text-white" />
                    </button>
                  </div>
                  <span className="font-sans text-[10px] text-slate-400 font-mono tracking-wider mt-4">
                    {isRecording ? "● RECORDING SPEECH" : "CLICK MIC TO TALK"}
                  </span>
                </div>
              </div>
            )}

            {activeRole === 'speech_impaired' && (
              <div id="bridge-speech-panel" className="flex flex-col gap-4 flex-1">
                <p className="font-sans text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-850">
                  💡 <strong>Speech Assist Mode:</strong> Type your message on screen. The system will synthesize the letters and speak it aloud so nearby people can hear you!
                </p>
                <textarea
                  id="bridge-speech-textarea"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  className="flex-1 w-full bg-slate-950 border border-slate-850 p-4 rounded-2xl text-slate-100 font-sans text-sm focus:outline-none focus:border-indigo-500/40 resize-none min-h-[140px] custom-scroll"
                  placeholder="Type anything here..."
                />
                <button
                  id="bridge-send-speech-btn"
                  onClick={handleSendSpeechImpairedText}
                  disabled={!typedText.trim() || isProcessing}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 text-white font-semibold rounded-2xl font-sans text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Synthesize and Speak Text Aloud
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

      {/* Right Pane: Conversational History Logs */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[460px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <h4 className="font-sans font-semibold text-sm text-slate-200 flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-indigo-400" />
              Bridge Chat History Feed
            </h4>

            {messages.length > 0 && (
              <button
                id="clear-bridge-history-btn"
                onClick={clearHistory}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                title="Clear history feed"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-10">
              <MessageSquare className="h-10 w-10 text-slate-700 mb-3" />
              <p className="font-sans text-xs">No conversation entries</p>
              <p className="font-sans text-[10px] text-slate-600 max-w-xs mt-1">
                Start dialogs using Deaf Sign capturing, Blind user recording, or text synthesized panels.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[380px] custom-scroll">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 border rounded-2xl flex flex-col gap-2 transition-all hover:border-indigo-500/15 ${
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
                        ? "👋 Deaf User (Sign Gesture)"
                        : msg.senderType === "blind_user"
                        ? "🗣️ Blind User (Spoken)"
                        : "📝 Speech Assist (Typed)"}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {msg.timestamp}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-sans text-[10px] text-slate-500 italic">
                        Input: {msg.originalValue}
                      </p>
                      <p className="font-sans text-xs font-semibold text-slate-200 mt-1 leading-relaxed">
                        👉 {msg.translatedValue}
                      </p>
                    </div>

                    <button
                      id={`speak-msg-btn-${msg.id}`}
                      onClick={() => handleSpeakHistoryItem(msg.translatedValue)}
                      className="p-2 bg-slate-900/80 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 border border-slate-800 shrink-0 transition-colors"
                      title="Read back message out loud"
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
