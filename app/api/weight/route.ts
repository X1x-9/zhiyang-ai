import { NextResponse } from "next/server";
import { z } from "zod";
import { chinaDateKey } from "@/lib/demo-data";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { profileWeightPoint } from "@/lib/dashboard";
import { listWeightEntries, saveWeightEntry, syncProfileWeight } from "@/lib/weight-store";
import { loadProfile } from "@/lib/profile-store";
import { readProfileWeightKg } from "@/lib/space";

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式不正确。")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "日期格式不正确。");

const weightSchema = z.object({
  dateKey: dateKeySchema,
  kg: z.number().min(35, "体重需在 35–200 kg 之间。").max(200, "体重需在 35–200 kg 之间。"),
  note: z.string().trim().max(100, "备注最多 100 个字。").optional(),
});

function authRequired() {
  return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再记录体重。" }, { status: 401 });
}

export async function GET() {
  try {
    const identity = await resolveIdentity();
    if (!identity) return authRequired();
    const entries = await listWeightEntries(identity);
    const profilePoint = profileWeightPoint(readProfileWeightKg(await loadProfile(identity)));
    return NextResponse.json({ demo: identity.kind === "demo", entries, profilePoint });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    console.error("WEIGHT GET ERROR", error);
    return NextResponse.json({ error: "WEIGHT_UNAVAILABLE", message: "暂时无法读取体重记录，请稍后重试。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
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

  const parsed = weightSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_WEIGHT", message: "请检查体重和日期。", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.dateKey > chinaDateKey()) {
    return NextResponse.json({ error: "FUTURE_DATE", message: "体重不能记录在未来日期。" }, { status: 422 });
  }

  try {
    const entry = await saveWeightEntry(identity, {
      dateKey: parsed.data.dateKey,
      kg: Math.round(parsed.data.kg * 10) / 10,
      note: parsed.data.note ?? "",
    });
    let profileSynced = false;
    try {
      await syncProfileWeight(identity);
      profileSynced = true;
    } catch (error) {
      console.error("WEIGHT PROFILE SYNC ERROR", error);
    }
    return NextResponse.json({ entry, demo: identity.kind === "demo", profileSynced }, { status: 201 });
  } catch (error) {
    console.error("WEIGHT POST ERROR", error);
    return NextResponse.json({ error: "WEIGHT_SAVE_FAILED", message: "体重没有保存成功，请稍后重试。" }, { status: 503 });
  }
}
