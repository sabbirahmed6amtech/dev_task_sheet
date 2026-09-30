// The team works on Dhaka time, so every date and clock shown in the sheet is
// Dhaka time regardless of the viewer's machine. Dhaka has no DST.
export const TZ = "Asia/Dhaka";
const OFFSET = "+06:00";

/** Today's date in Dhaka as YYYY-MM-DD. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function isISODate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Tue, 29 Sep 2026" */
export function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "28 September", the heading of the EOD report. */
export function formatLongDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  });
}

/** "28 Sep" */
export function formatShortDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

/** Dhaka date (YYYY-MM-DD) of a timestamp. */
export function dateOf(ts: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ts));
}

/** "9:10 AM" — seconds are kept in the data and shown in the editor, not the cell. */
export function formatClock(ts: string) {
  return new Date(ts).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Dhaka HH:MM:SS (24h) for an <input type="time">. */
export function toTimeInput(ts: string) {
  return new Date(ts).toLocaleTimeString("en-GB", { timeZone: TZ, hour12: false });
}

/** Timestamp for a Dhaka date plus a HH:MM[:SS] time. */
export function fromTimeInput(date: string, time: string) {
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${t}${OFFSET}`).toISOString();
}
