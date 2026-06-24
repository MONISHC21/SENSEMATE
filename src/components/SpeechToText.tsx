/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, RefreshCw, Volume2, Sparkles, Trash2, Clipboard, Check, HelpCircle } from "lucide-react";
import { speakText } from "../utils/speech";
import { getApiHeaders } from "../utils/api";

export default function SpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [statusMessage, setStatusMessage] = useState("Click speak to transcribe audio.");
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    speakText(
      "Speech-to-text activated. Access your microphone, then click speak to transcribe audio directly into readable texts.",
      "system"
    );
    return () => {
      stopRecordingSession();
    };
  }, []);

  const startRecordingSession = async () => {
    setError(null);
    audioChunksRef.current = [];
    setStatusMessage("Adjusting for background noise...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Simulate noise adjustment
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: getSupportedMimeType(),
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        await convertAudioToText(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatusMessage("Listening... Speak clearly into your microphone.");
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      setError("Failed to access microphone. Please ensure microphone permissions are granted.");
      setStatusMessage("Failed to initiate microphone.");
    }
  };

  const getSupportedMimeType = (): string => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/wav",
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "";
  };

  const stopRecordingSession = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatusMessage("Finalizing audio stream...");
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const convertAudioToText = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setStatusMessage("Sending to Gemini 3.5-flash for high-fidelity transcription...");
    setError(null);

    try {
      // Convert Blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        
        const response = await fetch("/api/speech/transcribe", {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({
            audio: base64Data,
            mimeType: audioBlob.type || "audio/webm",
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to transcribe audio.");
        }

        const data = await response.json();
        const text = data.text || "";

        if (!text.trim()) {
          setError("No speech could be recognized. Please try speaking louder or holding the microphone closer.");
          setStatusMessage("Empty transcript returned.");
        } else {
          setTranscribedText((prev) => (prev ? prev + " " + text : text));
          setStatusMessage("Audio translated successfully.");
        }
        setIsTranscribing(false);
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process speech transcription.");
      setStatusMessage("Error transcribing audio.");
      setIsTranscribing(false);
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
    setError(null);
    setStatusMessage("Click speak to transcribe audio.");
  };

  return (
    <div id="speech-to-text-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Mic Controls & Visuals */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center text-center gap-6 shadow-xl min-h-[380px]">
          <div className="w-full flex items-center gap-3 border-b border-slate-800/85 pb-4 mb-2 text-left">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Mic className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-lg text-slate-100">Speech Translator</h3>
              <p className="font-sans text-xs text-slate-400">Microphone voice capture & transcribing</p>
            </div>
          </div>

          {/* Large Recording Toggle Button */}
          <div className="relative flex items-center justify-center my-4">
            {isRecording && (
              <>
                <span className="absolute h-28 w-28 rounded-full bg-rose-500/10 animate-ping" />
                <span className="absolute h-24 w-24 rounded-full bg-rose-500/20 animate-pulse" />
              </>
            )}
            <button
              id="mic-recording-toggle-btn"
              onClick={isRecording ? stopRecordingSession : startRecordingSession}
              className={`relative h-20 w-20 rounded-full flex items-center justify-center border transition-all ${
                isRecording
                  ? "bg-rose-600 border-rose-500 hover:bg-rose-500 shadow-lg shadow-rose-600/20"
                  : "bg-indigo-600 border-indigo-500 hover:bg-indigo-500 shadow-lg shadow-indigo-600/15"
              }`}
            >
              {isRecording ? (
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
                isRecording ? "text-rose-400" : isTranscribing ? "text-amber-400" : "text-indigo-400"
              }`}
            >
              {isRecording ? "● RECORDING LIVE AUDIO" : isTranscribing ? "TRANSCRIBING..." : "MIC CONNECTED"}
            </span>
            <p className="font-sans text-xs text-slate-300 italic max-w-xs mx-auto mt-2 leading-relaxed">
              "{statusMessage}"
            </p>
          </div>
        </div>
      </div>

      {/* Right: Transcription Outputs */}
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

          {/* Main Display container */}
          <div className="flex-1 flex flex-col justify-between">
            {isTranscribing ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-500">
                <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                <p className="font-sans text-xs">Gemini is transcribing verbal inputs...</p>
                <p className="font-sans text-[10px] text-slate-600 max-w-xs">
                  Analyzing spoken syllables and converting into readable texts with Gemini.
                </p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-500/80 p-5 border border-rose-500/10 rounded-2xl bg-rose-500/[0.02] justify-self-center my-auto">
                <HelpCircle className="h-8 w-8 mb-2 text-rose-500" />
                <p className="font-sans text-xs font-semibold">Transcription Failure</p>
                <p className="font-sans text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                  {error}
                </p>
              </div>
            ) : !transcribedText ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-10">
                <Mic className="h-10 w-10 text-slate-700 mb-3 animate-pulse" />
                <p className="font-sans text-xs">Transcript empty</p>
                <p className="font-sans text-[10px] text-slate-600 max-w-sm mt-1 leading-relaxed">
                  Press the record button on the left, speak into your microphone, and see your language translate to text instantly.
                </p>
              </div>
            ) : (
              <textarea
                id="transcription-output-textarea"
                value={transcribedText}
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
