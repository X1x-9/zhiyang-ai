import { profileWeightPoint, weightDateLabel, type DashboardData, type WeekDaySummary, type WeightEntry, type WeightPoint } from "./dashboard";
import { readDemoProfile } from "./demo-session";
import { matchFood, scaleNutrition } from "./food-data";
import { DEMO_NUTRITION_TARGETS, deriveNutritionTargets, roundMacro } from "./nutrition-goal";
import { readProfileWeightKg } from "./space";

export type DemoMealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "OTHER";
export type DemoMealStatus = "PENDING" | "CONFIRMED" | "REJECTED";
export type DemoMealItem = {
  name: string;
  amountGrams: number;
  calories: number;
  foodId?: string;
  dataSource?: "food_table" | "model_estimate" | "manual";
  matchedName?: string;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};
export type DemoMeal = {
  id: string;
  title: string;
  mealType: DemoMealType;
  items: DemoMealItem[];
  estimatedKcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  status: DemoMealStatus;
  eatenAt: string;
  notes: string;
};

const TIME_ZONE = "Asia/Shanghai";

export function isDemoMode() {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function chinaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function chinaDateLabel(date = new Date()) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日 · ${get("weekday")}`;
}

export function chinaGreeting(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).format(date));
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function chinaDayRange(now = new Date()) {
  const key = chinaDateKey(now);
  const start = new Date(`${key}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, key };
}

export function chinaWeekStart(now = new Date()) {
  const { key } = chinaDayRange(now);
  const [year, month, day] = key.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  const mondayKey = utcDate.toISOString().slice(0, 10);
  return new Date(`${mondayKey}T00:00:00+08:00`);
}

export function lastSevenDayLabels(now = new Date()) {
  const { key } = chinaDayRange(now);
  const base = new Date(`${key}T12:00:00+08:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat("zh-CN", { timeZone: TIME_ZONE, weekday: "short" }).format(date);
  });
}

function lastSevenDayKeys(now = new Date()) {
  const { key } = chinaDayRange(now);
  const base = new Date(`${key}T12:00:00+08:00`);
  return Array.from({ length: 7 }, (_, index) => chinaDateKey(new Date(base.getTime() - (6 - index) * 24 * 60 * 60 * 1000)));
}

function todayAt(hour: number, minute: number) {
  const { key } = chinaDayRange();
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${key}T${hh}:${mm}:00+08:00`).toISOString();
}

const demoWeightValues = [64.0, 63.9, 63.8, 64.1, 63.7, 63.5, 63.4];
const demoWeekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const demoPriorMeals = [2, 2, 1];
const demoPriorCalories = [690, 760, 420];

function buildDemoWeekDays(todayMeals: number, todayCalories: number): WeekDaySummary[] {
  const todayKey = chinaDateKey();
  const start = chinaWeekStart();
  const todayIndex = Math.round(
    (new Date(`${todayKey}T12:00:00+08:00`).getTime() - new Date(`${chinaDateKey(start)}T12:00:00+08:00`).getTime()) / 86_400_000,
  );
  const recordedPrior = Array.from({ length: todayIndex }, (_, index) => index).slice(-3);
  const workoutDays = new Set(recordedPrior.slice(-2));
  return demoWeekdays.map((label, index) => {
    const key = chinaDateKey(new Date(start.getTime() + index * 86_400_000));
    const [, month, day] = key.split("-");
    const recordedIndex = recordedPrior.indexOf(index);
    const isToday = index === todayIndex;
    return {
      key,
      label,
      dateLabel: `${Number(month)}/${Number(day)}`,
      isToday,
      isFuture: index > todayIndex,
      meals: isToday ? todayMeals : recordedIndex >= 0 ? demoPriorMeals[recordedIndex] : 0,
      calories: isToday ? todayCalories : recordedIndex >= 0 ? demoPriorCalories[recordedIndex] : 0,
      workoutMinutes: workoutDays.has(index) ? 25 : null,
    };
  });
}

function nutritionTotals(items: DemoMealItem[]) {
  const withMacros = items.filter(
    (item) => item.proteinG !== undefined && item.carbsG !== undefined && item.fatG !== undefined,
  );
  if (withMacros.length === 0) return null;
  return {
    proteinG: roundMacro(withMacros.reduce((sum, item) => sum + (item.proteinG ?? 0), 0)),
    carbsG: roundMacro(withMacros.reduce((sum, item) => sum + (item.carbsG ?? 0), 0)),
    fatG: roundMacro(withMacros.reduce((sum, item) => sum + (item.fatG ?? 0), 0)),
  };
}

