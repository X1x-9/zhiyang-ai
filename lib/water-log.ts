const STORAGE_PREFIX = "zy-water-log";
const MAX_DAYS = 21;
const TIME_ZONE = "Asia/Shanghai";

export function waterTodayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function storageKey(identityKey: string) {
  return identityKey === "pending" ? null : `${STORAGE_PREFIX}:${identityKey}`;
}

export function loadWaterLog(identityKey: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  const key = storageKey(identityKey);
  if (!key) return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const log: Record<string, number> = {};
    for (const [day, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
      log[day] = Math.round(value);
    }
    return log;
  } catch {
    return {};
  }
}

export function recordWater(identityKey: string, amount = 250): Record<string, number> {
  const log = loadWaterLog(identityKey);
  const key = storageKey(identityKey);
  if (!key || !Number.isFinite(amount) || amount <= 0) return log;
  const today = waterTodayKey();
  log[today] = (log[today] ?? 0) + Math.round(amount);
  const kept = Object.keys(log).sort().slice(-MAX_DAYS);
  const next: Record<string, number> = {};
  for (const day of kept) next[day] = log[day];
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}
