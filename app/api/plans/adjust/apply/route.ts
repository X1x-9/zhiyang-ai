import { NextResponse } from "next/server";
import { z } from "zod";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { evaluatePlanAdjustment } from "@/lib/plan-adjustment";
import { normalizeAdjustmentAgainstBase, verifyAdjustmentSignature } from "@/lib/plan-adjustment-chat";
import { AdjustmentStorageError, loadConfirmedMealsToday, saveAdjustment } from "@/lib/plan-adjustment-store";
import { getPlanState, PlanStorageError } from "@/lib/plan-store";

const bodySchema = z.object({
  suggestion: z.unknown().optional(),
  signature: z.string().max(128).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-adjust-apply"), 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "调整得有点频繁，请稍等片刻再试。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再调整。" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_ADJUSTMENT", message: "调整内容格式不正确，请重新打开建议再试。" }, { status: 400 });
    }

    const state = await getPlanState(identity);
    if (!state.plan) {
      return NextResponse.json({ error: "PLAN_REQUIRED", message: "先生成计划，才能做动态调整。" }, { status: 409 });
    }

    const meals = await loadConfirmedMealsToday(identity);
    const evaluation = evaluatePlanAdjustment(state.plan, meals);
    if (evaluation.status === "NONE") {
      return NextResponse.json({ status: "NONE", reason: evaluation.reason });
    }

    let adjustmentToSave = evaluation.suggestion;
    const signed = parsed.data;
    if (signed.suggestion && signed.signature) {
      if (!verifyAdjustmentSignature(signed.suggestion, signed.signature)) {
        return NextResponse.json({ error: "INVALID_ADJUSTMENT", message: "调整内容校验失败，请重新打开建议再试。" }, { status: 400 });
      }
      const normalized = normalizeAdjustmentAgainstBase(signed.suggestion, evaluation.suggestion);
      if (!normalized) {
        return NextResponse.json(
          { error: "SUGGESTION_STALE", message: "今天的记录或计划有更新，请按最新建议重新确认。" },
          { status: 409 },
        );
      }
      adjustmentToSave = normalized;
    }

    const adjustment = await saveAdjustment(identity, adjustmentToSave);
    return NextResponse.json({ status: "APPLIED", adjustment });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "暂时无法读取计划，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof AdjustmentStorageError) {
      return NextResponse.json({ error: "ADJUSTMENT_UNAVAILABLE", message: "调整暂时没有保存成功，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN ADJUST APPLY ROUTE ERROR", error);
    return NextResponse.json({ error: "ADJUST_APPLY_FAILED", message: "动态调整失败，请稍后重试。" }, { status: 503 });
  }
}
