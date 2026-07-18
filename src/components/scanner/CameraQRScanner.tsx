"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera, Flashlight, QrCode } from "lucide-react";

interface CameraQRScannerProps {
  onScan: (result: string) => void;
  onClose?: () => void;
  title?: string;
  description?: string;
}

export function CameraQRScanner({ onScan, onClose, title, description }: CameraQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const html5QrRef = useRef<any>(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [scanned, setScanned] = useState(false);

  const startCamera = useCallback(async () => {
    setError(null);
    setScanned(false);

    try {
      // Try using html5-qrcode library for better scanning
      const { Html5Qrcode } = await import("html5-qrcode");

      const scanner = new Html5Qrcode("qr-reader-container");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Success
          setScanned(true);
          onScan(decodedText);
          // Vibrate on successful scan
          if (navigator.vibrate) navigator.vibrate(200);
          stopCamera();
        },
        () => {
          // QR code not found in frame — ignore
        }
      );

      setActive(true);
    } catch (e) {
      console.error("Camera error:", e);
      setError(
        e instanceof Error
          ? e.message.includes("Permission")
            ? "Camera permission denied. Please allow camera access."
            : e.message
          : "Failed to start camera"
      );
    }
  }, [facingMode, onScan]);

  const stopCamera = useCallback(() => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current.clear();
      html5QrRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setActive(false);
  }, []);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-black shadow-xl">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {title || "Scan QR Code"}
          </h3>
          {description && (
            <p className="text-xs text-white/60">{description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={switchCamera}
          >
            <SwitchCamera className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => { stopCamera(); onClose(); }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Camera View */}
      <div className="relative aspect-square w-full">
        <div id="qr-reader-container" className="h-full w-full" />

        {/* Scan Frame Overlay */}
        {active && !scanned && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="relative h-60 w-60">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 h-8 w-8 border-l-3 border-t-3 border-cyan-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 h-8 w-8 border-r-3 border-t-3 border-cyan-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 h-8 w-8 border-l-3 border-b-3 border-cyan-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 h-8 w-8 border-r-3 border-b-3 border-cyan-400 rounded-br-lg" />
              {/* Scan line animation */}
              <div className="absolute inset-x-4 top-4 h-0.5 animate-[scan_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            </div>
          </div>
        )}

        {/* Success overlay */}
        {scanned && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 animate-in zoom-in">
                <QrCode className="h-8 w-8 text-white" />
              </div>
              <p className="text-lg font-semibold text-white">QR Code Scanned!</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-6">
            <div className="text-center space-y-3">
              <Camera className="mx-auto h-12 w-12 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="text-white border-white/30 hover:bg-white/10"
                onClick={startCamera}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Hidden elements for fallback */}
        <video ref={videoRef} className="hidden" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Footer hint */}
      <div className="bg-gradient-to-t from-black/70 to-transparent p-3 text-center">
        <p className="text-xs text-white/50">
          Point your camera at the booking QR code
        </p>
      </div>

      {/* Scan line animation style */}
      <style jsx global>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(220px); }
        }
      `}</style>
    </div>
  );
}
