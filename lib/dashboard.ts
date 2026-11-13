import { ApiError } from "./api-error";

export type MacroProgress = { consumed: number; goal: number | null };
export type MacroSummary = {
  protein: MacroProgress;
  carbs: MacroProgress;
  fat: MacroProgress;
  partial: boolean;
};
export type WeightPoint = { label: string; kg: number; source?: "profile" };
export type WeightEntry = { id: string; dateKey: string; kg: number; note: string };
export type WeightListResponse = { demo: boolean; entries: WeightEntry[]; profilePoint: WeightPoint | null };

export function profileWeightPoint(kg: number | null): WeightPoint | null {
  if (kg === null) return null;
  return { label: "资料", kg, source: "profile" };
}
export type WorkoutSummary = { title: string; durationMinutes: number; exercises: string[] };
export type WeekDaySummary = {
  key: string;
  label: string;
  dateLabel: string;
  isToday: boolean;
  isFuture: boolean;
  meals: number;
  calories: number;
  workoutMinutes: number | null;
};

export type WeekSummary = {
  recordedDays: number;
  meals: number;
  workouts: number | null;
  weightEntries: number | null;
  note: string;
  days: WeekDaySummary[];
};

export type DashboardData = {
  demo: boolean;
  notice?: string;
  dateLabel: string;
  greeting: string;
  displayName: string;
  calories: number;
  calorieGoal: number | null;
  macros: MacroSummary | null;
  waterMl: number;
  waterGoal: number;
  waterHistory: Record<string, number>;
  weightKg: number | null;
  weightChangeKg: number | null;
  weightSeries: WeightPoint[];
  weightSource: "records" | "profile" | null;
  pendingMeals: number;
  mealsToday: number;
  workout: WorkoutSummary | null;
  week: WeekSummary;
};

export async function getDashboard(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard");
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(data?.message ?? "暂时无法获取今日数据，请稍后重试。", response.status);
  }
  return response.json() as Promise<DashboardData>;
}

export async function getWeightEntries(): Promise<WeightListResponse> {
  const response = await fetch("/api/weight");
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "暂时无法读取体重记录，请稍后重试。");
  }
  return response.json() as Promise<WeightListResponse>;
}

export function chinaTodayDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function weightDateLabel(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function formatWeightChange(change: number | null) {
  if (change === null) return "暂无变化记录";
  if (Math.abs(change) < 0.05) return "与上次持平";
  return `${change > 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(1)} kg`;
}
