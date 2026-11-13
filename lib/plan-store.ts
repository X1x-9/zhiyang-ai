import { listDemoSessionMeals } from "./demo-data";
import type { Identity } from "./identity";
import { clearDemoAdjustmentMemory, readTodayAdjustment } from "./plan-adjustment-store";
import type { DynamicPlanAdjustment } from "./plan-adjustment";
import { PLANS_WINDOW_DAYS, summarizeMeals, planMealRecordFromDemo, type PlanMealRecord } from "./plan-context";
import { runPlanAgent } from "./plan-agent";
import { buildPlan, type PlanDocument, type PlanRevisionDirective, type PlanVersionSummary } from "./plan-engine";
import { requestPlanRevision } from "./plan-revision";
import { getPrisma } from "./prisma";
import { buildSpaceTargets, type SpaceProfile } from "./space";

export type StoredPlan = {
  plan: PlanDocument;
  persisted: boolean;
  demo: boolean;
};

export type PlanRevisionOverride = {
  directive: PlanRevisionDirective;
  request: string | null;
  baseVersion: number;
};

export type PlanState = {
  plan: PlanDocument | null;
  activePlan: PlanDocument | null;
  activeVersion: number | null;
  versions: PlanVersionSummary[];
  versionTotal: number;
  persisted: boolean;
  demo: boolean;
  adjustment: DynamicPlanAdjustment | null;
};

export class PlanStorageError extends Error {
  constructor() {
    super("PLAN_STORAGE_UNAVAILABLE");
  }
}

export class PlanRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanRevisionError";
  }
}

export class PlanVersionActiveError extends Error {
  constructor() {
    super("PLAN_VERSION_ACTIVE");
    this.name = "PlanVersionActiveError";
  }
}

type MemoryPlanRecord = {
  plan: PlanDocument;
  createdAt: string;
  active: boolean;
};

const globalForPlans = globalThis as unknown as { planMemory?: Map<string, MemoryPlanRecord[]> };

function memoryStore() {
  if (!globalForPlans.planMemory) globalForPlans.planMemory = new Map();
  return globalForPlans.planMemory;
}

function memoryKey(identity: Identity) {
  return identity.kind === "demo" ? `demo:${identity.sessionId}` : `user:${identity.profileId}`;
}

function memoryRecords(identity: Identity) {
  return memoryStore().get(memoryKey(identity)) ?? [];
}

export function clearDemoPlanMemory(sessionId: string) {
  memoryStore().delete(`demo:${sessionId}`);
  clearDemoAdjustmentMemory(sessionId);
}

function toSummary(plan: PlanDocument, active: boolean, isLatest: boolean): PlanVersionSummary {
  return {
    version: plan.version,
    createdAt: plan.generatedAt,
    active,
    isLatest,
    basedOnVersion: plan.revision?.basedOnVersion ?? plan.agent?.inputSummary.currentPlanVersion ?? null,
    summary: plan.revision?.summary ?? plan.coaching?.focusNote ?? "规则引擎生成的计划。",
    inputSummary: plan.agent?.inputSummary ?? null,
  };
}

function demoMealsForPlan(identity: Identity): PlanMealRecord[] {
  if (identity.kind !== "demo") return [];
  const cutoff = Date.now() - PLANS_WINDOW_DAYS * 86_400_000;
  return listDemoSessionMeals(identity.sessionId)
    .filter((meal) => meal.status === "CONFIRMED" && new Date(meal.eatenAt).getTime() >= cutoff)
    .map((meal) => planMealRecordFromDemo(meal));
}

function planContext(profile: SpaceProfile, meals: PlanMealRecord[], currentPlan: PlanDocument | null) {
  const targets = buildSpaceTargets(profile).targets;
  const mealSummary = summarizeMeals(meals, targets, PLANS_WINDOW_DAYS);
  const nextVersion = (currentPlan?.version ?? 0) + 1;
  return { targets, mealSummary, nextVersion };
}

async function runPlanDraft(profile: SpaceProfile, meals: PlanMealRecord[], currentPlan: PlanDocument | null) {
  const { mealSummary, nextVersion, targets } = planContext(profile, meals, currentPlan);
  const agent = await runPlanAgent({
    profile,
    targets,
    mealSummary,
    currentPlanVersion: currentPlan?.version ?? null,
    nextVersion,
  });
  return { mealSummary, agent };
}

async function resolveRevision(
  feedback: string | null | undefined,
  profile: SpaceProfile,
  currentPlan: PlanDocument | null,
): Promise<{ directive: PlanRevisionDirective | null; request: string | null }> {
  const request = feedback?.trim().slice(0, 300) ?? "";
  if (!request) return { directive: null, request: null };
  if (!currentPlan) throw new PlanRevisionError("请先生成一版计划，再输入调整意见。");

  const outcome = await requestPlanRevision({ feedback: request, profile, plan: currentPlan });
  if (outcome.status !== "OK") throw new PlanRevisionError(outcome.message);
  return { directive: outcome.directive, request };
}

