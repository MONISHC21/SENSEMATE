/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, RefObject } from "react";
import { Camera, CameraOff, RefreshCw, AlertTriangle } from "lucide-react";

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

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
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
        "Could not access the camera. Please make sure camera permissions are granted and no other application is using it."
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

  const captureFrame = (): string | null => {
    if (!videoRef.current || !stream) return null;

    const video = videoRef.current;
    const canvas = internalCanvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Flip horizontally for a more natural mirror effect
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL("image/jpeg", 0.85);
    if (onCapture) {
      onCapture(base64Image);
    }
    return base64Image;
  };

  // Expose capture method globally on the video element's parent if needed,
  // or use the onCapture triggers.
  useEffect(() => {
    if (videoRef.current) {
      (videoRef.current as any).captureFrame = captureFrame;
    }
  }, [stream]);

  return (
    <div
      id="camera-feed-container"
      className={`relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col justify-center items-center ${className}`}
    >
      {/* Hidden helper canvas for frame extraction */}
      <canvas ref={internalCanvasRef} className="hidden" />

      {isLoading && (
        <div id="camera-loading" className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-10 text-slate-300">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-400 mb-4" />
          <p className="font-sans text-sm font-medium">Initializing Webcam stream...</p>
        </div>
      )}

      {error ? (
        <div id="camera-error" className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-950/95 z-10">
          <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
          <h4 className="font-sans font-semibold text-rose-200 mb-2">Camera Unavailable</h4>
          <p className="font-sans text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            {error}
          </p>
          <button
            id="retry-camera-btn"
            onClick={startCamera}
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

      {/* Main Video Stream */}
      <video
        id="camera-video-element"
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]" // Visual mirroring
      />

      {/* Absolute positioning overlays for bounding boxes, overlays */}
      {overlayCanvasRef && (
        <canvas
          id="camera-overlay-canvas"
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full z-20 pointer-events-none"
        />
      )}
    </div>
  );
}
