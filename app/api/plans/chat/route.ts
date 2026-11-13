import { NextResponse } from "next/server";
import { z } from "zod";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { runPlanChat } from "@/lib/plan-chat";
import { generatePlanVersion, getPlanState, PlanRevisionError, PlanStorageError } from "@/lib/plan-store";
import { loadProfile } from "@/lib/profile-store";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { validateSpaceProfile } from "@/lib/space";

export const maxDuration = 60;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(600),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(16),
  kind: z.enum(["diet", "exercise"]).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-chat"), 12, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "消息有点频繁，请稍等片刻再发。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再调整计划。" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_MESSAGES", message: "消息格式不正确，或单条超过 600 字。" }, { status: 400 });
    }
    const messages = parsed.data.messages;
    if (messages[messages.length - 1]?.role !== "user") {
      return NextResponse.json({ error: "INVALID_MESSAGES", message: "最后一条消息需要是你想说的话。" }, { status: 400 });
    }

    const profile = await loadProfile(identity);
    if (!profile) {
      return NextResponse.json(
        { error: "PROFILE_REQUIRED", message: "先在「我的空间」保存资料，才能按你的资料调整计划。" },
        { status: 409 },
      );
    }
    const profileErrors = validateSpaceProfile(profile);
    if (Object.keys(profileErrors).length > 0) {
      return NextResponse.json(
        { error: "PROFILE_INCOMPLETE", message: "资料里还有没选好的项目，先在「我的空间」补齐后再调整计划。", errors: profileErrors },
        { status: 409 },
      );
    }

    const state = await getPlanState(identity);
    const currentPlan = state.plan;
    if (!currentPlan) {
      return NextResponse.json(
        { error: "PLAN_REQUIRED", message: "先生成一版计划，再来聊怎么调整。" },
        { status: 409 },
      );
    }

    const outcome = await runPlanChat({
      profile,
      plan: currentPlan,
      messages,
      kind: parsed.data.kind ?? "diet",
    });
    if (outcome.status === "FAILED") {
      return NextResponse.json({ error: "PLAN_CHAT_FAILED", message: outcome.reply, reply: outcome.reply }, { status: 502 });
    }
    if (!outcome.directive) {
      return NextResponse.json({ reply: outcome.reply, applied: false }, { status: 200 });
    }

    const result = await generatePlanVersion(identity, profile, undefined, {
      directive: outcome.directive,
      request: outcome.request,
      baseVersion: currentPlan.version,
    });
    const nextState = await getPlanState(identity);
    return NextResponse.json(
      { ...nextState, reply: outcome.reply, applied: true, generatedVersion: result.plan.version },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanRevisionError) {
      return NextResponse.json({ error: "REVISION_REJECTED", message: error.message }, { status: 409 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "计划暂时无法保存，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN CHAT ROUTE ERROR", error);
    return NextResponse.json({ error: "PLAN_CHAT_FAILED", message: "暂时没能回答，请稍后再试。" }, { status: 503 });
  }
}
