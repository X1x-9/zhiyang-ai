import { NextResponse } from "next/server";
import { z } from "zod";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { loadProfile, clearProfile, saveProfile } from "@/lib/profile-store";
import { normalizeSpaceProfile, validateSpaceProfile } from "@/lib/space";

const bodySchema = z.object({ profile: z.unknown() });

export async function GET() {
  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再访问个人资料。" }, { status: 401 });
    }
    const profile = await loadProfile(identity);
    return NextResponse.json({
      demo: identity.kind === "demo",
      authenticated: identity.kind === "user",
      displayName: profile?.name.trim() || identity.displayName,
      account: identity.kind === "user" ? { email: identity.email } : null,
      profile,
    });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    console.error("PROFILE GET ERROR", error);
    return NextResponse.json({ error: "PROFILE_UNAVAILABLE", message: "暂时无法读取个人资料。" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再保存个人资料。" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY", message: "没有收到可用的资料。" }, { status: 400 });
    }
    const normalized = normalizeSpaceProfile(parsed.data.profile);
    if (!normalized) {
      return NextResponse.json({ error: "INVALID_PROFILE", message: "资料格式无法识别。" }, { status: 400 });
    }
    const errors = validateSpaceProfile(normalized);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "INVALID_PROFILE", message: "资料里还有需要修正的字段。", errors }, { status: 422 });
    }

    const saved = {
      ...normalized,
      source: identity.kind === "demo" ? "demo" as const : "local" as const,
      savedAt: new Date().toISOString(),
    };
    await saveProfile(identity, saved);
    return NextResponse.json({
      demo: identity.kind === "demo",
      authenticated: identity.kind === "user",
      profile: saved,
      displayName: saved.name.trim() || identity.displayName,
      account: identity.kind === "user" ? { email: identity.email } : null,
    });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    console.error("PROFILE PUT ERROR", error);
    return NextResponse.json({ error: "PROFILE_SAVE_FAILED", message: "资料没有保存成功，请稍后重试。" }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "请先登录后再清空个人资料。" }, { status: 401 });
    }

    await clearProfile(identity);
    return NextResponse.json({ cleared: true, demo: identity.kind === "demo" });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    console.error("PROFILE DELETE ERROR", error);
    return NextResponse.json({ error: "PROFILE_CLEAR_FAILED", message: "资料和对应计划没有清空成功，请稍后重试。" }, { status: 503 });
  }
}