function enrichItem(item: DemoMealItem): DemoMealItem {
  if (item.proteinG !== undefined) return item;
  const match = matchFood(item.name);
  if (!match) return item;
  const scaled = scaleNutrition(match.food.per100, item.amountGrams);
  return {
    ...item,
    calories: scaled.kcal,
    foodId: match.food.id,
    dataSource: "food_table",
    matchedName: match.food.name,
    proteinG: scaled.proteinG,
    carbsG: scaled.carbsG,
    fatG: scaled.fatG,
  };
}

export function createDemoDashboard(sessionId: string, notice?: string): DashboardData {
  const weights = listDemoWeightEntries(sessionId);
  const latestWeight = weights[0] ?? null;
  const previousWeight = weights[1] ?? null;
  const profile = readDemoProfile(sessionId);
  const profilePoint = profileWeightPoint(readProfileWeightKg(profile));
  const recordSeries: WeightPoint[] = weights
    .slice(0, 7)
    .reverse()
    .map((entry) => ({ label: weightDateLabel(entry.dateKey), kg: entry.kg }));
  const weightSeries: WeightPoint[] = profilePoint ? [profilePoint, ...recordSeries] : recordSeries;
  const weekStartKey = chinaDateKey(chinaWeekStart());
  const todayKey = chinaDateKey();
  const weightEntriesThisWeek = weights.filter((entry) => entry.dateKey >= weekStartKey && entry.dateKey <= todayKey).length;
  const targets = profile ? deriveNutritionTargets(profile) : DEMO_NUTRITION_TARGETS;
  const todayAll = listDemoMeals(sessionId);
  const todayMeals = todayAll.filter((meal) => meal.status === "CONFIRMED");
  const calories = todayMeals.reduce((sum, meal) => sum + meal.estimatedKcal, 0);
  const macroMeals = todayMeals.filter((meal) => meal.proteinG !== null && meal.carbsG !== null && meal.fatG !== null);
  const macros = macroMeals.length > 0
    ? {
        protein: { consumed: Math.round(macroMeals.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0)), goal: targets.proteinGoal },
        carbs: { consumed: Math.round(macroMeals.reduce((sum, meal) => sum + (meal.carbsG ?? 0), 0)), goal: targets.carbsGoal },
        fat: { consumed: Math.round(macroMeals.reduce((sum, meal) => sum + (meal.fatG ?? 0), 0)), goal: targets.fatGoal },
        partial: macroMeals.length < todayMeals.length,
      }
    : null;
  const weekDays = buildDemoWeekDays(todayMeals.length, calories);
  const demoWaterValues = [1620, 1840, 1380, 1760, 1520, 2050, 1690];
  const waterHistory: Record<string, number> = {};
  weekDays.forEach((day, index) => {
    if (!day.isToday && !day.isFuture && day.meals > 0) waterHistory[day.key] = demoWaterValues[index];
  });
  const recordedDays = weekDays.filter((day) => day.meals > 0).length;
  const weekMeals = weekDays.reduce((sum, day) => sum + day.meals, 0);
  const weekWorkouts = weekDays.filter((day) => day.workoutMinutes !== null).length;
  const missingDays = weekDays.filter((day) => !day.isFuture && !day.isToday && day.meals === 0).length;
  const upcomingDays = weekDays.filter((day) => day.isFuture).length;
  const missingNote = [
    missingDays > 0 ? `${missingDays} 天没有记录` : "",
    upcomingDays > 0 ? `${upcomingDays} 天还没到` : "",
  ].filter(Boolean).join("，");
  return {
    demo: true,
    ...(notice ? { notice } : {}),
    dateLabel: chinaDateLabel(),
    greeting: chinaGreeting(),
    displayName: profile?.name.trim() || "林同学",
    calories,
    calorieGoal: targets.calorieGoal,
    macros,
    waterMl: 1100,
    waterGoal: 2000,
    waterHistory,
    weightKg: latestWeight?.kg ?? profilePoint?.kg ?? null,
    weightChangeKg: latestWeight && previousWeight ? Math.round((latestWeight.kg - previousWeight.kg) * 10) / 10 : null,
    weightSeries,
    weightSource: latestWeight ? "records" : profilePoint ? "profile" : null,
    pendingMeals: todayAll.filter((meal) => meal.status === "PENDING").length,
    mealsToday: todayMeals.length,
    workout: {
      title: "全身基础力量 · 轻松开始",
      durationMinutes: 25,
      exercises: ["深蹲", "臀桥", "墙面俯卧撑"],
    },
    week: {
      recordedDays,
      meals: weekMeals,
      workouts: weekWorkouts,
      weightEntries: weightEntriesThisWeek,
      note:
        recordedDays >= 4
          ? `本周已有 ${recordedDays} 天记录${missingNote ? `，${missingNote}` : ""}；复盘只按已有记录呈现，不补推缺失数据。`
          : `本周只有 ${recordedDays} 天饮食记录，暂不对执行情况做评价。`,
      days: weekDays,
    },
  };
}

