import { NextResponse } from "next/server";
import { z } from "zod";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { deletePlanVersions, getPlanState, PlanStorageError, PlanVersionActiveError } from "@/lib/plan-store";

const bodySchema = z.object({
  versions: z.array(z.number().int().positive().max(100_000)).min(1).max(50),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-delete"), 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "操作有点频繁，请稍等片刻再试。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_VERSIONS", message: "请选择要删除的计划版本。" }, { status: 400 });
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再管理计划。" }, { status: 401 });
    }

    const deletedCount = await deletePlanVersions(identity, parsed.data.versions);
    const state = await getPlanState(identity);
    return NextResponse.json({ ...state, deletedCount });
  } catch (error) {
    if (error instanceof PlanVersionActiveError) {
      return NextResponse.json(
        { error: "PLAN_VERSION_ACTIVE", message: "当前启用的版本不能删除，请先启用其他版本。" },
        { status: 409 },
      );
    }
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "计划暂时无法删除，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN DELETE ROUTE ERROR", error);
    return NextResponse.json({ error: "PLAN_DELETE_FAILED", message: "计划删除失败，请稍后重试。" }, { status: 503 });
  }
}
