// Date helpers pentru streak și date logic — Chișinău timezone (GMT+2/+3)

const CHISINAU_TZ = 'Europe/Chisinau';

export function todayInChisinau(): Date {
  const now = new Date();
  const chisinauStr = now.toLocaleString('en-US', { timeZone: CHISINAU_TZ });
  return new Date(chisinauStr);
}

export function dateOnlyChisinau(date: Date = new Date()): string {
  return date.toLocaleString('sv-SE', { timeZone: CHISINAU_TZ }).split(' ')[0];
}

export function daysBetween(date1: Date, date2: Date): number {
  const ms = date2.getTime() - date1.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

export function formatRomanian(date: Date): string {
  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: CHISINAU_TZ,
  });
}