function resolveRevisionOverride(
  currentPlan: PlanDocument | null,
  override: PlanRevisionOverride,
): { directive: PlanRevisionDirective; request: string | null } {
  if (!currentPlan) throw new PlanRevisionError("请先生成一版计划，再调整。");
  if (currentPlan.version !== override.baseVersion) {
    throw new PlanRevisionError("计划刚刚有了新版本，请先看一眼再调整。");
  }
  return { directive: override.directive, request: override.request };
}

function composePlan(
  profile: SpaceProfile,
  mealSummary: Awaited<ReturnType<typeof runPlanDraft>>["mealSummary"],
  agent: Awaited<ReturnType<typeof runPlanDraft>>["agent"],
  previousPlan: PlanDocument | null,
  revision: { directive: PlanRevisionDirective | null; request: string | null },
) {
  return buildPlan(profile, (previousPlan?.version ?? 0) + 1, new Date(), {
    mealSummary,
    agent,
    previousPlan,
    revisionDirective: revision.directive,
    revisionRequest: revision.request,
  });
}

function isVersionConflict(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "P2002";
}

async function readLatestPlan(profileId: string): Promise<PlanDocument | null> {
  try {
    const row = await getPrisma().planVersion.findFirst({
      where: { profileId },
      orderBy: { version: "desc" },
    });
    return (row?.plan as unknown as PlanDocument | undefined) ?? null;
  } catch (error) {
    console.error("PLAN LATEST READ ERROR", error);
    throw new PlanStorageError();
  }
}

function saveToMemory(identity: Identity, plan: PlanDocument): StoredPlan {
  if (identity.kind === "demo") clearDemoAdjustmentMemory(identity.sessionId);
  const store = memoryStore();
  const key = memoryKey(identity);
  const versions = store.get(key) ?? [];
  versions.push({ plan, createdAt: plan.generatedAt, active: false });
  store.set(key, versions);
  return { plan, persisted: false, demo: identity.kind === "demo" };
}

export async function generatePlanVersion(
  identity: Identity,
  profile: SpaceProfile,
  feedback?: string | null,
  revisionOverride?: PlanRevisionOverride | null,
): Promise<StoredPlan> {
  if (identity.kind === "demo") {
    const current = memoryRecords(identity)[memoryRecords(identity).length - 1]?.plan ?? null;
    const revision = revisionOverride
      ? resolveRevisionOverride(current, revisionOverride)
      : await resolveRevision(feedback, profile, current);
    const draft = await runPlanDraft(profile, demoMealsForPlan(identity), current);
    const plan = composePlan(profile, draft.mealSummary, draft.agent, current, revision);
    return saveToMemory(identity, plan);
  }
  if (!process.env.DATABASE_URL) throw new PlanStorageError();

  const prisma = getPrisma();
  let latestRow;
  let mealRows;
  try {
    [latestRow, mealRows] = await Promise.all([
      prisma.planVersion.findFirst({
        where: { profileId: identity.profileId },
        orderBy: { version: "desc" },
      }),
      prisma.mealRecord.findMany({
        where: {
          profileId: identity.profileId,
          status: "CONFIRMED",
          eatenAt: { gte: new Date(Date.now() - PLANS_WINDOW_DAYS * 86_400_000) },
        },
        select: {
          title: true,
          mealType: true,
          eatenAt: true,
          estimatedKcal: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
        },
        orderBy: { eatenAt: "desc" },
        take: 50,
      }),
    ]);
  } catch (error) {
    console.error("PLAN INPUT READ ERROR", error);
    throw new PlanStorageError();
  }

  let currentPlan = (latestRow?.plan as unknown as PlanDocument | undefined) ?? null;
  const revision = revisionOverride
    ? resolveRevisionOverride(currentPlan, revisionOverride)
    : await resolveRevision(feedback, profile, currentPlan);
  const meals: PlanMealRecord[] = mealRows.map((meal) => ({
    title: meal.title,
    mealType: meal.mealType,
    eatenAt: meal.eatenAt,
    kcal: meal.estimatedKcal,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
  }));
  const draft = await runPlanDraft(profile, meals, currentPlan);

  for (let attempt = 0; ; attempt += 1) {
    const plan = composePlan(profile, draft.mealSummary, draft.agent, currentPlan, revision);
    try {
      await prisma.planVersion.create({
        data: { profileId: identity.profileId, version: plan.version, plan },
      });
      await prisma.planAdjustment.deleteMany({ where: { profileId: identity.profileId } }).catch((error) => {
        console.error("PLAN ADJUSTMENT INVALIDATE ERROR", error);
      });
      return { plan, persisted: true, demo: false };
    } catch (error) {
      if (isVersionConflict(error) && attempt < 2) {
        if (revisionOverride) {
          throw new PlanRevisionError("计划刚刚有了新版本，请先看一眼再调整。");
        }
        currentPlan = (await readLatestPlan(identity.profileId)) ?? currentPlan;
        continue;
      }
      console.error("PLAN VERSION WRITE ERROR", error);
      throw new PlanStorageError();
    }
  }
}

