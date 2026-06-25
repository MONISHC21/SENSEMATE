/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, RefObject } from "react";
import { CameraOff, RefreshCw, AlertTriangle, SwitchCamera } from "lucide-react";

interface CameraFeedProps {
  onCapture?: (base64Image: string) => void;
  isActive: boolean;
  className?: string;
  overlayCanvasRef?: RefObject<HTMLCanvasElement | null>;
}

export default function CameraFeed({
  onCapture,
  isActive,
  className = "",
  overlayCanvasRef,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const facingModeRef = useRef<"user" | "environment">("user");

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  useEffect(() => {
    if (isActive) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isActive, facingMode]);

  const startCamera = async (facing: "user" | "environment") => {
    setIsLoading(true);
    setError(null);
    // Stop any existing stream first
    if (videoRef.current && videoRef.current.srcObject) {
      const old = videoRef.current.srcObject as MediaStream;
      old.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: facing },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setError(
        "Could not access the camera. Please ensure camera permissions are granted and no other app is using it."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const flipCamera = () => {
    const next = facingModeRef.current === "user" ? "environment" : "user";
    setFacingMode(next);
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !stream) return null;

    const video = videoRef.current;
    const canvas = internalCanvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Mirror only for front camera
    if (facingModeRef.current === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL("image/jpeg", 0.85);
    if (onCapture) {
      onCapture(base64Image);
    }
    return base64Image;
  };

  useEffect(() => {
    if (videoRef.current) {
      (videoRef.current as any).captureFrame = captureFrame;
      (videoRef.current as any).facingMode = facingMode;
    }
  }, [stream, facingMode]);

  const isFront = facingMode === "user";

  return (
    <div
      id="camera-feed-container"
      className={`relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col justify-center items-center ${className}`}
    >
      <canvas ref={internalCanvasRef} className="hidden" />

      {isLoading && (
        <div id="camera-loading" className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-10 text-slate-300">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-400 mb-4" />
          <p className="font-sans text-sm font-medium">
            {facingMode === "environment" ? "Switching to rear camera..." : "Initializing camera..."}
          </p>
        </div>
      )}

      {error ? (
        <div id="camera-error" className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-950/95 z-10">
          <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
          <h4 className="font-sans font-semibold text-rose-200 mb-2">Camera Unavailable</h4>
          <p className="font-sans text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">{error}</p>
          <button
            id="retry-camera-btn"
            onClick={() => startCamera(facingMode)}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/30 rounded-xl font-sans text-xs font-medium text-rose-200 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : !isActive ? (
        <div id="camera-inactive" className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 z-10">
          <CameraOff className="h-12 w-12 mb-3 text-slate-600" />
          <p className="font-sans text-xs text-slate-500">Camera feed disabled</p>
        </div>
      ) : null}

      {/* Main Video Stream — mirror only for front camera */}
      <video
        id="camera-video-element"
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${isFront ? "scale-x-[-1]" : ""}`}
      />

      {/* Overlay canvas for bounding boxes etc. */}
      {overlayCanvasRef && (
        <canvas
          id="camera-overlay-canvas"
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full z-20 pointer-events-none"
        />
      )}

      {/* Flip camera button — always visible when active */}
      {isActive && !error && (
        <button
          id="flip-camera-btn"
          onClick={flipCamera}
          title={isFront ? "Switch to rear camera" : "Switch to front camera"}
          className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-sm border border-slate-700/70 rounded-xl text-slate-300 hover:text-white transition-all shadow-lg text-[11px] font-sans font-medium"
        >
          <SwitchCamera className="h-4 w-4" />
          {isFront ? "Rear Cam" : "Front Cam"}
        </button>
      )}
    </div>
  );
}
