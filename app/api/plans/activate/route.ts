import { NextResponse } from "next/server";
import { z } from "zod";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { activatePlanVersion, getPlanState, PlanStorageError } from "@/lib/plan-store";

const bodySchema = z.object({
  version: z.number().int().positive().max(100_000),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-activate"), 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "操作有点频繁，请稍等片刻再试。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_VERSION", message: "计划版本号不正确。" }, { status: 400 });
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再启用计划。" }, { status: 401 });
    }

    const activated = await activatePlanVersion(identity, parsed.data.version);
    if (!activated) {
      return NextResponse.json({ error: "PLAN_VERSION_NOT_FOUND", message: "找不到这个计划版本。" }, { status: 404 });
    }

    const state = await getPlanState(identity);
    return NextResponse.json({ ...state, activatedVersion: activated.version });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "计划暂时无法启用，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN ACTIVATE ROUTE ERROR", error);
    return NextResponse.json({ error: "PLAN_ACTIVATE_FAILED", message: "计划启用失败，请稍后重试。" }, { status: 503 });
  }
}
