"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, onClose]);

  if (!open) return null;

  const variantStyles = {
    danger: "bg-red-600 hover:bg-red-700",
    warning: "bg-yellow-600 hover:bg-yellow-700",
    default: "bg-primary hover:bg-primary/90",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="relative z-10 mx-4 w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              variant === "danger"
                ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                : variant === "warning"
                  ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
                  : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-9 items-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 ${variantStyles[variant]}`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