function createDemoMeals(): DemoMeal[] {
  const raw: Array<Omit<DemoMeal, "items" | "proteinG" | "carbsG" | "fatG"> & { items: DemoMealItem[] }> = [
    {
      id: "demo-breakfast",
      title: "燕麦酸奶碗",
      mealType: "BREAKFAST",
      items: [
        { name: "燕麦", amountGrams: 40, calories: 156 },
        { name: "无糖酸奶", amountGrams: 200, calories: 144 },
        { name: "蓝莓", amountGrams: 50, calories: 28 },
        { name: "奇亚籽", amountGrams: 10, calories: 49 },
        { name: "香蕉", amountGrams: 30, calories: 27 },
        { name: "蜂蜜", amountGrams: 5, calories: 16 },
      ],
      estimatedKcal: 420,
      status: "CONFIRMED",
      eatenAt: todayAt(8, 10),
      notes: "酸奶选无糖，燕麦一小碗。",
    },
    {
      id: "demo-lunch",
      title: "番茄鸡胸杂粮饭",
      mealType: "LUNCH",
      items: [
        { name: "杂粮饭", amountGrams: 150, calories: 174 },
        { name: "香煎鸡胸", amountGrams: 120, calories: 180 },
        { name: "清炒西兰花", amountGrams: 100, calories: 80 },
      ],
      estimatedKcal: 434,
      status: "CONFIRMED",
      eatenAt: todayAt(12, 30),
      notes: "米饭半碗，鸡胸肉少油。",
    },
    {
      id: "demo-snack",
      title: "无糖豆浆和坚果",
      mealType: "SNACK",
      items: [
        { name: "无糖豆浆", amountGrams: 300, calories: 93 },
        { name: "混合坚果", amountGrams: 20, calories: 130 },
        { name: "苹果", amountGrams: 100, calories: 52 },
        { name: "全麦饼干", amountGrams: 15, calories: 48 },
      ],
      estimatedKcal: 323,
      status: "CONFIRMED",
      eatenAt: todayAt(16, 0),
      notes: "下午加餐，坚果只抓了一小把。",
    },
    {
      id: "demo-dinner",
      title: "虾仁豆腐",
      mealType: "DINNER",
      items: [
        { name: "虾仁", amountGrams: 100, calories: 99 },
        { name: "嫩豆腐", amountGrams: 150, calories: 120 },
      ],
      estimatedKcal: 219,
      status: "CONFIRMED",
      eatenAt: todayAt(18, 40),
      notes: "",
    },
  ];

  return raw.map((meal) => {
    const items = meal.items.map(enrichItem);
    const totals = nutritionTotals(items);
    return {
      ...meal,
      items,
      proteinG: totals?.proteinG ?? null,
      carbsG: totals?.carbsG ?? null,
      fatG: totals?.fatG ?? null,
    };
  });
}

type DemoSessionState = { seedDate: string; meals: DemoMeal[] };

const globalForDemoMeals = globalThis as unknown as { demoMealSessions?: Map<string, DemoSessionState> };

function sessionState(sessionId: string): DemoSessionState {
  if (!globalForDemoMeals.demoMealSessions) globalForDemoMeals.demoMealSessions = new Map();
  const sessions = globalForDemoMeals.demoMealSessions;
  const today = chinaDateKey();
  let state = sessions.get(sessionId);
  if (!state || state.seedDate !== today) {
    state = { seedDate: today, meals: createDemoMeals() };
    sessions.set(sessionId, state);
    if (sessions.size > 200) {
      const oldest = sessions.keys().next().value;
      if (oldest && oldest !== sessionId) sessions.delete(oldest);
    }
  }
  return state;
}

export function listDemoMeals(sessionId: string) {
  const today = chinaDateKey();
  return [...sessionState(sessionId).meals]
    .filter((meal) => chinaDateKey(new Date(meal.eatenAt)) === today)
    .sort((a, b) => new Date(b.eatenAt).getTime() - new Date(a.eatenAt).getTime());
}

export function listDemoSessionMeals(sessionId: string) {
  return [...sessionState(sessionId).meals]
    .sort((a, b) => new Date(b.eatenAt).getTime() - new Date(a.eatenAt).getTime());
}

