import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("请填写有效的邮箱地址。"),
  password: z.string().min(8, "密码至少 8 位。").max(72, "密码不能超过 72 位。"),
  name: z.string().trim().max(24).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "auth-register"), 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "注册请求有点频繁，请稍等片刻再试。" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "请检查邮箱和密码格式。";
    return NextResponse.json({ error: "INVALID_BODY", message }, { status: 400 });
  }

  const { email, password, name } = parsed.data;

  try {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "EMAIL_TAKEN", message: "这个邮箱已经注册过，可以直接登录。" }, { status: 409 });
    }
    const passwordHash = await hash(password, 10);
    const displayName = name?.trim() || "你";
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: displayName,
        profiles: { create: { displayName } },
      },
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    console.error("REGISTER ERROR", error);
    return NextResponse.json(
      { error: "DATABASE_UNAVAILABLE", message: "注册服务暂时不可用，请稍后重试。" },
      { status: 503 },
    );
  }
}
