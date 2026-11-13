import { tool } from "ai";
import { z } from "zod";
import { chinaDateKey, chinaDayRange, listDemoSessionMeals } from "./demo-data";
import type { Identity } from "./identity";
import { getPrisma } from "./prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

const mealTypeSchema = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"]);

type MealRow = {
  title: string;
  mealType: string;
  eatenAt: Date;
  estimatedKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  items: unknown;
};

function itemSummary(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 8).map((item) => {
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const grams = typeof record.amountGrams === "number" ? `${Math.round(record.amountGrams)}g` : "";
    return `${name}${grams ? ` ${grams}` : ""}`.trim();
  }).filter(Boolean);
}

export function createRecentMealsTool(identity: Identity) {
  return tool({
    description: "读取当前用户最近 7 天内已记录的餐食：按日期列出每餐菜品、热量和蛋白质，并给出每日合计。用户询问自己的饮食记录、某一餐吃了多少热量、蛋白质是否达标时调用。没有记录时返回 count=0，必须如实说明没有记录，不得编造或要求用户重复输入已记录的内容。",
    inputSchema: z.object({
      days: z.number().int().min(1).max(7).optional().describe("回看天数，默认 7"),
      mealType: mealTypeSchema.optional().describe("只看某一餐类型，默认全部"),
    }),
    execute: async ({ days = 7, mealType }) => {
      const range = chinaDayRange();
      const start = new Date(range.start.getTime() - (days - 1) * DAY_MS);
      let rows: MealRow[];

      if (identity.kind === "demo") {
        rows = listDemoSessionMeals(identity.sessionId)
          .filter((meal) => meal.status !== "REJECTED")
          .map((meal) => ({
            title: meal.title,
            mealType: meal.mealType,
            eatenAt: new Date(meal.eatenAt),
            estimatedKcal: meal.estimatedKcal,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
            items: meal.items,
          }));
      } else {
        rows = await getPrisma().mealRecord.findMany({
          where: { profileId: identity.profileId, status: { not: "REJECTED" }, eatenAt: { gte: start, lt: range.end } },
          orderBy: { eatenAt: "desc" },
          take: 60,
          select: { title: true, mealType: true, eatenAt: true, estimatedKcal: true, proteinG: true, carbsG: true, fatG: true, items: true },
        });
      }

      const filtered = rows
        .filter((meal) => meal.eatenAt >= start && meal.eatenAt < range.end)
        .filter((meal) => !mealType || meal.mealType === mealType)
        .slice(0, 40);

      const meals = filtered.map((meal) => ({
        date: chinaDateKey(meal.eatenAt),
        mealType: meal.mealType,
        title: meal.title,
        kcal: meal.estimatedKcal,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        items: itemSummary(meal.items),
      }));

      const daily = new Map<string, { kcal: number; proteinG: number; meals: number }>();
      for (const meal of meals) {
        const entry = daily.get(meal.date) ?? { kcal: 0, proteinG: 0, meals: 0 };
        entry.kcal += meal.kcal ?? 0;
        entry.proteinG += meal.proteinG ?? 0;
        entry.meals += 1;
        daily.set(meal.date, entry);
      }

      return {
        rangeDays: days,
        timeZone: "Asia/Shanghai",
        mealType: mealType ?? "ALL",
        count: meals.length,
        daily: [...daily.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, value]) => ({
            date,
            meals: value.meals,
            kcal: Math.round(value.kcal),
            proteinG: Math.round(value.proteinG * 10) / 10,
          })),
        meals,
        note: meals.length === 0 ? "该时间范围内没有已记录的餐食。" : "热量与营养为记录值或估算值，存在误差。",
      };
    },
  });
}
