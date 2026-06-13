"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MapPin,
  Package,
  Users,
  Luggage,
  LogOut,
  UserCog,
  Settings,
  ClipboardList,
  Navigation,
  Bell,
  BarChart3,
  Sun,
  Moon,
  User,
  DollarSign,
  Tag,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/my", label: "My Dashboard", icon: Navigation },
  { href: "/dashboard/bookings", label: "Bookings", icon: Package },
  { href: "/dashboard/locations", label: "Locations", icon: MapPin },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/payments", label: "Payments", icon: DollarSign },
  { href: "/dashboard/promo-codes", label: "Promo Codes", icon: Tag },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/employees", label: "Employees", icon: UserCog },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/activity-logs", label: "Activity Logs", icon: ClipboardList },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar-background">
      <div className="flex h-14 items-center border-b px-6">
        <Luggage className="mr-2 h-5 w-5" />
        <span className="font-semibold">Dropnfly</span>
      </div>

      <div className="border-b px-4 py-3">
        <Link
          href="/dashboard/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/dashboard/profile"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <User className="h-4 w-4" />
          Profile
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t p-4">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: window.location.origin + "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
