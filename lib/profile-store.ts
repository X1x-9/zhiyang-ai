import { Prisma } from "@prisma/client";
import type { Identity } from "./identity";
import { clearDemoProfile, readDemoProfile, writeDemoProfile } from "./demo-session";
import { clearDemoPlanMemory } from "./plan-store";
import { getPrisma } from "./prisma";
import { goalLabels, goalText, normalizeSpaceProfile, type SpaceProfile } from "./space";

export async function loadProfile(identity: Identity): Promise<SpaceProfile | null> {
  if (identity.kind === "demo") return readDemoProfile(identity.sessionId);
  const row = await getPrisma().healthProfile.findUnique({
    where: { userId: identity.userId },
    select: { data: true },
  });
  return row?.data ? normalizeSpaceProfile(row.data) : null;
}

export async function saveProfile(identity: Identity, profile: SpaceProfile): Promise<SpaceProfile> {
  if (identity.kind === "demo") return writeDemoProfile(identity.sessionId, profile);
  await getPrisma().healthProfile.update({
    where: { id: identity.profileId },
    data: {
      data: profile,
      displayName: profile.name.trim() || identity.displayName,
      goal: goalText(profile.goal),
      dietaryNotes: profile.avoid.trim(),
    },
  });
  return profile;
}

export async function clearProfile(identity: Identity): Promise<void> {
  if (identity.kind === "demo") {
    clearDemoProfile(identity.sessionId);
    clearDemoPlanMemory(identity.sessionId);
    return;
  }
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.planVersion.deleteMany({ where: { profileId: identity.profileId } }),
    prisma.planAdjustment.deleteMany({ where: { profileId: identity.profileId } }),
    prisma.healthProfile.update({
      where: { id: identity.profileId },
      data: {
        data: Prisma.DbNull,
        displayName: "你",
        goal: goalLabels.maintain,
        dietaryNotes: "",
      },
    }),
  ]);
}
