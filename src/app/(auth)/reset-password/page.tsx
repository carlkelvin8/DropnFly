"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { KeyRound, ArrowLeft, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Invalid reset link. No token provided.
        </div>
        <Link
          href="/forgot-password"
          className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
    } else {
      router.push("/login?registered=true");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
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
            Resetting...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <KeyRound className="h-4 w-4" />
            Reset Password
          </span>
        )}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
              <KeyRound className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your new password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading...</div>}>
              <ResetPasswordForm />
            </Suspense>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link href="/login" className="font-medium text-blue-600 transition-colors hover:text-blue-800">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
