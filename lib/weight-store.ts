import type { WeightEntry } from "./dashboard";
import {
  deleteDemoWeightEntry,
  listDemoWeightEntries,
  updateDemoWeightEntry,
  upsertDemoWeightEntry,
} from "./demo-data";
import type { Identity } from "./identity";
import { getPrisma } from "./prisma";
import { loadProfile, saveProfile } from "./profile-store";

const MAX_WEIGHT_ENTRIES = 120;

export async function listWeightEntries(identity: Identity): Promise<WeightEntry[]> {
  if (identity.kind === "demo") return listDemoWeightEntries(identity.sessionId);
  return getPrisma().weightRecord.findMany({
    where: { profileId: identity.profileId },
    orderBy: { dateKey: "desc" },
    take: MAX_WEIGHT_ENTRIES,
    select: { id: true, dateKey: true, kg: true, note: true },
  });
}

export async function saveWeightEntry(
  identity: Identity,
  input: { dateKey: string; kg: number; note?: string },
): Promise<WeightEntry> {
  if (identity.kind === "demo") return upsertDemoWeightEntry(identity.sessionId, input);
  return getPrisma().weightRecord.upsert({
    where: { profileId_dateKey: { profileId: identity.profileId, dateKey: input.dateKey } },
    create: {
      profileId: identity.profileId,
      dateKey: input.dateKey,
      kg: input.kg,
      note: input.note ?? "",
    },
    update: {
      kg: input.kg,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    select: { id: true, dateKey: true, kg: true, note: true },
  });
}

export async function patchWeightEntry(
  identity: Identity,
  id: string,
  patch: { kg?: number; note?: string },
): Promise<WeightEntry | null> {
  if (identity.kind === "demo") return updateDemoWeightEntry(identity.sessionId, id, patch);
  const prisma = getPrisma();
  const result = await prisma.weightRecord.updateMany({
    where: { id, profileId: identity.profileId },
    data: {
      ...(patch.kg !== undefined ? { kg: patch.kg } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    },
  });
  if (result.count === 0) return null;
  return prisma.weightRecord.findUnique({
    where: { id },
    select: { id: true, dateKey: true, kg: true, note: true },
  });
}

export async function removeWeightEntry(identity: Identity, id: string): Promise<boolean> {
  if (identity.kind === "demo") return deleteDemoWeightEntry(identity.sessionId, id);
  const result = await getPrisma().weightRecord.deleteMany({
    where: { id, profileId: identity.profileId },
  });
  return result.count > 0;
}

export async function syncProfileWeight(identity: Identity): Promise<void> {
  const profile = await loadProfile(identity);
  if (!profile) return;
  const latest = (await listWeightEntries(identity))[0];
  if (!latest) return;
  const next = latest.kg.toFixed(1);
  if (profile.weightKg === next) return;
  await saveProfile(identity, { ...profile, weightKg: next });
}
