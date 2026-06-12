"use client";

import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { data: session } = useSession();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <NotificationDropdown />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Welcome,</span>
        <span className="font-medium">{session?.user?.name}</span>
      </div>
    </header>
  );
}
