"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

export default function NewEmployeePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      role: formData.get("role") as string,
    };

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success("Employee created successfully");
      router.push("/dashboard/employees");
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create employee");
      setError(err.error || "Failed to create employee");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/employees">&larr; Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">Add Employee</h1>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" placeholder="John Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="john@dropnfly.ph" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" minLength={6} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  id="role"
                  name="role"
                  defaultValue="EMPLOYEE"
                  options={[
                    { value: "ADMIN", label: "Admin" },
                    { value: "STAFF", label: "Staff" },
                    { value: "EMPLOYEE", label: "Employee" },
                  ]}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Employee"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/employees">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