export function addDemoMeal(sessionId: string, input: {
  title: string;
  mealType?: DemoMealType;
  items: DemoMealItem[];
  notes?: string;
  status?: DemoMealStatus;
  eatenAt?: string;
}) {
  const meals = sessionState(sessionId).meals;
  const items = input.items.map((item) => ({ ...item }));
  const totals = nutritionTotals(items);
  const meal: DemoMeal = {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim(),
    mealType: input.mealType ?? "OTHER",
    items,
    estimatedKcal: items.reduce((sum, item) => sum + item.calories, 0),
    proteinG: totals?.proteinG ?? null,
    carbsG: totals?.carbsG ?? null,
    fatG: totals?.fatG ?? null,
    status: input.status ?? "CONFIRMED",
    eatenAt: input.eatenAt ?? new Date().toISOString(),
    notes: input.notes ?? "",
  };
  meals.unshift(meal);
  return meal;
}

export function updateDemoMeal(
  sessionId: string,
  id: string,
  patch: {
    title?: string;
    mealType?: DemoMealType;
    status?: DemoMealStatus;
    items?: DemoMealItem[];
    notes?: string;
  },
) {
  const meals = sessionState(sessionId).meals;
  const meal = meals.find((item) => item.id === id);
  if (!meal) return null;
  if (patch.title !== undefined) meal.title = patch.title;
  if (patch.mealType !== undefined) meal.mealType = patch.mealType;
  if (patch.status !== undefined) meal.status = patch.status;
  if (patch.items !== undefined) {
    meal.items = patch.items;
    meal.estimatedKcal = patch.items.reduce((sum, item) => sum + item.calories, 0);
    const totals = nutritionTotals(patch.items);
    meal.proteinG = totals?.proteinG ?? null;
    meal.carbsG = totals?.carbsG ?? null;
    meal.fatG = totals?.fatG ?? null;
  }
  if (patch.notes !== undefined) meal.notes = patch.notes;
  return meal;
}

export function deleteDemoMeal(sessionId: string, id: string) {
  const meals = sessionState(sessionId).meals;
  const index = meals.findIndex((item) => item.id === id);
  if (index === -1) return false;
  meals.splice(index, 1);
  return true;
}

type DemoWeightState = { seedDate: string; entries: WeightEntry[] };

const globalForDemoWeights = globalThis as unknown as { demoWeightSessions?: Map<string, DemoWeightState> };

function weightSessionState(sessionId: string): DemoWeightState {
  if (!globalForDemoWeights.demoWeightSessions) globalForDemoWeights.demoWeightSessions = new Map();
  const sessions = globalForDemoWeights.demoWeightSessions;
  const today = chinaDateKey();
  let state = sessions.get(sessionId);
  if (!state || state.seedDate !== today) {
    state = {
      seedDate: today,
      entries: lastSevenDayKeys().map((dateKey, index) => ({
        id: `demo-w-${dateKey}`,
        dateKey,
        kg: demoWeightValues[index],
        note: "",
      })),
    };
    sessions.set(sessionId, state);
    if (sessions.size > 200) {
      const oldest = sessions.keys().next().value;
      if (oldest && oldest !== sessionId) sessions.delete(oldest);
    }
  }
  return state;
}

export function listDemoWeightEntries(sessionId: string): WeightEntry[] {
  return [...weightSessionState(sessionId).entries].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export function upsertDemoWeightEntry(
  sessionId: string,
  input: { dateKey: string; kg: number; note?: string },
): WeightEntry {
  const entries = weightSessionState(sessionId).entries;
  const existing = entries.find((entry) => entry.dateKey === input.dateKey);
  if (existing) {
    existing.kg = input.kg;
    existing.note = input.note ?? "";
    return existing;
  }
  const entry: WeightEntry = {
    id: `demo-w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    dateKey: input.dateKey,
    kg: input.kg,
    note: input.note ?? "",
  };
  entries.push(entry);
  return entry;
}

export function updateDemoWeightEntry(
  sessionId: string,
  id: string,
  patch: { kg?: number; note?: string },
): WeightEntry | null {
  const entry = weightSessionState(sessionId).entries.find((item) => item.id === id);
  if (!entry) return null;
  if (patch.kg !== undefined) entry.kg = patch.kg;
  if (patch.note !== undefined) entry.note = patch.note;
  return entry;
}

export function deleteDemoWeightEntry(sessionId: string, id: string) {
  const entries = weightSessionState(sessionId).entries;
  const index = entries.findIndex((item) => item.id === id);
  if (index === -1) return false;
  entries.splice(index, 1);
  return true;
}
