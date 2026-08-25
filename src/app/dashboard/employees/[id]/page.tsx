"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Shield, Calendar, User, Activity, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "next-auth/react";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { bookings: number; assignedBookings: number };
  assignedBookings: {
    booking: {
      id: string;
      referenceNumber: string;
      status: string;
      pickupLocation: string;
      dropOffLocation: string;
    };
  }[];
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const { data: session } = useSession();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/employees/${params.id}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => { if (!abort.signal.aborted) setEmployee(data); })
      .catch(() => {});
    return () => abort.abort();
  }, [params.id]);

  async function updateEmployee(data: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      if (updated.sessionInvalidated) {
        toast.success("Account role updated. Please sign in again.");
        await signOut({ callbackUrl: `${window.location.origin}/login` });
        return;
      }
      setEmployee((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
      setEditPassword("");
      toast.success("Employee updated successfully");
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Failed to update employee");
    }
    setSaving(false);
  }

  if (!employee) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/employees">&larr; Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">{employee.name}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-t-2 border-t-primary">
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </span>
              <span className="font-medium">{employee.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                Role
              </span>
              <Badge variant={employee.role === "ADMIN" ? "default" : "secondary"}>
                {employee.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                Approved
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${employee.isApproved ? "bg-green-500" : "bg-yellow-500"}`} />
                <span className="text-sm font-medium">{employee.isApproved ? "Yes" : "Pending"}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                Status
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${employee.isActive ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm font-medium">{employee.isActive ? "Active" : "Inactive"}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Created
              </span>
              <span className="font-medium">{formatDate(employee.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                Bookings Handled
              </span>
              <span className="font-medium">{employee._count.bookings + employee._count.assignedBookings}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-primary">
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" disabled={saving} onClick={() => { setEditName(employee.name); setEditEmail(employee.email); setEditing(true); }}>
              <Pencil className="mr-2 h-4 w-4" /> Update Details
            </Button>
            <Button
              variant={employee.isApproved ? "secondary" : "default"}
              className="w-full"
              disabled={saving || (session?.user?.id === employee.id && employee.isActive)}
              onClick={() => updateEmployee({ isApproved: !employee.isApproved })}
            >
              {employee.isApproved ? "Unapprove Account" : "Approve Account"}
            </Button>
            <Button
              variant={employee.isActive ? "destructive" : "default"}
              className="w-full"
              disabled={saving || (session?.user?.id === employee.id && employee.isActive)}
              title={session?.user?.id === employee.id ? "You cannot deactivate your own account" : undefined}
              onClick={() => updateEmployee({ isActive: !employee.isActive })}
            >
              {employee.isActive ? "Deactivate Account" : "Activate Account"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={() => {
                const newRole = employee.role === "ADMIN" ? "STAFF" : "ADMIN";
                updateEmployee({ role: newRole });
              }}
            >
              Switch to {employee.role === "ADMIN" ? "Staff" : "Admin"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle>Update Employee Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="edit-name">Name</Label><Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-email">Username / Email</Label><Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-password">New Password</Label><Input id="edit-password" type="password" minLength={8} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave blank to keep current password" /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button disabled={saving || !editName.trim() || !editEmail.trim() || (!!editPassword && editPassword.length < 8)} onClick={() => updateEmployee({ name: editName, email: editEmail, ...(editPassword ? { password: editPassword } : {}) })}>Save Details</Button></div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assigned Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Drop-off</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.assignedBookings.map((a) => (
                <TableRow key={a.booking.id} className="border-b transition-colors hover:bg-muted/50">
                  <TableCell className="font-mono">{a.booking.referenceNumber}</TableCell>
                  <TableCell>{a.booking.pickupLocation}</TableCell>
                  <TableCell>{a.booking.dropOffLocation}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <Badge variant="secondary">{a.booking.status.replace("_", " ")}</Badge>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {employee.assignedBookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <p className="text-lg font-medium">No assigned bookings</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
