"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera, QrCode } from "lucide-react";

interface CameraQRScannerProps {
  onScan: (result: string) => void;
  onClose?: () => void;
  title?: string;
  description?: string;
}

export function CameraQRScanner({ onScan, onClose, title, description }: CameraQRScannerProps) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [scanned, setScanned] = useState(false);

  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState?.();
        // Only stop if scanner is in scanning state (state 2)
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {
      // Silently handle — scanner may already be stopped
      scannerRef.current = null;
    }
    if (mountedRef.current) setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!mountedRef.current) return;
    setError(null);
    setScanned(false);

    // Wait for DOM element
    await new Promise((r) => setTimeout(r, 100));

    if (!mountedRef.current) return;
    const containerId = "qr-reader-container";
    const el = document.getElementById(containerId);
    if (!el) {
      setError("Scanner container not found");
      return;
    }

    // Clean up any existing scanner
    await stopCamera();

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mountedRef.current) return;

      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        (decodedText) => {
          if (!mountedRef.current) return;
          setScanned(true);
          onScanRef.current(decodedText);
          if (navigator.vibrate) navigator.vibrate(200);
          // Stop after successful scan
          scanner.stop().catch(() => {});
        },
        () => { /* QR not found in frame — ignore */ }
      );

      if (mountedRef.current) setActive(true);
    } catch (e) {
      if (!mountedRef.current) return;
      console.error("Camera error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (msg.includes("NotFoundError") || msg.includes("no camera")) {
        setError("No camera found on this device.");
      } else if (msg.includes("NotReadableError")) {
        setError("Camera is in use by another app. Close other apps and try again.");
      } else {
        setError(msg || "Failed to start camera");
      }
    }
  }, [facingMode, stopCamera]);

  const switchCamera = useCallback(async () => {
    await stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-black shadow-xl">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{title || "Scan QR Code"}</h3>
          {description && <p className="text-xs text-white/60">{description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={switchCamera}>
            <SwitchCamera className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => { stopCamera(); onClose(); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Camera View */}
      <div className="relative aspect-square w-full" ref={containerRef}>
        <div id="qr-reader-container" className="h-full w-full" />

        {/* Scan Frame Overlay */}
        {active && !scanned && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="relative h-56 w-56">
              <div className="absolute top-0 left-0 h-8 w-8 border-l-[3px] border-t-[3px] border-cyan-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 h-8 w-8 border-r-[3px] border-t-[3px] border-cyan-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 h-8 w-8 border-l-[3px] border-b-[3px] border-cyan-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 h-8 w-8 border-r-[3px] border-b-[3px] border-cyan-400 rounded-br-lg" />
              <div className="absolute inset-x-4 top-4 h-0.5 animate-scan bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            </div>
          </div>
        )}

        {/* Success overlay */}
        {scanned && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
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
              <Button size="sm" variant="outline" className="text-white border-white/30 hover:bg-white/10"
                onClick={startCamera}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-t from-black/70 to-transparent p-3 text-center">
        <p className="text-xs text-white/50">Point your camera at the booking QR code</p>
      </div>

      <style jsx global>{`
        @keyframes scanLine { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(200px); } }
        .animate-scan { animation: scanLine 2s ease-in-out infinite; }
        #qr-reader-container video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
        #qr-reader-container { position: relative !important; }
        #qr-reader-container > div { border: none !important; }
        #qr-reader__scan_region { border: none !important; }
        #qr-reader__dashboard { display: none !important; }
      `}</style>
    </div>
  );
}
