import type { Identity } from "./identity";
import { getPrisma } from "./prisma";
import { isWorkoutComplete, type WorkoutRecord, type WorkoutStepInput } from "./workout";

const globalForDemoWorkouts = globalThis as unknown as {
  demoWorkoutSessions?: Map<string, Map<string, WorkoutRecord>>;
};

function demoStore(sessionId: string) {
  if (!globalForDemoWorkouts.demoWorkoutSessions) globalForDemoWorkouts.demoWorkoutSessions = new Map();
  const sessions = globalForDemoWorkouts.demoWorkoutSessions;
  let store = sessions.get(sessionId);
  if (!store) {
    store = new Map();
    sessions.set(sessionId, store);
    if (sessions.size > 200) {
      const oldest = sessions.keys().next().value;
      if (oldest && oldest !== sessionId) sessions.delete(oldest);
    }
  }
  return store;
}

function recordKey(dateKey: string, sessionKey: string) {
  return `${dateKey}|${sessionKey}`;
}

function normalizeSteps(value: unknown): boolean[] {
  return Array.isArray(value) ? value.map((step) => step === true) : [];
}

export function listDemoWorkoutRecords(sessionId: string, weekStartKey: string, weekEndKey: string): WorkoutRecord[] {
  return [...demoStore(sessionId).values()]
    .filter((record) => record.dateKey >= weekStartKey && record.dateKey <= weekEndKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.sessionKey.localeCompare(b.sessionKey))
    .map((record) => ({ ...record, steps: [...record.steps] }));
}

export async function listWorkoutRecords(
  identity: Identity,
  weekStartKey: string,
  weekEndKey: string,
): Promise<WorkoutRecord[]> {
  if (identity.kind === "demo") return listDemoWorkoutRecords(identity.sessionId, weekStartKey, weekEndKey);
  const rows = await getPrisma().workoutRecord.findMany({
    where: {
      profileId: identity.profileId,
      dateKey: { gte: weekStartKey, lte: weekEndKey },
    },
    orderBy: [{ dateKey: "asc" }, { sessionKey: "asc" }],
    select: {
      dateKey: true,
      sessionKey: true,
      title: true,
      minutes: true,
      steps: true,
      completedAt: true,
    },
  });
  return rows.map((row) => ({
    dateKey: row.dateKey,
    sessionKey: row.sessionKey,
    title: row.title,
    minutes: row.minutes,
    steps: normalizeSteps(row.steps),
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
}

export async function saveWorkoutRecord(identity: Identity, input: WorkoutStepInput): Promise<WorkoutRecord> {
  const completedAt = isWorkoutComplete(input.steps) ? new Date().toISOString() : null;
  const record: WorkoutRecord = {
    dateKey: input.dateKey,
    sessionKey: input.sessionKey,
    title: input.title,
    minutes: input.minutes,
    steps: [...input.steps],
    completedAt,
  };

  if (identity.kind === "demo") {
    demoStore(identity.sessionId).set(recordKey(input.dateKey, input.sessionKey), record);
    return record;
  }

  const row = await getPrisma().workoutRecord.upsert({
    where: {
      profileId_dateKey_sessionKey: {
        profileId: identity.profileId,
        dateKey: input.dateKey,
        sessionKey: input.sessionKey,
      },
    },
    create: {
      profileId: identity.profileId,
      dateKey: input.dateKey,
      sessionKey: input.sessionKey,
      title: input.title,
      minutes: input.minutes,
      steps: input.steps,
      completedAt: completedAt ? new Date(completedAt) : null,
    },
    update: {
      title: input.title,
      minutes: input.minutes,
      steps: input.steps,
      completedAt: completedAt ? new Date(completedAt) : null,
    },
    select: {
      dateKey: true,
      sessionKey: true,
      title: true,
      minutes: true,
      steps: true,
      completedAt: true,
    },
  });
  return {
    dateKey: row.dateKey,
    sessionKey: row.sessionKey,
    title: row.title,
    minutes: row.minutes,
    steps: normalizeSteps(row.steps),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
