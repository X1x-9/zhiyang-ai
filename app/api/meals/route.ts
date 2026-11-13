import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { addDemoMeal, chinaDayRange, listDemoMeals } from "@/lib/demo-data";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { nutritionTotals } from "@/lib/meal-nutrition";

const macroFields = {
  proteinG: z.number().min(0).max(1000).optional(),
  carbsG: z.number().min(0).max(1500).optional(),
  fatG: z.number().min(0).max(500).optional(),
};

const mealItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amountGrams: z.number().min(0).max(3000),
  calories: z.number().min(0).max(5000),
  foodId: z.string().max(60).optional(),
  dataSource: z.enum(["food_table", "model_estimate", "manual"]).optional(),
  matchedName: z.string().max(80).optional(),
  ...macroFields,
});

const mealSchema = z.object({
  title: z.string().trim().min(1).max(100),
  items: z.array(mealItemSchema).min(1).max(30),
  notes: z.string().max(1000).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"]).optional(),
  eatenAt: z.string().datetime().optional(),
});

const errors = { OVERWEIGHT: "记录热量超过每日安全校验范围，请检查份量。" } as const;

function authRequired() {
  return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再记录饮食。" }, { status: 401 });
}

export async function GET() {
  try {
    const identity = await resolveIdentity();
    if (!identity) return authRequired();

    if (identity.kind === "demo") {
      return NextResponse.json({ meals: listDemoMeals(identity.sessionId), demo: true });
    }

    const prisma = getPrisma();
    const { start, end } = chinaDayRange();
    const meals = await prisma.mealRecord.findMany({
      where: { profileId: identity.profileId, status: { not: "REJECTED" }, eatenAt: { gte: start, lt: end } },
      orderBy: { eatenAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ meals, demo: false });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    console.error("MEALS GET ERROR", error);
    return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "暂时无法读取今日记录。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let identity;
  try {
    identity = await resolveIdentity();
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    throw error;
  }
  if (!identity) return authRequired();

  const parsed = mealSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_MEAL", details: parsed.error.flatten() }, { status: 400 });

  const calories = parsed.data.items.reduce((sum, item) => sum + item.calories, 0);
  if (calories > 3000) return NextResponse.json({ error: "OVERWEIGHT", message: errors.OVERWEIGHT }, { status: 422 });

  const totals = nutritionTotals(parsed.data.items);

  if (identity.kind === "demo") {
    const meal = addDemoMeal(identity.sessionId, {
      title: parsed.data.title,
      mealType: parsed.data.mealType,
      items: parsed.data.items,
      notes: parsed.data.notes,
      status: parsed.data.status,
      eatenAt: parsed.data.eatenAt,
    });
    return NextResponse.json({ meal, demo: true }, { status: 201 });
  }

  try {
    const prisma = getPrisma();
    const meal = await prisma.mealRecord.create({
      data: {
        profileId: identity.profileId,
        title: parsed.data.title,
        mealType: parsed.data.mealType ?? "OTHER",
        eatenAt: parsed.data.eatenAt ? new Date(parsed.data.eatenAt) : new Date(),
        items: parsed.data.items,
        estimatedKcal: calories,
        lowerKcal: Math.round(calories * 0.85),
        upperKcal: Math.round(calories * 1.2),
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
        notes: parsed.data.notes ?? "",
        status: parsed.data.status ?? "PENDING",
      },
    });
    return NextResponse.json({ meal, demo: false }, { status: 201 });
  } catch (error) {
    console.error("MEALS POST ERROR", error);
    return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "餐食没有保存成功，请稍后重试。" }, { status: 503 });
  }
}
