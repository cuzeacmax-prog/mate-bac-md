"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Dumbbell, ClipboardList, BarChart2, Camera, CalendarCheck, Map } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app/azi",       label: "Azi",        icon: CalendarCheck, disabled: false },
  { href: "/app/harta",     label: "Harta",      icon: Map,           disabled: false },
  { href: "/app",           label: "Chat",       icon: MessageSquare, disabled: false },
  { href: "/app/practice",  label: "Exerciții",  icon: Dumbbell,      disabled: true  },
  { href: "/app/simulare",  label: "Simulare",   icon: ClipboardList, disabled: false },
  // ETAPA 77 F: foto→rezolvare se naște — „Curând" moare
  { href: "/app/foto",      label: "Foto",        icon: Camera,        disabled: false },
  { href: "/app/progres",   label: "Progres",    icon: BarChart2,     disabled: false },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  // ETAPA 73: sidebar glass — starea activă luminoasă (pill cu accent),
  // hover pe glass, fără borduri gri opace
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 glass-1 border-y-0 border-l-0">
      <nav className="flex flex-col gap-1.5 p-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, disabled }) => {
          if (disabled) {
            return (
              <button
                key={href}
                disabled
                className="flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground opacity-40 cursor-not-allowed w-full text-left"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                <span className="text-[10px] glass-1 text-muted-foreground rounded-full px-2 py-0.5 ml-auto">
                  Curând
                </span>
              </button>
            );
          }
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_0_18px_-4px_var(--primary)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)]"
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
