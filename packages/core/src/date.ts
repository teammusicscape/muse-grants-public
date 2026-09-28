import type { Notice } from "./types";

const DAY = 86_400_000;

export function todayISO(now = new Date()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return todayISO(new Date(new Date(y, m - 1, d).getTime() + days * DAY));
}

/** 오늘 기준 남은 일수. 날짜가 없으면 null */
export function daysLeft(deadline: string | null, now = new Date()): number | null {
  if (!deadline) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / DAY);
}

export function ddayLabel(n: Notice, now = new Date()): string {
  const d = daysLeft(n.deadline, now);
  if (d === null) return n.deadlineLabel ?? "확인 필요";
  if (d < 0) return "마감";
  if (d === 0) return "D-day";
  return `D-${d}`;
}

export type Urgency = "closed" | "today" | "urgent" | "soon" | "normal" | "none";
export function urgency(n: Notice, now = new Date()): Urgency {
  const d = daysLeft(n.deadline, now);
  if (d === null) return "none";
  if (d < 0) return "closed";
  if (d === 0) return "today";
  if (d <= 3) return "urgent";
  if (d <= 14) return "soon";
  return "normal";
}

export function formatKDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const w = "일월화수목금토"[d.getDay()];
  return `${+m[2]}월 ${+m[3]}일 (${w})`;
}

/** "2026-09-28 18:00" → "9.28(일) 18:00" */
export function shortDateTime(v: string | undefined | null): string {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(v);
  if (!m) return v;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${+m[2]}.${+m[3]}(${"일월화수목금토"[d.getDay()]})${m[4] ? " " + m[4] : ""}`;
}
