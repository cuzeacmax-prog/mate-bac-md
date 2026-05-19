"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Dumbbell, ClipboardList, BarChart2, Camera } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app",           label: "Chat",       icon: MessageSquare },
  { href: "/app/practice",  label: "Exerciții",  icon: Dumbbell },
  { href: "/app/simulare",  label: "Simulare",   icon: ClipboardList },
  { href: "/app/photo",     label: "Foto",        icon: Camera },
  { href: "/app/progres",   label: "Progres",    icon: BarChart2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-background shrink-0">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
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
        ))}
      </nav>
    </aside>
  );
}
