import { NextResponse } from "next/server";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { AdjustmentStorageError, deleteTodayAdjustment } from "@/lib/plan-adjustment-store";
import { PlanStorageError } from "@/lib/plan-store";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "plans-adjust-restore"), 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "操作得有点频繁，请稍等片刻再试。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再操作。" }, { status: 401 });
    }

    const removed = await deleteTodayAdjustment(identity);
    return NextResponse.json({ status: "RESTORED", removed });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "暂时无法读取计划，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof AdjustmentStorageError) {
      return NextResponse.json({ error: "ADJUSTMENT_UNAVAILABLE", message: "暂时无法恢复正式计划，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN ADJUST RESTORE ROUTE ERROR", error);
    return NextResponse.json({ error: "ADJUST_RESTORE_FAILED", message: "暂时无法恢复正式计划。" }, { status: 503 });
  }
}
