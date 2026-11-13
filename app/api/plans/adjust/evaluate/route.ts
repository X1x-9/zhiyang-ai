import { NextResponse } from "next/server";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { confirmedMealSignature, evaluatePlanAdjustment } from "@/lib/plan-adjustment";
import { AdjustmentStorageError, loadConfirmedMealsToday } from "@/lib/plan-adjustment-store";
import { getPlanState, PlanStorageError } from "@/lib/plan-store";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-adjust-evaluate"), 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "检查得有点频繁，请稍等片刻再试。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再记录。" }, { status: 401 });
    }

    const state = await getPlanState(identity);
    if (!state.plan) {
      return NextResponse.json({ status: "NONE", reason: "生成计划后再记录餐食，才能对照调整。" });
    }

    const meals = await loadConfirmedMealsToday(identity);
    const evaluation = evaluatePlanAdjustment(state.plan, meals);
    if (evaluation.status === "NONE") {
      return NextResponse.json({ status: "NONE", reason: evaluation.reason });
    }

    const existing = state.adjustment;
    if (
      existing
      && existing.baseVersion === state.plan.version
      && existing.basedOnSignature === confirmedMealSignature(meals)
    ) {
      return NextResponse.json({
        status: "ACTIVE",
        adjustment: existing,
        reason: "已经按今天的记录调整过。",
      });
    }

    return NextResponse.json({
      status: "SUGGESTED",
      suggestion: evaluation.suggestion,
      reason: evaluation.reason,
      existing: Boolean(existing),
    });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "暂时无法读取计划，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof AdjustmentStorageError) {
      return NextResponse.json({ error: "ADJUSTMENT_UNAVAILABLE", message: "暂时无法检查餐食偏差，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN ADJUST EVALUATE ROUTE ERROR", error);
    return NextResponse.json({ error: "ADJUST_EVALUATE_FAILED", message: "暂时无法检查餐食偏差。" }, { status: 503 });
  }
}
