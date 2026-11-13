import type { SpaceTargets } from "./space";

export const PLANS_WINDOW_DAYS = 7;

export type PlanMealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "OTHER";

export type PlanMealRecord = {
  title: string;
  mealType: PlanMealType;
  eatenAt: Date;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type PlanMealSignal = {
  type: "protein_focus" | "portion_focus";
  label: string;
  detail: string;
  evidence: string;
};

export type PlanMealSummary = {
  windowDays: number;
  recordCount: number;
  recordedDays: number;
  macroCompleteMeals: number;
  macroCoverage: number;
  completeDayCount: number;
  avgKcalPerCompleteDay: number | null;
  avgProteinPerCompleteDay: number | null;
  mealTypeCounts: Record<PlanMealType, number>;
  signals: PlanMealSignal[];
  notes: string[];
};

const TIME_ZONE = "Asia/Shanghai";

function chinaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isComplete(meal: PlanMealRecord) {
  return [meal.kcal, meal.proteinG, meal.carbsG, meal.fatG].every((value) => value !== null && Number.isFinite(value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function summarizeMeals(meals: PlanMealRecord[], targets: SpaceTargets | null, windowDays = 7): PlanMealSummary {
  const days = new Map<string, PlanMealRecord[]>();
  for (const meal of meals) {
    const key = chinaDateKey(meal.eatenAt);
    const group = days.get(key) ?? [];
    group.push(meal);
    days.set(key, group);
  }

  const macroCompleteMeals = meals.filter(isComplete).length;
  const completeDayGroups = [...days.values()].filter(
    (group) => group.length >= 2 && group.every(isComplete),
  );
  const completeDayCount = completeDayGroups.length;
  const avgKcalPerCompleteDay = completeDayCount > 0
    ? round(completeDayGroups.reduce((sum, group) => sum + group.reduce((daySum, meal) => daySum + (meal.kcal ?? 0), 0), 0) / completeDayCount)
    : null;
  const avgProteinPerCompleteDay = completeDayCount > 0
    ? round(completeDayGroups.reduce((sum, group) => sum + group.reduce((daySum, meal) => daySum + (meal.proteinG ?? 0), 0), 0) / completeDayCount)
    : null;
  const macroCoverage = meals.length > 0 ? round((macroCompleteMeals / meals.length) * 100) / 100 : 0;

  const mealTypeCounts: Record<PlanMealType, number> = {
    BREAKFAST: 0,
    LUNCH: 0,
    DINNER: 0,
    SNACK: 0,
    OTHER: 0,
  };
  for (const meal of meals) mealTypeCounts[meal.mealType] += 1;

  const notes: string[] = [];
  if (meals.length === 0) {
    notes.push(`近 ${windowDays} 天没有已确认餐食；本次只按资料生成，不推断饮食情况。`);
  } else {
    notes.push(`近 ${windowDays} 天读取到 ${meals.length} 餐已确认记录，覆盖 ${days.size} 天。`);
    if (macroCompleteMeals < meals.length) {
      notes.push(`${meals.length - macroCompleteMeals} 餐缺少完整宏量营养素字段，不进入蛋白质、碳水和脂肪汇总。`);
    }
    if (completeDayCount < 2) {
      notes.push("当日至少 2 餐且营养字段齐全的天数不足 2 天，本次不根据单日或残缺记录调整计划。");
    } else {
      notes.push(`有 ${completeDayCount} 天记录较完整（当日至少 2 餐且营养字段齐全），可用于汇总参考。`);
    }
  }

  const signals: PlanMealSignal[] = [];
  if (targets && completeDayCount >= 2 && avgProteinPerCompleteDay !== null) {
    const threshold = targets.proteinLow * 0.8;
    if (avgProteinPerCompleteDay < threshold) {
      signals.push({
        type: "protein_focus",
        label: "蛋白质重点",
        detail: `在 ${completeDayCount} 个记录较完整的日子里，已记录餐食的蛋白质平均约 ${avgProteinPerCompleteDay} g/天，低于参考下限 ${targets.proteinLow} g 的 80%。`,
        evidence: `完整记录日 ${completeDayCount} 天；蛋白质均值 ${avgProteinPerCompleteDay} g/天；参考下限 ${targets.proteinLow} g。`,
      });
    }
  }
  if (targets && completeDayCount >= 2 && avgKcalPerCompleteDay !== null) {
    const threshold = targets.calorieHigh * 1.15;
    if (avgKcalPerCompleteDay > threshold) {
      signals.push({
        type: "portion_focus",
        label: "份量重点",
        detail: `在 ${completeDayCount} 个记录较完整的日子里，已记录热量平均约 ${avgKcalPerCompleteDay} kcal/天，高于参考上限 ${targets.calorieHigh} kcal 的 115%。`,
        evidence: `完整记录日 ${completeDayCount} 天；热量均值 ${avgKcalPerCompleteDay} kcal/天；参考上限 ${targets.calorieHigh} kcal。`,
      });
    }
  }

  return {
    windowDays,
    recordCount: meals.length,
    recordedDays: days.size,
    macroCompleteMeals,
    macroCoverage,
    completeDayCount,
    avgKcalPerCompleteDay,
    avgProteinPerCompleteDay,
    mealTypeCounts,
    signals,
    notes,
  };
}

export function planMealRecordFromDemo(input: {
  title: string;
  mealType: PlanMealType;
  eatenAt: string;
  estimatedKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}): PlanMealRecord {
  return {
    title: input.title,
    mealType: input.mealType,
    eatenAt: new Date(input.eatenAt),
    kcal: input.estimatedKcal,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  };
}
