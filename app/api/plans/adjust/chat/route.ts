import { NextResponse } from "next/server";
import { z } from "zod";
import type { DynamicPlanAdjustment } from "@/lib/plan-adjustment";
import { evaluatePlanAdjustment } from "@/lib/plan-adjustment";
import {
  normalizeAdjustmentAgainstBase,
  runAdjustmentChat,
  signAdjustment,
  verifyAdjustmentSignature,
} from "@/lib/plan-adjustment-chat";
import { AdjustmentStorageError, loadConfirmedMealsToday } from "@/lib/plan-adjustment-store";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { loadProfile } from "@/lib/profile-store";
import { getPlanState, PlanStorageError } from "@/lib/plan-store";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(600),
  })).min(1).max(16),
  current: z.object({
    suggestion: z.unknown(),
    signature: z.string().max(128),
  }).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-adjust-chat"), 12, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "聊得有点快，请稍等片刻再发。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再调整。" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_MESSAGES", message: "消息格式不正确，或单条超过 600 字。" }, { status: 400 });
    }
    const messages = parsed.data.messages;
    if (messages[messages.length - 1]?.role !== "user") {
      return NextResponse.json({ error: "INVALID_MESSAGES", message: "最后一条消息需要是你想说的话。" }, { status: 400 });
    }

    const state = await getPlanState(identity);
    if (!state.plan) {
      return NextResponse.json({ error: "PLAN_REQUIRED", message: "先生成计划，再来聊怎么调整。" }, { status: 409 });
    }

    const meals = await loadConfirmedMealsToday(identity);
    const evaluation = evaluatePlanAdjustment(state.plan, meals);
    if (evaluation.status !== "SUGGESTED") {
      return NextResponse.json({
        status: "NONE",
        message: evaluation.reason || "今天的记录暂时不需要调整。",
      }, { status: 409 });
    }

    let current: DynamicPlanAdjustment | null = null;
    const signed = parsed.data.current;
    if (signed && typeof signed.suggestion === "object" && signed.suggestion !== null) {
      if (verifyAdjustmentSignature(signed.suggestion, signed.signature)) {
        current = normalizeAdjustmentAgainstBase(signed.suggestion, evaluation.suggestion);
      }
    }

    const profile = await loadProfile(identity);
    const outcome = await runAdjustmentChat({
      profile,
      base: evaluation.suggestion,
      current,
      messages,
    });

    if (outcome.status === "FAILED") {
      return NextResponse.json({ error: "ADJUST_CHAT_FAILED", message: outcome.reply }, { status: 502 });
    }
    if (!outcome.suggestion) {
      return NextResponse.json({ reply: outcome.reply, applied: false }, { status: 200 });
    }

    return NextResponse.json({
      reply: outcome.reply,
      applied: true,
      suggestion: outcome.suggestion,
      signature: signAdjustment(outcome.suggestion),
    }, { status: 200 });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "暂时无法读取计划，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof AdjustmentStorageError) {
      return NextResponse.json({ error: "ADJUSTMENT_UNAVAILABLE", message: "暂时无法读取餐食记录，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN ADJUST CHAT ROUTE ERROR", error);
    return NextResponse.json({ error: "ADJUST_CHAT_FAILED", message: "暂时没能回答，请稍后再试。" }, { status: 503 });
  }
}
