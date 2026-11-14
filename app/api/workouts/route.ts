import { NextResponse } from "next/server";
import { z } from "zod";
import { chinaWeekDates } from "@/lib/dashboard";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { listWorkoutRecords, saveWorkoutRecord } from "@/lib/workout-store";

const workoutSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式不正确。"),
  sessionKey: z.string().trim().min(1, "缺少训练标识。").max(180, "训练标识过长。"),
  title: z.string().trim().min(1, "缺少训练名称。").max(120, "训练名称过长。"),
  minutes: z.number().int().min(1, "训练时长不正确。").max(600, "训练时长不正确。"),
  steps: z.array(z.boolean()).min(1, "缺少训练步骤。").max(12, "训练步骤过多。"),
});

function authRequired() {
  return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再记录训练。" }, { status: 401 });
}

export async function GET() {
  try {
    const identity = await resolveIdentity();
    if (!identity) return authRequired();
    const weekDates = chinaWeekDates();
    const records = await listWorkoutRecords(identity, weekDates[0].key, weekDates[6].key);
    return NextResponse.json({
      demo: identity.kind === "demo",
      weekStartKey: weekDates[0].key,
      todayKey: weekDates.find((day) => day.isToday)?.key ?? weekDates[0].key,
      records,
    });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    console.error("WORKOUT GET ERROR", error);
    return NextResponse.json({ error: "WORKOUT_UNAVAILABLE", message: "暂时无法读取训练记录，请稍后重试。" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
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

  const parsed = workoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_WORKOUT", message: "请检查训练内容后再打卡。", details: parsed.error.flatten() }, { status: 400 });
  }

  const weekDates = chinaWeekDates();
  const day = weekDates.find((item) => item.key === parsed.data.dateKey);
  if (!day) {
    return NextResponse.json({ error: "OUTSIDE_WEEK", message: "只能记录本周的训练。" }, { status: 422 });
  }
  if (day.isFuture) {
    return NextResponse.json({ error: "FUTURE_DATE", message: "还没到这一天，先不用打卡。" }, { status: 422 });
  }

  try {
    const record = await saveWorkoutRecord(identity, {
      dateKey: parsed.data.dateKey,
      sessionKey: parsed.data.sessionKey,
      title: parsed.data.title,
      minutes: parsed.data.minutes,
      steps: parsed.data.steps,
    });
    return NextResponse.json({ demo: identity.kind === "demo", record });
  } catch (error) {
    console.error("WORKOUT PATCH ERROR", error);
    return NextResponse.json({ error: "WORKOUT_SAVE_FAILED", message: "完成状态没有保存成功，请稍后重试。" }, { status: 503 });
  }
}