export async function deletePlanVersions(identity: Identity, versions: number[]): Promise<number> {
  const targets = new Set(versions);
  if (targets.size === 0) return 0;

  if (identity.kind === "demo") {
    const records = memoryRecords(identity);
    if (records.some((record) => targets.has(record.plan.version) && record.active)) {
      throw new PlanVersionActiveError();
    }
    const kept = records.filter((record) => !targets.has(record.plan.version));
    memoryStore().set(memoryKey(identity), kept);
    return records.length - kept.length;
  }
  if (!process.env.DATABASE_URL) throw new PlanStorageError();

  try {
    const prisma = getPrisma();
    const active = await prisma.planVersion.findFirst({
      where: {
        profileId: identity.profileId,
        version: { in: [...targets] },
        activeAt: { not: null },
      },
      select: { version: true },
    });
    if (active) throw new PlanVersionActiveError();
    const result = await prisma.planVersion.deleteMany({
      where: { profileId: identity.profileId, version: { in: [...targets] } },
    });
    return result.count;
  } catch (error) {
    if (error instanceof PlanVersionActiveError) throw error;
    console.error("PLAN DELETE ERROR", error);
    throw new PlanStorageError();
  }
}

export async function activatePlanVersion(identity: Identity, version: number): Promise<PlanDocument | null> {
  if (identity.kind === "demo") {
    const records = memoryRecords(identity);
    const target = records.find((record) => record.plan.version === version);
    if (!target) return null;
    for (const record of records) record.active = record === target;
    return target.plan;
  }
  if (!process.env.DATABASE_URL) throw new PlanStorageError();

  try {
    const prisma = getPrisma();
    const target = await prisma.planVersion.findFirst({
      where: { profileId: identity.profileId, version },
    });
    if (!target) return null;
    await prisma.$transaction([
      prisma.planVersion.updateMany({
        where: { profileId: identity.profileId, activeAt: { not: null } },
        data: { activeAt: null },
      }),
      prisma.planVersion.update({
        where: { id: target.id },
        data: { activeAt: new Date() },
      }),
    ]);
    return target.plan as unknown as PlanDocument;
  } catch (error) {
    console.error("PLAN ACTIVATE ERROR", error);
    throw new PlanStorageError();
  }
}

export async function getPlanState(identity: Identity): Promise<PlanState> {
  if (identity.kind === "demo") {
    const records = memoryRecords(identity);
    const latest = records.length > 0 ? records[records.length - 1] : null;
    const active = [...records].reverse().find((record) => record.active) ?? null;
    const adjustment = latest?.plan
      ? await readTodayAdjustment(identity, latest.plan.version).catch(() => null)
      : null;
    return {
      plan: latest?.plan ?? null,
      activePlan: active?.plan ?? null,
      activeVersion: active?.plan.version ?? null,
      versions: [...records].reverse().map((record, index) => toSummary(record.plan, record.active, index === 0)),
      versionTotal: records.length,
      persisted: false,
      demo: true,
      adjustment,
    };
  }
  if (!process.env.DATABASE_URL) throw new PlanStorageError();

  try {
    const prisma = getPrisma();
    const [rows, activeRow, versionTotal] = await Promise.all([
      prisma.planVersion.findMany({
        where: { profileId: identity.profileId },
        orderBy: { version: "desc" },
        take: 8,
      }),
      prisma.planVersion.findFirst({
        where: { profileId: identity.profileId, activeAt: { not: null } },
        orderBy: { activeAt: "desc" },
      }),
      prisma.planVersion.count({ where: { profileId: identity.profileId } }),
    ]);
    const latest = rows[0] ?? null;
    const allRows = activeRow && !rows.some((row) => row.id === activeRow.id)
      ? [...rows, activeRow].sort((a, b) => b.version - a.version)
      : rows;
    const latestPlan = (latest?.plan as unknown as PlanDocument | undefined) ?? null;
    let adjustment: DynamicPlanAdjustment | null = null;
    if (latestPlan) {
      try {
        adjustment = await readTodayAdjustment(identity, latestPlan.version);
      } catch (error) {
        console.error("PLAN ADJUSTMENT READ ERROR", error);
      }
    }
    return {
      plan: latestPlan,
      activePlan: (activeRow?.plan as unknown as PlanDocument | undefined) ?? null,
      activeVersion: activeRow?.version ?? null,
      versions: allRows.map((row) => {
        const plan = row.plan as unknown as PlanDocument;
        return toSummary(plan, row.activeAt !== null, row.id === latest?.id);
      }),
      versionTotal,
      persisted: true,
      demo: false,
      adjustment,
    };
  } catch (error) {
    console.error("PLAN LATEST ERROR", error);
    throw new PlanStorageError();
  }
}

export async function getLatestPlan(identity: Identity): Promise<StoredPlan | null> {
  const state = await getPlanState(identity);
  return state.plan
    ? { plan: state.plan, persisted: state.persisted, demo: state.demo }
    : null;
}
