import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { deleteDemoMeal, updateDemoMeal } from "@/lib/demo-data";
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

const updateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"]).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
  items: z.array(mealItemSchema).min(1).max(30).optional(),
  notes: z.string().max(1000).optional(),
});

function authRequired() {
  return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再修改饮食记录。" }, { status: 401 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_MEAL", details: parsed.error.flatten() }, { status: 400 });

  const calories = parsed.data.items ? parsed.data.items.reduce((sum, item) => sum + item.calories, 0) : undefined;
  if (calories !== undefined && calories > 3000) {
    return NextResponse.json({ error: "OVERWEIGHT", message: "记录热量超过每日安全校验范围，请检查份量。" }, { status: 422 });
  }
  const totals = parsed.data.items ? nutritionTotals(parsed.data.items) : null;

  if (identity.kind === "demo") {
    const meal = updateDemoMeal(identity.sessionId, id, parsed.data);
    if (!meal) return NextResponse.json({ error: "NOT_FOUND", message: "没有找到这条记录。" }, { status: 404 });
    return NextResponse.json({ meal, demo: true });
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.mealRecord.updateMany({
      where: { id, profileId: identity.profileId },
      data: {
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(parsed.data.mealType ? { mealType: parsed.data.mealType } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.items && totals
          ? {
              items: parsed.data.items,
              estimatedKcal: calories,
              lowerKcal: Math.round((calories ?? 0) * 0.85),
              upperKcal: Math.round((calories ?? 0) * 1.2),
              proteinG: totals.proteinG,
              carbsG: totals.carbsG,
              fatG: totals.fatG,
            }
          : {}),
      },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "没有找到这条记录。" }, { status: 404 });
    }
    const meal = await prisma.mealRecord.findFirst({ where: { id, profileId: identity.profileId } });
    return NextResponse.json({ meal, demo: false });
  } catch (error) {
    console.error("MEAL PATCH ERROR", error);
    return NextResponse.json({ error: "UPDATE_FAILED", message: "未能更新这条记录，请稍后重试。" }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  if (identity.kind === "demo") {
    if (!deleteDemoMeal(identity.sessionId, id)) {
      return NextResponse.json({ error: "NOT_FOUND", message: "没有找到这条记录。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.mealRecord.deleteMany({ where: { id, profileId: identity.profileId } });
    if (result.count === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "没有找到这条记录。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, demo: false });
  } catch (error) {
    console.error("MEAL DELETE ERROR", error);
    return NextResponse.json({ error: "DELETE_FAILED", message: "未能删除这条记录。" }, { status: 502 });
  }
}
