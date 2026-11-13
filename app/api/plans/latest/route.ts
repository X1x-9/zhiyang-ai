import { NextResponse } from "next/server";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { getPlanState, PlanStorageError } from "@/lib/plan-store";

export async function GET() {
  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再查看计划。" }, { status: 401 });
    }
    const state = await getPlanState(identity);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    if (error instanceof PlanStorageError) {
      return NextResponse.json({ error: "PLAN_STORAGE_UNAVAILABLE", message: "暂时无法读取计划，请稍后重试。" }, { status: 503 });
    }
    console.error("PLAN LATEST ROUTE ERROR", error);
    return NextResponse.json({ error: "PLAN_LATEST_FAILED", message: "暂时无法读取计划。" }, { status: 503 });
  }
}
