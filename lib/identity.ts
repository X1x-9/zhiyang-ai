import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "./auth";
import { isDemoMode } from "./demo-data";
import { getPrisma } from "./prisma";

export const DEMO_SESSION_COOKIE = "zy_demo_session";
const DEMO_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type Identity =
  | { kind: "user"; userId: string; profileId: string; displayName: string; email: string }
  | { kind: "demo"; sessionId: string; displayName: string };

export class IdentityError extends Error {
  constructor(public code: "DATABASE_UNAVAILABLE") {
    super(code);
  }
}

async function demoIdentity(): Promise<Identity> {
  const store = await cookies();
  let sessionId = store.get(DEMO_SESSION_COOKIE)?.value ?? "";
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) {
    sessionId = randomUUID();
    store.set(DEMO_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEMO_SESSION_MAX_AGE,
    });
  }
  return { kind: "demo", sessionId, displayName: "林同学" };
}

export async function resolveIdentity(): Promise<Identity | null> {
  let userId = "";
  let email = "";
  let name = "";
  try {
    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
      email = session.user.email ?? "";
      name = session.user.name ?? "";
    }
  } catch (error) {
    console.error("AUTH SESSION ERROR", error);
  }

  if (userId) {
    try {
      const profile = await getPrisma().healthProfile.upsert({
        where: { userId },
        create: { userId, displayName: name.trim() || "你" },
        update: {},
        select: { id: true, displayName: true },
      });
      return {
        kind: "user",
        userId,
        profileId: profile.id,
        displayName: profile.displayName || name.trim() || "你",
        email,
      };
    } catch (error) {
      console.error("IDENTITY PROFILE ERROR", error);
      throw new IdentityError("DATABASE_UNAVAILABLE");
    }
  }

  if (!isDemoMode()) return null;
  return demoIdentity();
}
