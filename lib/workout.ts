export type WorkoutRecord = {
  dateKey: string;
  sessionKey: string;
  title: string;
  minutes: number;
  steps: boolean[];
  completedAt: string | null;
};

export type WorkoutWeekResponse = {
  demo: boolean;
  weekStartKey: string;
  todayKey: string;
  records: WorkoutRecord[];
};

export type WorkoutStepInput = {
  dateKey: string;
  sessionKey: string;
  title: string;
  minutes: number;
  steps: boolean[];
};

export function isWorkoutComplete(steps: boolean[]) {
  return steps.length > 0 && steps.every(Boolean);
}

export async function getWorkoutWeek(): Promise<WorkoutWeekResponse> {
  const response = await fetch("/api/workouts");
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "暂时无法读取训练记录，请稍后重试。");
  }
  return response.json() as Promise<WorkoutWeekResponse>;
}

export async function saveWorkoutSteps(input: WorkoutStepInput): Promise<{ demo: boolean; record: WorkoutRecord }> {
  const response = await fetch("/api/workouts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json().catch(() => null)) as { demo?: boolean; record?: WorkoutRecord; message?: string } | null;
  if (!response.ok || !data?.record) {
    throw new Error(data?.message ?? "完成状态没有保存成功，请稍后重试。");
  }
  return { demo: Boolean(data.demo), record: data.record };
}
