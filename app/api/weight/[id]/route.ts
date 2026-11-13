import { NextResponse } from "next/server";
import { z } from "zod";
import { IdentityError, resolveIdentity, type Identity } from "@/lib/identity";
import { patchWeightEntry, removeWeightEntry, syncProfileWeight } from "@/lib/weight-store";

const patchSchema = z.object({
  kg: z.number().min(35, "体重需在 35–200 kg 之间。").max(200, "体重需在 35–200 kg 之间。").optional(),
  note: z.string().trim().max(100, "备注最多 100 个字。").optional(),
});

function authRequired() {
  return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再修改体重记录。" }, { status: 401 });
}

async function resolveOrRespond(): Promise<{ identity?: Identity; response?: NextResponse }> {
  try {
    const identity = await resolveIdentity();
    if (!identity) return { response: authRequired() };
    return { identity };
  } catch (error) {
    if (error instanceof IdentityError) {
      return { response: NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 }) };
    }
    throw error;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { identity, response } = await resolveOrRespond();
  if (!identity) return response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_WEIGHT", message: "请检查体重和备注。", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.kg === undefined && parsed.data.note === undefined) {
    return NextResponse.json({ error: "EMPTY_PATCH", message: "没有需要更新的内容。" }, { status: 400 });
  }

  try {
    const entry = await patchWeightEntry(identity, id, {
      ...(parsed.data.kg !== undefined ? { kg: Math.round(parsed.data.kg * 10) / 10 } : {}),
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
    });
    if (!entry) {
      return NextResponse.json({ error: "NOT_FOUND", message: "没有找到这条体重记录。" }, { status: 404 });
    }
    try {
      await syncProfileWeight(identity);
    } catch (error) {
      console.error("WEIGHT PROFILE SYNC ERROR", error);
    }
    return NextResponse.json({ entry, demo: identity.kind === "demo" });
  } catch (error) {
    console.error("WEIGHT PATCH ERROR", error);
    return NextResponse.json({ error: "WEIGHT_UPDATE_FAILED", message: "体重记录没有更新成功，请稍后重试。" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { identity, response } = await resolveOrRespond();
  if (!identity) return response;

  const { id } = await params;
  try {
    const removed = await removeWeightEntry(identity, id);
    if (!removed) {
      return NextResponse.json({ error: "NOT_FOUND", message: "没有找到这条体重记录。" }, { status: 404 });
    }
    try {
      await syncProfileWeight(identity);
    } catch (error) {
      console.error("WEIGHT PROFILE SYNC ERROR", error);
    }
    return NextResponse.json({ deleted: true, demo: identity.kind === "demo" });
  } catch (error) {
    console.error("WEIGHT DELETE ERROR", error);
    return NextResponse.json({ error: "WEIGHT_DELETE_FAILED", message: "体重记录没有删除成功，请稍后重试。" }, { status: 503 });
  }
}
