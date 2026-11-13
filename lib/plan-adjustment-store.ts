import { chinaDateKey, chinaDayRange, listDemoMeals } from "./demo-data";
import type { Identity } from "./identity";
import type { ConfirmedMealInput, DynamicPlanAdjustment } from "./plan-adjustment";
import { getPrisma } from "./prisma";

export class AdjustmentStorageError extends Error {
  constructor() {
    super("ADJUSTMENT_STORAGE_UNAVAILABLE");
    this.name = "AdjustmentStorageError";
  }
}

const globalForAdjustments = globalThis as unknown as {
  planAdjustmentMemory?: Map<string, Map<string, DynamicPlanAdjustment>>;
};

function memoryStore() {
  if (!globalForAdjustments.planAdjustmentMemory) globalForAdjustments.planAdjustmentMemory = new Map();
  return globalForAdjustments.planAdjustmentMemory;
}

function sessionAdjustments(sessionId: string) {
  const store = memoryStore();
  let adjustments = store.get(sessionId);
  if (!adjustments) {
    adjustments = new Map();
    store.set(sessionId, adjustments);
    if (store.size > 200) {
      const oldest = store.keys().next().value;
      if (oldest && oldest !== sessionId) store.delete(oldest);
    }
  }
  return adjustments;
}

export function clearDemoAdjustmentMemory(sessionId: string) {
  memoryStore().delete(sessionId);
}

export async function loadConfirmedMealsToday(identity: Identity): Promise<ConfirmedMealInput[]> {
  if (identity.kind === "demo") {
    return listDemoMeals(identity.sessionId)
      .filter((meal) => meal.status === "CONFIRMED")
      .map((meal) => ({
        id: meal.id,
        title: meal.title,
        mealType: meal.mealType,
        kcal: meal.estimatedKcal,
        eatenAt: meal.eatenAt,
        macroComplete: meal.proteinG !== null && meal.carbsG !== null && meal.fatG !== null,
      }));
  }

  try {
    const { start, end } = chinaDayRange();
    const rows = await getPrisma().mealRecord.findMany({
      where: { profileId: identity.profileId, status: "CONFIRMED", eatenAt: { gte: start, lt: end } },
      select: {
        id: true,
        title: true,
        mealType: true,
        estimatedKcal: true,
        eatenAt: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
      },
      orderBy: { eatenAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      mealType: row.mealType,
      kcal: row.estimatedKcal,
      eatenAt: row.eatenAt.toISOString(),
      macroComplete: row.proteinG !== null && row.carbsG !== null && row.fatG !== null,
    }));
  } catch (error) {
    console.error("ADJUSTMENT MEALS READ ERROR", error);
    throw new AdjustmentStorageError();
  }
}

export async function readTodayAdjustment(
  identity: Identity,
  baseVersion: number,
): Promise<DynamicPlanAdjustment | null> {
  const dayKey = chinaDateKey();
  if (identity.kind === "demo") {
    const stored = sessionAdjustments(identity.sessionId).get(dayKey) ?? null;
    return stored && stored.baseVersion === baseVersion ? stored : null;
  }

  try {
    const row = await getPrisma().planAdjustment.findUnique({
      where: { profileId_dayKey: { profileId: identity.profileId, dayKey } },
    });
    if (!row) return null;
    const adjustment = row.adjustment as unknown as DynamicPlanAdjustment;
    if (!adjustment || typeof adjustment !== "object") return null;
    return adjustment.baseVersion === baseVersion ? adjustment : null;
  } catch (error) {
    console.error("ADJUSTMENT READ ERROR", error);
    throw new AdjustmentStorageError();
  }
}

export async function saveAdjustment(
  identity: Identity,
  adjustment: DynamicPlanAdjustment,
): Promise<DynamicPlanAdjustment> {
  if (identity.kind === "demo") {
    sessionAdjustments(identity.sessionId).set(adjustment.dayKey, adjustment);
    return adjustment;
  }

  try {
    const row = await getPrisma().planAdjustment.upsert({
      where: { profileId_dayKey: { profileId: identity.profileId, dayKey: adjustment.dayKey } },
      create: {
        profileId: identity.profileId,
        dayKey: adjustment.dayKey,
        nextDayKey: adjustment.nextDayKey,
        baseVersion: adjustment.baseVersion,
        adjustment,
      },
      update: {
        nextDayKey: adjustment.nextDayKey,
        baseVersion: adjustment.baseVersion,
        adjustment,
      },
    });
    return row.adjustment as unknown as DynamicPlanAdjustment;
  } catch (error) {
    console.error("ADJUSTMENT WRITE ERROR", error);
    throw new AdjustmentStorageError();
  }
}

export async function deleteTodayAdjustment(identity: Identity): Promise<boolean> {
  const dayKey = chinaDateKey();
  if (identity.kind === "demo") {
    return sessionAdjustments(identity.sessionId).delete(dayKey);
  }

  try {
    const result = await getPrisma().planAdjustment.deleteMany({
      where: { profileId: identity.profileId, dayKey },
    });
    return result.count > 0;
  } catch (error) {
    console.error("ADJUSTMENT DELETE ERROR", error);
    throw new AdjustmentStorageError();
  }
}

export async function clearAdjustments(identity: Identity): Promise<void> {
  if (identity.kind === "demo") {
    clearDemoAdjustmentMemory(identity.sessionId);
    return;
  }
  await getPrisma().planAdjustment.deleteMany({ where: { profileId: identity.profileId } });
}
