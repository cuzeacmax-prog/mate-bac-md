/**
 * ETAPA 78 FAZA A — „momentele de valoare": promptul de instalare (și cererea
 * de permisiune push din FAZA B) apar DOAR după ce produsul a livrat ceva:
 * prima lecție completată sau al 3-lea daily. Client-only (localStorage).
 */
const K_LESSONS = "pm-momente-lectii";
const K_DAILY = "pm-momente-daily";
const K_DISMISSED = "pm-install-respins-la";
export const DISMISS_DAYS = 14;

function readInt(key: string): number {
  if (typeof window === "undefined") return 0;
  return parseInt(window.localStorage.getItem(key) ?? "0", 10) || 0;
}

export function markValueMoment(kind: "lectie" | "daily"): void {
  if (typeof window === "undefined") return;
  const key = kind === "lectie" ? K_LESSONS : K_DAILY;
  window.localStorage.setItem(key, String(readInt(key) + 1));
}

/** prima lecție completată SAU al 3-lea daily */
export function valueMomentReached(): boolean {
  return readInt(K_LESSONS) >= 1 || readInt(K_DAILY) >= 3;
}

export function dismissInstall(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(K_DISMISSED, String(Date.now()));
}

export function installDismissedRecently(): boolean {
  const at = readInt(K_DISMISSED);
  return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}
