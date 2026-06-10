"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, BookOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FREE_MONTHLY_LIMIT = 30;

interface HeaderProps {
  userEmail: string | null;
  userName: string | null;
  messagesUsed?: number;
  isPremium?: boolean;
  isAdmin?: boolean;
  /** ETAPA 14: seria de zile cu daily-ul completat */
  streak?: number;
}

export function Header({ userEmail, userName, messagesUsed, isPremium, isAdmin, streak }: HeaderProps) {
  const router = useRouter();
  const displayName = userName ?? userEmail?.split("@")[0] ?? "Elev";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const remaining = FREE_MONTHLY_LIMIT - (messagesUsed ?? 0);
  const showCounter = !isPremium && !isAdmin && messagesUsed !== undefined;

  return (
    <header className="sticky top-0 z-50 glass-1 border-x-0 border-t-0">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm">Profesor Maxim</span>
        </Link>

        <div className="flex items-center gap-3">
          {typeof streak === "number" && streak > 0 && (
            <Link
              href="/app/azi"
              className="flex items-center gap-1 text-sm font-semibold text-foreground"
              title={`Streak: ${streak} ${streak === 1 ? "zi" : "zile"} la rând`}
            >
              <span aria-hidden>🔥</span>
              {streak}
            </Link>
          )}
          {showCounter && (
            <Badge
              variant={remaining <= 5 ? "destructive" : "secondary"}
              className="hidden sm:flex text-xs"
            >
              {remaining} mesaje rămase
            </Badge>
          )}
          {isPremium && (
            <Badge variant="default" className="hidden sm:flex text-xs">
              Premium
            </Badge>
          )}
          {isAdmin && (
            <Badge
              variant="outline"
              className="hidden sm:flex text-xs border-violet-500 text-violet-600"
            >
              Admin
            </Badge>
          )}
          <span className="text-sm text-muted-foreground hidden sm:block">
            Bună, {displayName}!
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Ieși</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
