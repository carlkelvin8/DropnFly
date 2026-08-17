"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ActivationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [message, setMessage] = useState("Activating your account...");

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/customer/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Activation failed");
      setMessage("Account activated. Redirecting...");
      router.replace("/my-account");
      router.refresh();
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Activation failed"));
  }, [token, router]);

  return <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white"><h1 className="text-xl font-semibold">DropnFly account activation</h1><p className="mt-3 text-white/60">{token ? message : "Activation link is invalid."}</p></div></main>;
}

export default function ActivateCustomerPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading activation...</main>}><ActivationContent /></Suspense>;
}
