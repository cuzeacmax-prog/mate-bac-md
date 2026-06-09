"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Dumbbell, ClipboardList, BarChart2, Camera, CalendarCheck } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app/azi",       label: "Azi",        icon: CalendarCheck, disabled: false },
  { href: "/app",           label: "Chat",       icon: MessageSquare, disabled: false },
  { href: "/app/practice",  label: "Exerciții",  icon: Dumbbell,      disabled: true  },
  { href: "/app/simulare",  label: "Simulare",   icon: ClipboardList, disabled: true  },
  { href: "/app/photo",     label: "Foto",        icon: Camera,        disabled: true  },
  { href: "/app/progres",   label: "Progres",    icon: BarChart2,     disabled: true  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-background shrink-0">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, disabled }) => {
          if (disabled) {
            return (
              <button
                key={href}
                disabled
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed w-full text-left"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 ml-auto">
                  Curând
                </span>
              </button>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
