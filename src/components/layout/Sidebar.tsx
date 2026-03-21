"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./LogoutButton";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: ListChecks },
  { href: "/exercises", label: "Exercises", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r bg-background flex-col h-screen sticky top-0">
        <div className="px-4 py-5 border-b">
          <h1 className="font-bold text-lg tracking-tight">Pi Fitness</h1>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-2 py-4 border-t">
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex items-stretch h-16">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              pathname === href
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
