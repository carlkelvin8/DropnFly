"use client";

import { useEffect, useState } from "react";

interface PushManagerProps {
  subscribeUrl: string;
  unsubscribeUrl: string;
  vapidKeyUrl: string;
}

export function PushManager({ subscribeUrl, unsubscribeUrl, vapidKeyUrl }: PushManagerProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState(false);
  const [supported] = useState(() =>
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );

  useEffect(() => {
    if (!supported) return;
    async function check() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        /* not supported */
      }
    }
    check();
  }, [supported]);

  if (!supported) return null;

  return (
    <button
      onClick={async () => {
        setError(false);
        if (subscribed) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              await sub.unsubscribe();
              await fetch(unsubscribeUrl, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: sub.endpoint }),
              });
            }
            setSubscribed(false);
          } catch {
            setError(true);
            if (process.env.NODE_ENV === "development") {
              console.warn("Push unsubscription failed");
            }
          }
        } else {
          try {
            const reg = await navigator.serviceWorker.ready;
            const res = await fetch(vapidKeyUrl);
            if (!res.ok) throw new Error(`Failed to fetch VAPID key (${res.status})`);
            const { publicKey } = await res.json();
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
            const saveRes = await fetch(subscribeUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sub.toJSON()),
            });
            if (!saveRes.ok) {
              await sub.unsubscribe().catch(() => {});
              throw new Error(`Failed to save subscription (${saveRes.status})`);
            }
            setSubscribed(true);
          } catch {
            setError(true);
            if (process.env.NODE_ENV === "development") {
              console.warn("Push subscription failed");
            }
          }
        }
      }}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      title={error
        ? "Push notifications failed. Click to retry."
        : subscribed ? "Disable push notifications" : "Enable push notifications"}
    >
      <span className={`h-2 w-2 rounded-full ${
        error ? "bg-red-500" : subscribed ? "bg-green-500" : "bg-muted-foreground/40"
      }`} />
      {subscribed ? "Notifications On" : "Enable Notifications"}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}
