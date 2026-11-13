import { NextResponse } from "next/server";
import { z } from "zod";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { generatePlanVersion, getPlanState, PlanRevisionError, PlanStorageError } from "@/lib/plan-store";
import { loadProfile } from "@/lib/profile-store";
import { validateSpaceProfile } from "@/lib/space";

export const maxDuration = 60;

const bodySchema = z.object({ feedback: z.string().trim().max(300).optional() }).nullish();

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-generate"), 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "生成请求有点频繁，请稍等片刻再试。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再生成计划。" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY", message: "调整意见最多 300 字。" }, { status: 400 });
    }
    const feedback = parsed.data?.feedback ?? null;

    const profile = await loadProfile(identity);
    if (!profile) {
      return NextResponse.json(
        { error: "PROFILE_REQUIRED", message: "先在「我的空间」保存资料，才能按你的资料生成计划。" },
        { status: 409 },
      );
    }
    const profileErrors = validateSpaceProfile(profile);
    if (Object.keys(profileErrors).length > 0) {
      return NextResponse.json(
        { error: "PROFILE_INCOMPLETE", message: "资料里还有没选好的项目，先在「我的空间」补齐后再生成计划。", errors: profileErrors },
        { status: 409 },
      );
    }

    const result = await generatePlanVersion(identity, profile, feedback);
    const state = await getPlanState(identity);
    return NextResponse.json({ ...state, generatedVersion: result.plan.version }, { status: 201 });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanRevisionError) {
      return NextResponse.json({ error: "REVISION_REJECTED", message: error.message }, { status: 422 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "计划暂时无法保存，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN GENERATE ROUTE ERROR", error);
    return NextResponse.json({ error: "PLAN_GENERATE_FAILED", message: "计划生成失败，请稍后重试。" }, { status: 503 });
  }
}
