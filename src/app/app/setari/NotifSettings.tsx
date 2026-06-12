"use client";

/**
 * ETAPA 78 B2 — toggle-urile de notificări. Activarea push pe dispozitiv trece
 * prin ecranul prealabil (ce primești, când), NU dialogul brut al browserului.
 */
import { useEffect, useState } from "react";
import { Bell, BellOff, Flame, Sunrise, Mail } from "lucide-react";
import {
  pushSupported,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pwa/push-client";

type Prefs = { streak_reminders: boolean; daily_challenge: boolean; email: boolean };

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
        checked ? "bg-primary" : "bg-[var(--glass-2)]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5.5 left-0" : "translate-x-0.5 left-0"
        }`}
      />
    </button>
  );
}

export function NotifSettings({ initialPrefs }: { initialPrefs: Prefs }) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [explain, setExplain] = useState(false);
  const supported = typeof window !== "undefined" && pushSupported();

  useEffect(() => {
    let cancelled = false;
    const check = pushSupported()
      ? getCurrentSubscription().then((s) => Boolean(s))
      : Promise.resolve(false);
    check.then((v) => {
      if (!cancelled) setSubscribed(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePref(key: keyof Prefs, value: boolean) {
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value });
    const resp = await fetch("/api/push/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!resp.ok) setPrefs(prev);
  }

  async function enablePush() {
    setBusy(true);
    const ok = await subscribeToPush();
    setSubscribed(ok);
    setExplain(false);
    setBusy(false);
  }

  async function disablePush() {
    setBusy(true);
    await unsubscribeFromPush();
    setSubscribed(false);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {/* ── push pe acest dispozitiv ── */}
      <section className="glass-solid rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {subscribed ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-semibold text-sm">Notificări pe acest dispozitiv</p>
              <p className="text-xs text-muted-foreground">
                {supported
                  ? subscribed
                    ? "Active — le poți opri oricând."
                    : "Oprite."
                  : "Browserul acesta nu suportă notificări push."}
              </p>
            </div>
          </div>
          {supported && subscribed !== null && (
            subscribed ? (
              <button
                onClick={disablePush}
                disabled={busy}
                className="rounded-full glass-2 px-4 py-2 text-sm font-medium"
              >
                Oprește
              </button>
            ) : (
              <button
                onClick={() => setExplain(true)}
                disabled={busy}
                data-testid="push-enable"
                className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
              >
                Activează
              </button>
            )
          )}
        </div>

        {/* ecranul PREALABIL: ce primești, înainte de dialogul browserului */}
        {explain && !subscribed && (
          <div data-testid="push-explain" className="rounded-xl glass-1 p-4 space-y-3">
            <p className="text-sm font-medium">Ce primești (și atât):</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex gap-2">
                <Flame className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Seara, DOAR dacă streak-ul tău e în pericol (daily-ul nefăcut).
              </li>
              <li className="flex gap-2">
                <Sunrise className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Dimineața, provocarea zilei — doar dacă bifezi mai jos.
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Maximum un push pe zi. Niciodată între 21:00 și 09:00.
            </p>
            <div className="flex gap-2">
              <button
                onClick={enablePush}
                disabled={busy}
                className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
              >
                {busy ? "..." : "De acord, anunță-mă"}
              </button>
              <button
                onClick={() => setExplain(false)}
                className="rounded-full glass-2 px-4 py-2 text-sm"
              >
                Renunț
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── per tip ── */}
      <section className="glass-solid rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm">Streak în pericol</p>
              <p className="text-xs text-muted-foreground">
                Seara, doar când daily-ul nu e făcut și ai o serie de păstrat.
              </p>
            </div>
          </div>
          <Toggle
            checked={prefs.streak_reminders}
            onChange={(v) => savePref("streak_reminders", v)}
            disabled={!subscribed}
            label="Streak în pericol"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sunrise className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm">Provocarea de dimineață</p>
              <p className="text-xs text-muted-foreground">
                La 8:30 — pornită doar dacă o vrei (implicit oprită).
              </p>
            </div>
          </div>
          <Toggle
            checked={prefs.daily_challenge}
            onChange={(v) => savePref("daily_challenge", v)}
            disabled={!subscribed}
            label="Provocarea de dimineață"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm">Emailuri</p>
              <p className="text-xs text-muted-foreground">
                Raportul săptămânal și anunțurile de cont. Dezabonare și din email.
              </p>
            </div>
          </div>
          <Toggle
            checked={prefs.email}
            onChange={(v) => savePref("email", v)}
            label="Emailuri"
          />
        </div>
      </section>
    </div>
  );
}
