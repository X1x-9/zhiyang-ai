import { chinaDateKey, chinaDayRange } from "./demo-data";
import type { PlanDocument } from "./plan-engine";

export type AdjustmentReason = "MEAL_OVERSHOOT" | "DAY_OVERSHOOT";

export type AdjustmentMeal = {
  time: string;
  label: string;
  title: string;
  detail: string;
  swap: string;
  kcalHint: string | null;
  change: string;
};

export type DynamicPlanAdjustment = {
  dayKey: string;
  nextDayKey: string;
  baseVersion: number;
  createdAt: string;
  basedOnMealCount: number;
  basedOnSignature: string;
  reason: AdjustmentReason;
  title: string;
  summary: string;
  evidence: string[];
  remainingToday: AdjustmentMeal[];
  nextDayLabel: string;
  nextDayMeals: AdjustmentMeal[];
  nextDayNote: string;
  safetyNote: string;
};

export type ConfirmedMealInput = {
  id: string;
  title: string;
  mealType: string;
  kcal: number | null;
  eatenAt: string;
  macroComplete: boolean;
};

export type AdjustmentEvaluation =
  | { status: "NONE"; reason: string }
  | { status: "SUGGESTED"; suggestion: DynamicPlanAdjustment; reason: string };

type Overshoot = {
  label: string;
  low: number;
  high: number;
  kcal: number;
  count: number;
  delta: number;
};

const labelByMealType: Record<string, string> = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  DINNER: "晚餐",
  SNACK: "加餐",
};

export const mealOvershootFloor = 180;
export const dayOvershootFloor = 150;

const todayRatio: Record<string, number> = { 早餐: 0.85, 午餐: 0.85, 加餐: 0.8, 晚餐: 0.8 };
const todayFloor: Record<string, number> = { 早餐: 280, 午餐: 350, 加餐: 100, 晚餐: 350 };
const tomorrowRatio: Record<string, number> = { 早餐: 1, 午餐: 0.9, 加餐: 1, 晚餐: 0.9 };
const tomorrowFloor: Record<string, number> = { 早餐: 280, 午餐: 350, 加餐: 100, 晚餐: 350 };

const todayNotes: Record<string, string> = {
  早餐: "动态调整：主食减到三分之二，蛋白质（鸡蛋/牛奶/豆浆）保留。",
  午餐: "动态调整：主食减三分之一，蔬菜多一份，蛋白质保留掌心大小。",
  加餐: "动态调整：不饿就省掉；饿了选无糖酸奶或水果一小份，先避开甜饮和坚果过量。",
  晚餐: "动态调整：主食减半，蔬菜多一份，蛋白质保留；吃到八分饱。",
};

const todayChanges: Record<string, string> = {
  早餐: "主食减到 2/3",
  午餐: "主食减 1/3",
  加餐: "饿了再吃",
  晚餐: "主食减半",
};

const tomorrowNotes: Record<string, string> = {
  早餐: "明天：照常吃，不用因为今天而跳过早餐。",
  午餐: "明天：正常份量，主食一拳，蔬菜半盘，蛋白质掌心大小；少油。",
  加餐: "明天：不饿可以省；饿了照常选水果或无糖酸奶。",
  晚餐: "明天：主食减三分之一，蔬菜多一份，蛋白质保留。",
};

const tomorrowChanges: Record<string, string> = {
  早餐: "照常吃",
  午餐: "主食一拳",
  加餐: "不饿可省",
  晚餐: "主食减 1/3",
};

export function parseKcalHint(hint: string | null): { low: number; high: number } | null {
  if (!hint) return null;
  const match = hint.match(/(\d+)\s*(?:[–—\-~～至]|到)\s*(\d+)\s*kcal/i);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= 0) return null;
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

export function confirmedMealSignature(meals: ConfirmedMealInput[]): string {
  const basis = [...meals]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((meal) => `${meal.id}:${meal.mealType}:${meal.kcal ?? "?"}`)
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < basis.length; index += 1) {
    hash ^= basis.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `m${(hash >>> 0).toString(36)}`;
}

function isUpcoming(time: string, now: Date) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return true;
  const { start } = chinaDayRange(now);
  const planned = new Date(start.getTime() + (Number(match[1]) * 60 + Number(match[2])) * 60_000);
  return planned.getTime() >= now.getTime() - 90 * 60_000;
}

function scaleKcalHint(hint: string | null, ratio: number, floorHigh: number) {
  const range = parseKcalHint(hint);
  if (!range) return hint;
  const high = Math.max(floorHigh, Math.round((range.high * ratio) / 10) * 10);
  const low = Math.max(
    Math.max(0, floorHigh - 100),
    Math.min(high - 50, Math.round((range.low * ratio) / 10) * 10),
  );
  return `约 ${low}–${high} kcal`;
}

function adjustedMeal(
  meal: PlanDocument["diet"]["meals"][number],
  ratio: number,
  floor: number,
  note: string,
  change: string,
): AdjustmentMeal {
  return {
    time: meal.time,
    label: meal.label,
    title: meal.title,
    detail: `${meal.detail} ${note}`.trim(),
    swap: meal.swap,
    kcalHint: scaleKcalHint(meal.kcalHint, ratio, floor),
    change,
  };
}

function tomorrowLabel(now: Date) {
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const label = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(tomorrow);
  return `明天 · ${label}`;
}

function overshootLine(item: Overshoot) {
  const countText = item.count > 1 ? ` ${item.count} 次共` : "";
  return `计划${item.label}约 ${item.low}–${item.high} kcal，已记录${countText}约 ${item.kcal} kcal，高出约 ${item.delta} kcal。`;
}

