const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type DayWindow = {
  kind: "day" | "month";
  label: string;
  title: string;
  startMs: number;
  endMs: number;
  startSec: number;
  endSec: number;
};

export function resolveDayWindow(day: string, now = new Date()): DayWindow {
  const label = day === "yesterday" ? previousIstDate(now) : normalizeDate(day);
  const startMs = Date.parse(`${label}T00:00:00+05:30`);
  const endMs = startMs + 24 * 60 * 60 * 1000;

  return {
    kind: "day",
    label,
    title: label,
    startMs,
    endMs,
    startSec: Math.floor(startMs / 1000),
    endSec: Math.floor(endMs / 1000),
  };
}

export function resolveMonthWindow(month: string, now = new Date()): DayWindow {
  const label = month === "this-month" ? currentIstMonth(now) : normalizeMonth(month);
  const [yearText, monthText] = label.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  const startMs = Date.parse(`${label}-01T00:00:00+05:30`);
  const endMs = Date.parse(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`);

  return {
    kind: "month",
    label,
    title: new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(startMs)),
    startMs,
    endMs,
    startSec: Math.floor(startMs / 1000),
    endSec: Math.floor(endMs / 1000),
  };
}

export function formatIstDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(epochMs));
}

export function formatIstTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(new Date(epochMs));
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";

  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function previousIstDate(now: Date): string {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const previous = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
  return previous.toISOString().slice(0, 10);
}

function currentIstMonth(now: Date): string {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 7);
}

function normalizeDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Expected "yesterday" or YYYY-MM-DD, got "${day}"`);
  }
  return day;
}

function normalizeMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Expected "this-month" or YYYY-MM, got "${month}"`);
  }
  const monthNumber = Number(month.slice(5, 7));
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month "${month}". Expected YYYY-MM.`);
  }
  return month;
}
