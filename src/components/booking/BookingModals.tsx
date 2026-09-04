"use client";

import { useState, useEffect } from "react";

export function BookingModals({
  termsOpen,
  privacyOpen,
  onTermsClose,
  onPrivacyClose,
}: {
  termsOpen: boolean;
  privacyOpen: boolean;
  onTermsClose: () => void;
  onPrivacyClose: () => void;
}) {
  return (
    <>
      <TermsModal open={termsOpen} onClose={onTermsClose} />
      <PrivacyModal open={privacyOpen} onClose={onPrivacyClose} />
    </>
  );
}

export function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    fetch("/api/public/settings", { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then((res) => res.json())
      .then((data) => { if (mounted) setContent(data.terms_and_conditions || ""); })
      .catch(() => { if (mounted) setContent(""); });
    return () => { mounted = false; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Terms and Conditions">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Terms &amp; Conditions</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground" aria-label="Close">&times;</button>
        </div>
        {content === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : content ? (
          <div className="space-y-3 text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{content}</div>
        ) : (
          <p className="text-sm text-muted-foreground">Terms &amp; Conditions are currently unavailable. Please try again later.</p>
        )}
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600">Close</button>
      </div>
    </div>
  );
}

export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    fetch("/api/public/settings", { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then((res) => res.json())
      .then((data) => { if (mounted) setContent(data.privacy_policy || ""); })
      .catch(() => { if (mounted) setContent(""); });
    return () => { mounted = false; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Privacy Policy">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Privacy Policy</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground" aria-label="Close">&times;</button>
        </div>
        {content === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : content ? (
          <div className="space-y-3 text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{content}</div>
        ) : (
          <p className="text-sm text-muted-foreground">Privacy Policy is currently unavailable. Please try again later.</p>
        )}
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600">Close</button>
      </div>
    </div>
  );
}
