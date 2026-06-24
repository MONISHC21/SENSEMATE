import { useState, useEffect, useRef, ChangeEvent, DragEvent } from "react";
import { FileText, Volume2, VolumeX, Copy, Check, Upload, Camera, HelpCircle, RefreshCw } from "lucide-react";
import CameraFeed from "./CameraFeed";
import { speakText } from "../utils/speech";
import { extractText } from "../utils/ocrEngine";

export default function OCRReader() {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<'camera' | 'upload'>('camera');

  const [extractedText, setExtractedText] = useState<string>("");
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    speakText(
      "OCR reader activated. Capture printed materials like medicine labels, restaurant menus, or documents to hear them read aloud.",
      "system"
    );
    setIsActive(true);
    return () => {
      setIsActive(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const handleCaptureAndExtract = async () => {
    const videoElem = document.getElementById("camera-video-element") as HTMLVideoElement;
    if (!videoElem || videoElem.readyState < 2) {
      setError("Camera is not ready yet. Please wait a moment for the webcam to start.");
      return;
    }
    const w = videoElem.videoWidth || 640;
    const h = videoElem.videoHeight || 480;
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext("2d");
    if (!ctx) { setError("Failed to create capture canvas."); return; }
    ctx.drawImage(videoElem, 0, 0, w, h);
    const frameData = tmp.toDataURL("image/jpeg", 0.9);
    setCapturedImage(frameData);
    await processOCR(frameData);
  };

  const processOCR = async (base64Image: string) => {
    setIsProcessing(true);
    setOcrProgress(0);
    setError(null);
    setExtractedText("");
    setConfidenceScore(null);

    try {
      const { extractedText: text, confidenceScore: score } = await extractText(
        base64Image,
        (pct) => setOcrProgress(pct)
      );

      if (!text.trim()) {
        setExtractedText("⚠️ No legible text could be extracted. Please ensure the document is well-lit and held close to the camera.");
        setConfidenceScore(0);
        speakText("No legible text detected. Please try holding the document closer or improving the lighting.", "system");
        return;
      }

      setExtractedText(text);
      setConfidenceScore(score);

      setIsSpeaking(true);
      await speakText(text, "system");
      setIsSpeaking(false);
    } catch (err: any) {
      setError(err.message || "Failed to analyze image text. Please try again.");
    } finally {
      setIsProcessing(false);
      setOcrProgress(0);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = reader.result as string;
      setCapturedImage(resultStr);
      processOCR(resultStr);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent) => e.preventDefault();

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultStr = reader.result as string;
        setCapturedImage(resultStr);
        processOCR(resultStr);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleSpeak = async () => {
    if (isSpeaking) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      if (!extractedText) return;
      setIsSpeaking(true);
      await speakText(extractedText, "system");
      setIsSpeaking(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(extractedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div id="ocr-reader-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/85 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <FileText className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-lg text-slate-100">OCR Document Reader</h3>
                <p className="font-sans text-xs text-slate-400">Tesseract.js — 100% offline text extraction</p>
              </div>
            </div>
            <div className="flex items-center bg-slate-950 p-1 border border-slate-800 rounded-xl">
              <button
                id="source-camera-tab"
                onClick={() => { setSourceMode('camera'); setCapturedImage(null); }}
                className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${sourceMode === 'camera' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-400 border border-transparent hover:text-slate-200'}`}
              >
                Webcam
              </button>
              <button
                id="source-upload-tab"
                onClick={() => { setSourceMode('upload'); setCapturedImage(null); }}
                className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${sourceMode === 'upload' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-400 border border-transparent hover:text-slate-200'}`}
              >
                Upload File
              </button>
            </div>
          </div>

          {sourceMode === 'camera' ? (
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              {capturedImage ? (
                <div className="relative w-full h-full">
                  <img src={capturedImage} alt="Captured preview" className="w-full h-full object-cover" />
                  <button
                    id="recapture-btn"
                    onClick={() => setCapturedImage(null)}
                    className="absolute bottom-4 right-4 bg-slate-900/85 hover:bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 backdrop-blur-sm"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Reset Camera
                  </button>
                </div>
              ) : (
                <CameraFeed isActive={isActive} className="w-full h-full" />
              )}
            </div>
          ) : (
            <div
              id="drop-zone-area"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="relative aspect-[4/3] border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors"
            >
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              {capturedImage ? (
                <div className="absolute inset-0 p-2">
                  <img src={capturedImage} alt="Uploaded text preview" className="w-full h-full object-contain rounded-xl" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-slate-900/80 rounded-full border border-slate-800">
                    <Upload className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-sans font-medium text-xs text-slate-200">Drag and drop document image</p>
                    <p className="font-sans text-[10px] text-slate-500 mt-1">Supports PNG, JPG, JPEG, WebP</p>
                  </div>
                  <span className="mt-2 text-[10px] bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full font-medium">
                    Or click to browse files
                  </span>
                </div>
              )}
            </div>
          )}

          {sourceMode === 'camera' && !capturedImage && (
            <button
              id="capture-ocr-btn"
              onClick={handleCaptureAndExtract}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 disabled:cursor-not-allowed text-white rounded-2xl font-sans text-sm font-semibold shadow-lg shadow-indigo-600/15 transition-all"
            >
              {isProcessing ? (
                <><RefreshCw className="h-5 w-5 animate-spin" /> Processing with Tesseract... {ocrProgress > 0 ? `${ocrProgress}%` : ''}</>
              ) : (
                <><FileText className="h-5 w-5" /> Capture and Read Aloud</>
              )}
            </button>
          )}

          {capturedImage && !isProcessing && (
            <button
              id="re-read-btn"
              onClick={() => { if (capturedImage) processOCR(capturedImage); }}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-2xl font-sans text-sm font-medium transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Re-Scan Captured Image
            </button>
          )}
        </div>
      </div>

      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col flex-1 shadow-lg min-h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              <h4 className="font-sans font-semibold text-sm text-slate-200">Extracted Text Contents</h4>
            </div>
            {confidenceScore !== null && (
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                <span className="font-sans text-[9px] text-slate-500 uppercase tracking-widest">Confidence</span>
                <span className="font-mono text-xs font-semibold text-indigo-400">{confidenceScore}%</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-4">
            {isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-500">
                <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                <p className="font-sans text-xs">Tesseract.js analyzing document text...</p>
                {ocrProgress > 0 && (
                  <div className="w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                )}
                <p className="font-sans text-[10px] text-slate-600 max-w-xs">
                  All processing happens in your browser — private & unlimited.
                </p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-500/80 p-4 border border-rose-500/10 rounded-2xl bg-rose-500/[0.02]">
                <HelpCircle className="h-8 w-8 mb-2 text-rose-500" />
                <p className="font-sans text-xs font-semibold">OCR Process Interrupted</p>
                <p className="font-sans text-[11px] text-slate-400 mt-1 leading-relaxed">{error}</p>
              </div>
            ) : !extractedText ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
                <FileText className="h-10 w-10 text-slate-700 mb-3 animate-pulse" />
                <p className="font-sans text-xs">Awaiting captured image</p>
                <p className="font-sans text-[10px] text-slate-600 max-w-sm mt-1 leading-relaxed">
                  Use the camera to capture a document, label, or sign — or upload an image file.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4 h-full justify-between">
                <div id="ocr-scroller" className="flex-1 overflow-y-auto max-h-[300px] bg-slate-950 border border-slate-800/80 p-4 rounded-2xl text-slate-300 leading-relaxed text-sm whitespace-pre-line font-sans custom-scroll">
                  {extractedText}
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-auto">
                  <button
                    id="ocr-playback-btn"
                    onClick={handleToggleSpeak}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-sans text-xs font-medium transition-colors ${isSpeaking ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
                  >
                    {isSpeaking ? (
                      <><VolumeX className="h-3.5 w-3.5" /> Stop Playback</>
                    ) : (
                      <><Volume2 className="h-3.5 w-3.5" /> Read Aloud</>
                    )}
                  </button>
                  <button
                    id="copy-text-btn"
                    onClick={handleCopyText}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-sans font-medium transition-colors"
                  >
                    {isCopied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Extracted</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
