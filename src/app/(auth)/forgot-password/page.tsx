"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, ArrowLeft, Copy, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetUrl("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
    } else {
      setResetUrl(data.resetUrl);
      setNote(data.note);
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Dropnfly
            </span>
          </Link>
        </div>
        <Card className="border-t-4 border-blue-500 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 shadow-md shadow-blue-200">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Forgot Password</CardTitle>
            <CardDescription>
              Enter your email to receive a reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetUrl ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  <p className="mb-2 font-medium">Reset link generated</p>
                  <p>{note}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Reset URL</Label>
                  <div className="flex items-center gap-2 rounded-lg border bg-white p-3 text-xs break-all">
                    <span className="flex-1 text-muted-foreground">{resetUrl}</span>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="shrink-0 text-blue-600 hover:text-blue-800"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-blue-600"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <span>{error}</span>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Send Reset Link
                    </span>
                  )}
                </Button>
              </form>
            )}
            {!resetUrl && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link href="/login" className="font-medium text-blue-600 transition-colors hover:text-blue-800">
                  Sign in
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