export function evaluatePlanAdjustment(
  plan: PlanDocument,
  meals: ConfirmedMealInput[],
  now = new Date(),
): AdjustmentEvaluation {
  if (!plan.targets) {
    return { status: "NONE", reason: "计划没有热量参考区间，暂不判断偏差。" };
  }
  if (plan.diet.meals.length === 0) {
    return { status: "NONE", reason: "计划里还没有餐次安排，暂时无法对照。" };
  }
  if (meals.length === 0) {
    return { status: "NONE", reason: "今天还没有已确认的餐食记录。" };
  }

  const knownMeals = meals.filter((meal) => meal.kcal !== null && meal.kcal > 0);
  if (knownMeals.length === 0) {
    return { status: "NONE", reason: "今天已确认的餐食没有热量数据，暂不判断偏差。" };
  }
  const unknownCount = meals.length - knownMeals.length;
  const totalKcal = knownMeals.reduce((sum, meal) => sum + (meal.kcal ?? 0), 0);

  const grouped = new Map<string, { kcal: number; count: number }>();
  for (const meal of knownMeals) {
    const label = labelByMealType[meal.mealType];
    if (!label) continue;
    const entry = grouped.get(label) ?? { kcal: 0, count: 0 };
    entry.kcal += meal.kcal ?? 0;
    entry.count += 1;
    grouped.set(label, entry);
  }

  const overshoots: Overshoot[] = [];
  for (const planMeal of plan.diet.meals) {
    const entry = grouped.get(planMeal.label);
    if (!entry) continue;
    const range = parseKcalHint(planMeal.kcalHint);
    if (!range) continue;
    const delta = Math.round(entry.kcal - range.high);
    const threshold = Math.max(mealOvershootFloor, Math.round(range.high * 0.3));
    if (delta < threshold) continue;
    overshoots.push({
      label: planMeal.label,
      low: range.low,
      high: range.high,
      kcal: Math.round(entry.kcal),
      count: entry.count,
      delta,
    });
  }

  const dayDelta = Math.round(totalKcal - plan.targets.calorieHigh);
  const dayThreshold = Math.max(dayOvershootFloor, Math.round(plan.targets.calorieHigh * 0.1));
  const dayOvershoot = dayDelta >= dayThreshold;

  if (!dayOvershoot && overshoots.length === 0) {
    return { status: "NONE", reason: "今天记录与计划大致相符，暂不需要调整。" };
  }

  const reason: AdjustmentReason = dayOvershoot ? "DAY_OVERSHOOT" : "MEAL_OVERSHOOT";
  const key = chinaDateKey(now);
  const nextKey = chinaDateKey(new Date(now.getTime() + 86_400_000));

  const confirmedLabels = new Set(meals.map((meal) => labelByMealType[meal.mealType]).filter(Boolean));
  const remainingToday = plan.diet.meals
    .filter((meal) => !confirmedLabels.has(meal.label) && isUpcoming(meal.time, now))
    .map((meal) => adjustedMeal(
      meal,
      todayRatio[meal.label] ?? 0.85,
      todayFloor[meal.label] ?? 300,
      todayNotes[meal.label] ?? "动态调整：份量略收，蛋白质和蔬菜保留。",
      todayChanges[meal.label] ?? "份量略收",
    ));

  const nextDayMeals = plan.diet.meals.map((meal) => adjustedMeal(
    meal,
    tomorrowRatio[meal.label] ?? 0.9,
    tomorrowFloor[meal.label] ?? 300,
    tomorrowNotes[meal.label] ?? "明天：正常份量，蛋白质和蔬菜优先。",
    tomorrowChanges[meal.label] ?? "正常份量",
  ));

  const evidence: string[] = [];
  if (dayOvershoot && plan.targets) {
    evidence.push(`今天已确认 ${meals.length} 餐，其中 ${knownMeals.length} 餐有热量，共约 ${Math.round(totalKcal)} kcal；计划上限 ${plan.targets.calorieHigh} kcal，超出约 ${dayDelta} kcal。`);
  }
  for (const item of overshoots.slice(0, 2)) evidence.push(overshootLine(item));
  const incomplete = meals.filter((meal) => !meal.macroComplete).length;
  if (incomplete > 0) evidence.push(`有 ${incomplete} 餐营养字段不完整，这里只比较热量。`);
  if (unknownCount > 0) evidence.push(`另有 ${unknownCount} 餐没有热量数据，未计入比较。`);
  evidence.push("热量来自记录估算，不是精确测量；调整以份量和结构为主。");

  const base = dayOvershoot
    ? `今天已记录约 ${Math.round(totalKcal)} kcal，超过计划上限约 ${dayDelta} kcal`
    : `${overshoots[0].label}比计划重了约 ${overshoots[0].delta} kcal`;
  const summary = remainingToday.length > 0
    ? `${base}，今天剩下的餐次和明天都安排轻一点。`
    : `${base}；今天的计划餐次已经记录完，主要调整明天。`;

  const suggestion: DynamicPlanAdjustment = {
    dayKey: key,
    nextDayKey: nextKey,
    baseVersion: plan.version,
    createdAt: now.toISOString(),
    basedOnMealCount: meals.length,
    basedOnSignature: confirmedMealSignature(meals),
    reason,
    title: "今天和明天，轻一点继续。",
    summary,
    evidence,
    remainingToday,
    nextDayLabel: tomorrowLabel(now),
    nextDayMeals,
    nextDayNote: "明天回到正常份量，不用用少吃来补偿今天；蛋白质和蔬菜照常。",
    safetyNote: "不做补偿性节食：不跳过正餐，也不把热量压到极低。今天剩下的餐次吃到七分饱，明天按正常节奏吃；如果出现头晕、乏力或暴食冲动，先恢复正常饮食并咨询专业人士。",
  };

  return { status: "SUGGESTED", suggestion, reason: summary };
}
