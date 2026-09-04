"use client";

import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { PushManager } from "@/components/PushManager";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 shadow-sm backdrop-blur lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <PushManager
        subscribeUrl="/api/notifications/subscribe"
        unsubscribeUrl="/api/notifications/subscribe"
        vapidKeyUrl="/api/notifications/vapid-key"
      />
      <NotificationDropdown />
      <div className="hidden sm:flex shrink-0 items-center gap-2 text-sm min-w-[180px] justify-end">
        <span className="shrink-0 whitespace-nowrap text-muted-foreground">Welcome,</span>
        {session?.user?.name ? (
          <span className="max-w-[160px] truncate whitespace-nowrap font-medium">{session.user.name}</span>
        ) : (
          <span className="h-4 w-24 animate-pulse rounded bg-muted" aria-hidden />
        )}
      </div>
    </header>
  );
}
