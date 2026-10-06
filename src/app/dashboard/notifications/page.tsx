"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Bell, CheckCheck, ArrowLeft } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const PAGE_SIZE = 10;

const typeIcons: Record<string, string> = {
  booking_created: "📦",
  status_updated: "🔄",
  task_assigned: "👤",
  complaint_resolved: "✅",
  booking_approved: "✅",
};

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "loading" && session?.user?.role === "ADMIN") {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);

  const requestSeq = useRef(0);

  // Fetch one page and apply it. Only the most recent request may update state,
  // so a slow poll can never overwrite a page the user just navigated to.
  const load = useCallback((requestedPage: number) => {
    const seq = ++requestSeq.current;
    return fetch(`/api/notifications?page=${requestedPage}&pageSize=${PAGE_SIZE}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (seq !== requestSeq.current) return;
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        // The server clamps the page when the list shrinks (e.g. last page emptied).
        setPage(data.page || 1);
        pageRef.current = data.page || 1;
      })
      .catch(() => { if (seq === requestSeq.current) toast.error("Failed to load notifications"); })
      .finally(() => { if (seq === requestSeq.current) setLoading(false); });
  }, []);

  useEffect(() => {
    void load(1);
    // Keep counts/pages in sync when new notifications arrive.
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(pageRef.current);
    }, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  function goToPage(next: number) {
    pageRef.current = next;
    setPage(next);
    setLoading(true);
    void load(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  }

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast.success("Notification marked as read");
    } catch {
      toast.error("Failed to mark notification as read");
    }
  }

  if (session?.user?.role === "ADMIN") return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount} unread</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
        )}
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent className="space-y-1 p-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                  !n.isRead ? "border-l-4 border-l-blue-500" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <span className="text-lg">{typeIcons[n.type] || "🔔"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{n.title}</p>
                      {n.message && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {n.message}
                        </p>
                      )}
                    </div>
                    {!n.isRead && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(n.createdAt)}</span>
                    <span className="capitalize">
                      {n.type.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead(n.id)}
                      className="h-7 text-xs"
                    >
                      Mark Read
                    </Button>
                  )}
                  {n.link && (
                    <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                      <Link href={n.link}>View</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
          {!loading && total > 0 && (
            <div className="pt-2">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={goToPage} />
              <p className="px-2 text-center text-xs text-muted-foreground sm:text-left">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} notifications
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
