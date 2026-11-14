import {
  activityText,
  buildDietPlan,
  buildGoalLine,
  buildMovementPlan,
  buildSpaceTargets,
  dietText,
  equipmentText,
  goalText,
  spaceCompleteness,
  type DietSlot,
  type SpaceDays,
  type SpaceDiet,
  type SpaceEquipment,
  type SpaceMinutes,
  type MovementWeatherForecast,
  type SpaceProfile,
  type SpaceTargets,
} from "./space";
import type { PlanMealSummary } from "./plan-context";
import type { WeatherForecast } from "./weather";

export const PLAN_SCHEMA_VERSION = 3;
export const PLAN_ENGINE_VERSION = "2026-11.4";
export const PLAN_ENGINE_NAME = "智养规则引擎";

export type PlanMeal = DietSlot & { kcalHint: string | null };

export type PlanSafety = {
  flags: string[];
  disclaimer: string;
};

export type PlanDataBasis = {
  source: "demo" | "local";
  usedFields: string[];
  missingFields: string[];
  usesMealRecords: boolean;
  mealRecordCount: number;
  mealRecordedDays: number;
  mealMacroCompleteMeals: number;
  targetMethod: string | null;
  notes: string[];
};

export type PlanProfileSnapshot = {
  name: string;
  goal: string;
  goalLabel: string;
  activityLabel: string;
  environmentLabel: string;
  dietLabel: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  avoid: string;
  budget: string;
};

export type PlanFocus = "none" | "protein_focus" | "portion_focus";
export type PlanAgentStatus = "OK" | "SKIPPED" | "FAILED";
export type PlanRagStatus = "OK" | "NO_MATCH" | "NOT_CONFIGURED" | "RETRIEVAL_FAILED" | "NOT_CALLED";

export type PlanAgentReference = {
  title: string;
  source: string;
  similarity: number;
};

export type PlanAgentToolLog = {
  name: string;
  status: "OK" | "REJECTED" | "ERROR";
  summary: string;
};

export type PlanAgentAdjustment = {
  area: string;
  from: string;
  to: string;
  reason: string;
};

export type PlanAgentCitation = {
  note: string;
  referenceIndex: number;
};

export type PlanInputSummary = {
  profileFields: string[];
  confirmedMeals: number;
  recordedDays: number;
  macroCompleteMeals: number;
  completeDays: number;
  mealWindowDays: number;
  currentPlanVersion: number | null;
};

export type PlanAgentMeta = {
  status: PlanAgentStatus;
  model: string | null;
  fallbackReason: string | null;
  inputSummary: PlanInputSummary;
  toolLog: PlanAgentToolLog[];
  rationale: string[];
  adjustments: PlanAgentAdjustment[];
  references: PlanAgentReference[];
  citations?: PlanAgentCitation[];
  ragStatus: PlanRagStatus;
};

export type PlanVersionSummary = {
  version: number;
  createdAt: string;
  active: boolean;
  isLatest: boolean;
  basedOnVersion: number | null;
  summary: string;
  inputSummary: PlanInputSummary | null;
};

export type PlanAgentDraft = {
  status: PlanAgentStatus;
  model: string | null;
  fallbackReason: string | null;
  focus: PlanFocus;
  focusNote: string | null;
  rationale: string[];
  adjustments: PlanAgentAdjustment[];
  references: PlanAgentReference[];
  citations: PlanAgentCitation[];
  toolLog: PlanAgentToolLog[];
  ragStatus: PlanRagStatus;
};

export type PlanCoaching = {
  focus: PlanFocus;
  focusLabel: string;
  focusNote: string;
  notes: string[];
};

export type PlanRevision = {
  basedOnVersion: number | null;
  changes: Array<{ area: string; before: string; after: string }>;
  summary: string;
  request?: string;
  notes?: string[];
};

export type PlanRevisionMealEdit = {
  index: number;
  label?: string;
  title: string;
  detail: string;
  swap: string;
};

export type PlanRevisionDirective = {
  summary: string;
  notes: string[];
  diet: {
    style: SpaceDiet | null;
    removeSnack: boolean;
    extraAvoid: string | null;
    meals: PlanRevisionMealEdit[];
  } | null;
  movement: {
    days: SpaceDays | null;
    weekdays?: number[] | null;
    minutes: SpaceMinutes | null;
    equipment: SpaceEquipment[] | null;
  } | null;
};

export type PlanRevisionState = {
  diet: {
    style: SpaceDiet | null;
    removeSnack: boolean;
    extraAvoid: string | null;
    mealEdits: PlanRevisionMealEdit[];
  } | null;
  movement: {
    days: SpaceDays | null;
    weekdays?: number[] | null;
    minutes: SpaceMinutes | null;
    equipment: SpaceEquipment[] | null;
  } | null;
};

export type PlanDocument = {
  schemaVersion: number;
  engineVersion: string;
  engineName: string;
  version: number;
  generatedAt: string;
  fingerprint: string;
  profileSnapshot: PlanProfileSnapshot;
  completeness: { filled: number; total: number; missing: string[] };
  dataBasis: PlanDataBasis;
  targets: SpaceTargets | null;
  targetsReason: string | null;
  goalLine: string | null;
  diet: {
    meals: PlanMeal[];
    avoidNote: string;
    budgetNote: string;
  };
  movement: ReturnType<typeof buildMovementPlan>;
  safety: PlanSafety;
  coaching?: PlanCoaching;
  agent?: PlanAgentMeta | null;
  revision?: PlanRevision;
  revisionState?: PlanRevisionState;
};

export type PlanBuildOptions = {
  mealSummary?: PlanMealSummary | null;
  agent?: PlanAgentDraft | null;
  previousPlan?: PlanDocument | null;
  revisionDirective?: PlanRevisionDirective | null;
  revisionRequest?: string | null;
  weather?: WeatherForecast | null;
};

function num(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const fingerprintFields = [
  "name",
  "gender",
  "age",
  "heightCm",
  "weightKg",
  "targetWeightKg",
  "city",
  "goal",
  "activity",
  "days",
  "minutes",
  "equipment",
  "diet",
  "avoid",
  "budget",
] as const;

export function planFingerprint(profile: SpaceProfile) {
  const basis = fingerprintFields.map((key) => String(profile[key] ?? "").trim()).join("|");
  let hash = 2166136261;
  for (let index = 0; index < basis.length; index += 1) {
    hash ^= basis.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `p${(hash >>> 0).toString(36)}`;
}

function mealCalorieSplit(count: number) {
  if (count <= 3) return [0.3, 0.4, 0.3].slice(0, count);
  return [0.25, 0.35, 0.1, 0.3];
}

function buildMealHints(meals: DietSlot[], targets: SpaceTargets | null): PlanMeal[] {
  if (!targets) return meals.map((meal) => ({ ...meal, kcalHint: null }));
  const split = mealCalorieSplit(meals.length);
  return meals.map((meal, index) => {
    const ratio = split[index] ?? 1 / meals.length;
    const low = Math.round((targets.calorieLow * ratio) / 10) * 10;
    const high = Math.round((targets.calorieHigh * ratio) / 10) * 10;
    return { ...meal, kcalHint: `约 ${low}–${high} kcal` };
  });
}

function buildSafety(profile: SpaceProfile, targets: SpaceTargets | null, targetsReason: string | null, mealSummary?: PlanMealSummary | null, revisionState?: PlanRevisionState | null) {
  const flags = [
    "运动以无痛范围为限；胸痛、眩晕、异常气促或心悸时立即停止，必要时就医。",
    "如有慢性病、孕期、饮食障碍史或正在调整用药，先咨询医生或注册营养师。",
  ];
  const weight = num(profile.weightKg);
  const targetWeight = num(profile.targetWeightKg);
  const avoid = profile.avoid.trim();
  const budget = num(profile.budget);

  if (!targets && targetsReason) flags.push(targetsReason);
  if (avoid) flags.push(`已记录忌口：${avoid}；加工食品仍需自行核对配料。`);
  const extraAvoid = revisionState?.diet?.extraAvoid?.trim();
  if (extraAvoid) flags.push(`已按你的意见补充：${extraAvoid}；加工食品仍需自行核对配料。`);
  if (profile.diet === "vegetarian") flags.push("素食需要留意蛋白质、铁和维生素 B12。");
  if (budget !== null) flags.push(`预算约 ¥${budget}/天，仅作采购参考。`);
  if (weight !== null && targetWeight !== null && weight > 0) {
    const change = Math.abs(targetWeight - weight) / weight;
    if (change > 0.1) flags.push("目标体重与当前体重差距超过 10%，建议拆成阶段目标，并和专业人士确认节奏。");
  }
  if (targets && targets.bmi < 18.5 && (profile.goal === "lose" || (weight !== null && targetWeight !== null && targetWeight < weight))) {
    flags.push("按填写的身高体重计算，BMI 低于 18.5 的常见范围，不建议继续减脂；请先咨询医生或营养师。");
  }
  if (profile.goal === "lose") flags.push("热量下限设为 1400 kcal，长期低于需求请先咨询专业人士。");
  if (mealSummary && mealSummary.recordCount > 0 && mealSummary.macroCompleteMeals < mealSummary.recordCount) {
    flags.push(`近 ${mealSummary.windowDays} 天有 ${mealSummary.recordCount - mealSummary.macroCompleteMeals} 餐营养字段不完整，未计入汇总。`);
  }

  return {
    flags,
    disclaimer: "固定规则生成，AI 仅在约束内选择建议重点；不构成医疗诊断、营养处方或效果承诺。",
  };
}

function usedProfileFields(profile: SpaceProfile) {
  const usedFields: string[] = ["称呼", "健康目标", "活动水平", "每周次数", "每次时长", "可用器械", "饮食偏好"];
  if (profile.gender !== "unspecified") usedFields.unshift("性别");
  if (profile.age.trim()) usedFields.push("年龄");
  if (profile.heightCm.trim()) usedFields.push("身高");
  if (profile.weightKg.trim()) usedFields.push("体重");
  if (profile.targetWeightKg.trim()) usedFields.push("目标体重");
  if (profile.city.trim()) usedFields.push("所在城市");
  if (profile.avoid.trim()) usedFields.push("忌口");
  if (profile.budget.trim()) usedFields.push("预算");
  return usedFields;
}

function combineExtraAvoid(previous: string | null | undefined, next: string | null | undefined) {
  const parts = [previous, next?.trim()].filter((value): value is string => Boolean(value && value.trim()));
  if (parts.length === 0) return null;
  const unique: string[] = [];
  for (const part of parts) {
    for (const piece of part.split(/[、,，;；]/)) {
      const value = piece.trim();
      if (value && !unique.includes(value)) unique.push(value);
    }
  }
  return unique.length > 0 ? unique.join("、") : null;
}

function mergeRevisionState(
  previous: PlanRevisionState | null | undefined,
  directive: PlanRevisionDirective | null,
): PlanRevisionState | undefined {
  const prev = previous ?? null;
  if (!directive) return prev ?? undefined;

  let diet = prev?.diet ?? null;
  if (directive.diet) {
    const incoming = directive.diet;
    const baseEdits = incoming.style ? [] : [...(diet?.mealEdits ?? [])];
    const incomingLabels = new Set(incoming.meals.map((edit) => edit.label).filter(Boolean));
    const incomingIndexes = new Set(incoming.meals.map((edit) => edit.index));
    const edits = baseEdits.filter((edit) => (edit.label ? !incomingLabels.has(edit.label) : !incomingIndexes.has(edit.index)));
    edits.push(...incoming.meals);
    diet = {
      style: incoming.style ?? diet?.style ?? null,
      removeSnack: Boolean(diet?.removeSnack || incoming.removeSnack),
      extraAvoid: combineExtraAvoid(diet?.extraAvoid, incoming.extraAvoid),
      mealEdits: edits,
    };
  }

  let movement = prev?.movement ?? null;
  if (directive.movement) {
    movement = {
      days: directive.movement.days ?? movement?.days ?? null,
      weekdays: directive.movement.weekdays ?? movement?.weekdays ?? null,
      minutes: directive.movement.minutes ?? movement?.minutes ?? null,
      equipment: directive.movement.equipment ?? movement?.equipment ?? null,
    };
  }

  const dietActive = Boolean(diet && (diet.style || diet.removeSnack || diet.extraAvoid || diet.mealEdits.length > 0));
  const movementActive = Boolean(movement && (movement.days || movement.weekdays?.length || movement.minutes || movement.equipment?.length));
  if (!dietActive && !movementActive) return prev ?? undefined;
  return { diet: dietActive ? diet : null, movement: movementActive ? movement : null };
}

function buildPlanDiet(profile: SpaceProfile, state: PlanRevisionState | null | undefined) {
  const dietState = state?.diet ?? null;
  const requestedStyle = dietState?.style ?? null;
  const style = requestedStyle && !(profile.diet === "vegetarian" && requestedStyle !== "vegetarian")
    ? requestedStyle
    : profile.diet;
  const diet = buildDietPlan(style !== profile.diet ? { ...profile, diet: style } : profile);
  const editsByLabel = new Map<string, PlanRevisionMealEdit>();
  const editsByIndex = new Map<number, PlanRevisionMealEdit>();
  for (const edit of dietState?.mealEdits ?? []) {
    if (edit.label) editsByLabel.set(edit.label, edit);
    else editsByIndex.set(edit.index, edit);
  }
  let meals = diet.meals.map((meal, index) => {
    const edit = editsByLabel.get(meal.label) ?? editsByIndex.get(index);
    return edit ? { ...meal, title: edit.title, detail: edit.detail, swap: edit.swap } : meal;
  });
  if (dietState?.removeSnack) meals = meals.filter((meal) => meal.label !== "加餐");
  const extraAvoid = dietState?.extraAvoid?.trim();
  return {
    meals,
    avoidNote: extraAvoid
      ? `${diet.avoidNote} 本次按你的意见补充：${extraAvoid}；配料仍需本人确认。`
      : diet.avoidNote,
    budgetNote: diet.budgetNote,
  };
}

function buildPlanMovement(profile: SpaceProfile, state: PlanRevisionState | null | undefined, weather: WeatherForecast | null | undefined, now: Date) {
  const movement = state?.movement;
  const next: SpaceProfile = movement
    ? {
        ...profile,
        days: movement.days ?? profile.days,
        minutes: movement.minutes ?? profile.minutes,
        equipment: movement.equipment ?? profile.equipment,
      }
    : profile;
  return buildMovementPlan(next, toMovementWeather(weather, now), movement?.weekdays ?? null);
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function currentWeekDates(now: Date) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return `${day.getFullYear()}-${padDatePart(day.getMonth() + 1)}-${padDatePart(day.getDate())}`;
  });
}

function toMovementWeather(weather: WeatherForecast | null | undefined, now: Date): MovementWeatherForecast | null {
  if (!weather?.ok || !weather.city || weather.days.length === 0) return null;
  const weekDates = currentWeekDates(now);
  const days = weather.days.flatMap((day) => {
    const weekday = weekDates.indexOf(day.date);
    if (weekday === -1) return [];
    return [{
      weekday,
      date: day.date,
      weather: day.weather,
      precipitationProbability: day.precipitationProbability,
      tempMaxC: day.tempMaxC,
      tempMinC: day.tempMinC,
      windSpeedMaxKmh: day.windSpeedMaxKmh,
    }];
  });
  if (days.length === 0) return null;
  return { city: weather.city, days };
}

function buildDataBasis(profile: SpaceProfile, targets: SpaceTargets | null, mealSummary?: PlanMealSummary | null, agent?: PlanAgentDraft | null, revision?: PlanRevisionDirective | null): PlanDataBasis {
  const completeness = spaceCompleteness(profile);
  const usedFields = usedProfileFields(profile);
  if (mealSummary?.recordCount) usedFields.push("近 7 天已确认餐食");

  const notes: string[] = [];
  if (!mealSummary?.recordCount) {
    notes.push("近 7 天没有已确认餐食，本次只按资料生成。");
  } else {
    notes.push(`读取 ${mealSummary.recordCount} 餐已确认记录（${mealSummary.recordedDays} 天），其中 ${mealSummary.macroCompleteMeals} 餐营养字段完整。`);
    if (mealSummary.macroCompleteMeals < mealSummary.recordCount) {
      notes.push("营养字段不完整的餐食未计入汇总。");
    }
    if (mealSummary.completeDayCount < 2) {
      notes.push("完整记录不足 2 天，本次不按单日数据调整。");
    }
  }
  notes.push("热量与蛋白质为区间参考。");
  notes.push("餐次结构与替换来自固定模板，并按饮食偏好与可用器械选择。");
  if (revision) {
    notes.push("本版按你的调整意见重排了餐次或训练安排；热量、蛋白质与安全边界仍由规则计算。");
  }
  if (agent?.status === "OK") {
    notes.push("AI 仅选择建议重点，数值与安全边界由规则完成。");
  } else if (agent) {
    notes.push("AI 建议未完成，计划仍按规则生成。");
  }

  return {
    source: profile.source,
    usedFields,
    missingFields: completeness.missing,
    usesMealRecords: Boolean(mealSummary?.recordCount),
    mealRecordCount: mealSummary?.recordCount ?? 0,
    mealRecordedDays: mealSummary?.recordedDays ?? 0,
    mealMacroCompleteMeals: mealSummary?.macroCompleteMeals ?? 0,
    targetMethod: targets ? "Mifflin-St Jeor 公式 + 活动系数 + 目标偏移，热量下限 1400 kcal" : null,
    notes,
  };
}

const focusLabels: Record<PlanFocus, string> = {
  none: "无针对性调整",
  protein_focus: "蛋白质重点",
  portion_focus: "份量重点",
};

function buildCoaching(mealSummary?: PlanMealSummary | null, agent?: PlanAgentDraft | null): PlanCoaching {
  const focus = agent?.focus ?? "none";
  let focusNote = agent?.focusNote?.trim() || "";
  if (!focusNote) {
    if (!mealSummary?.recordCount) {
      focusNote = "近 7 天没有已确认餐食，只按资料生成。";
    } else if (mealSummary.completeDayCount < 2) {
      focusNote = "完整记录不足 2 天，暂不调整计划。";
    } else {
      focusNote = "没有触发可安全执行的调整，保持现有结构。";
    }
  }
  return {
    focus,
    focusLabel: focusLabels[focus],
    focusNote,
    notes: agent?.rationale?.length ? agent.rationale : [focusNote],
  };
}

function buildInputSummary(profile: SpaceProfile, mealSummary?: PlanMealSummary | null, currentPlanVersion?: number | null): PlanInputSummary {
  return {
    profileFields: usedProfileFields(profile),
    confirmedMeals: mealSummary?.recordCount ?? 0,
    recordedDays: mealSummary?.recordedDays ?? 0,
    macroCompleteMeals: mealSummary?.macroCompleteMeals ?? 0,
    completeDays: mealSummary?.completeDayCount ?? 0,
    mealWindowDays: mealSummary?.windowDays ?? 7,
    currentPlanVersion: currentPlanVersion ?? null,
  };
}

function buildAgentMeta(agent: PlanAgentDraft, profile: SpaceProfile, mealSummary?: PlanMealSummary | null, currentPlanVersion?: number | null): PlanAgentMeta {
  return {
    status: agent.status,
    model: agent.model,
    fallbackReason: agent.fallbackReason,
    inputSummary: buildInputSummary(profile, mealSummary, currentPlanVersion),
    toolLog: agent.toolLog,
    rationale: agent.rationale,
    adjustments: agent.adjustments,
    references: agent.references,
    citations: agent.citations,
    ragStatus: agent.ragStatus,
  };
}

function targetsSignature(targets: SpaceTargets | null) {
  return targets
    ? `${targets.calorieLow}-${targets.calorieHigh} kcal · 蛋白质 ${targets.proteinLow}-${targets.proteinHigh} g · 饮水 ${targets.waterLow}-${targets.waterHigh} L`
    : "未生成热量与蛋白质目标";
}

function mealSignature(plan: PlanDocument) {
  return plan.diet.meals.map((meal) => `${meal.label}：${meal.title}`).join("；");
}

function movementSignature(plan: PlanDocument) {
  const days = plan.movement.sessions.map((session) => session.day).join("、") || "无训练日";
  return `每周 ${plan.movement.sessionCount} 次 · ${days} · 约 ${plan.movement.totalMinutes} 分钟 · ${plan.movement.environmentLabel}`;
}

function revisionSummary(previous: PlanDocument | null, plan: PlanDocument, changes: PlanRevision["changes"], requested: boolean) {
  if (!previous) return requested ? "首版：按资料与你的调整意见建立计划。" : "首版：按资料建立热量、餐次与训练结构。";
  if (changes.length === 0) {
    return requested
      ? "按你的意见更新了计划说明；热量、餐次与训练结构未变。"
      : "本次未改动热量、餐次或训练结构；新增了基于记录的建议说明与版本依据。";
  }
  return `${requested ? "按你的意见" : "本次"}调整了 ${changes.map((change) => change.area).join("、")}；其余结构保持不变。`;
}

function buildRevision(
  previousPlan: PlanDocument | null | undefined,
  plan: PlanDocument,
  request?: string | null,
  notes?: string[],
): PlanRevision {
  const requested = Boolean(request);
  if (!previousPlan) {
    return {
      basedOnVersion: null,
      changes: [],
      summary: revisionSummary(null, plan, [], requested),
      ...(request ? { request } : {}),
      ...(notes?.length ? { notes } : {}),
    };
  }

  const changes: PlanRevision["changes"] = [];
  const previousTargets = targetsSignature(previousPlan.targets);
  const nextTargets = targetsSignature(plan.targets);
  if (previousTargets !== nextTargets) {
    changes.push({ area: "热量与蛋白质", before: previousTargets, after: nextTargets });
  }
  const previousMeals = mealSignature(previousPlan);
  const nextMeals = mealSignature(plan);
  if (previousMeals !== nextMeals) {
    changes.push({ area: "餐次结构", before: previousMeals, after: nextMeals });
  }
  const previousAvoid = previousPlan.diet.avoidNote;
  const nextAvoid = plan.diet.avoidNote;
  if (previousAvoid !== nextAvoid) {
    changes.push({ area: "忌口与替换说明", before: previousAvoid, after: nextAvoid });
  }
  const previousMovement = movementSignature(previousPlan);
  const nextMovement = movementSignature(plan);
  if (previousMovement !== nextMovement) {
    changes.push({ area: "训练安排", before: previousMovement, after: nextMovement });
  }
  const previousFocus = previousPlan.coaching?.focusLabel ?? "无针对性调整";
  const nextFocus = plan.coaching?.focusLabel ?? "无针对性调整";
  if (previousFocus !== nextFocus) {
    changes.push({ area: "建议重点", before: previousFocus, after: nextFocus });
  }

  return {
    basedOnVersion: previousPlan.version,
    changes,
    summary: revisionSummary(previousPlan, plan, changes, requested),
    ...(request ? { request } : {}),
    ...(notes?.length ? { notes } : {}),
  };
}

export function buildPlan(profile: SpaceProfile, version = 1, now = new Date(), options: PlanBuildOptions = {}): PlanDocument {
  const targetResult = buildSpaceTargets(profile);
  const revisionDirective = options.revisionDirective ?? null;
  const revisionRequest = options.revisionRequest?.trim() || null;
  const previousPlan = options.previousPlan ?? null;
  const revisionState = mergeRevisionState(previousPlan?.revisionState, revisionDirective);
  const diet = buildPlanDiet(profile, revisionState);
  const movement = buildPlanMovement(profile, revisionState, options.weather, now);
  const completeness = spaceCompleteness(profile);
  const targets = targetResult.targets;
  const mealSummary = options.mealSummary;
  const agent = options.agent;
  const coaching = buildCoaching(mealSummary, agent);

  const plan: PlanDocument = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    engineVersion: PLAN_ENGINE_VERSION,
    engineName: PLAN_ENGINE_NAME,
    version,
    generatedAt: now.toISOString(),
    fingerprint: planFingerprint(profile),
    profileSnapshot: {
      name: profile.name,
      goal: profile.goal,
      goalLabel: goalText(profile.goal),
      activityLabel: activityText(profile.activity),
      environmentLabel: equipmentText(profile.equipment),
      dietLabel: dietText(profile.diet),
      age: profile.age,
      gender: profile.gender,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      targetWeightKg: profile.targetWeightKg,
      avoid: profile.avoid,
      budget: profile.budget,
    },
    completeness,
    dataBasis: buildDataBasis(profile, targets, mealSummary, agent, revisionDirective),
    targets,
    targetsReason: targetResult.reason,
    goalLine: buildGoalLine(profile),
    diet: {
      meals: buildMealHints(diet.meals, targets),
      avoidNote: diet.avoidNote,
      budgetNote: diet.budgetNote,
    },
    movement,
    safety: buildSafety(profile, targets, targetResult.reason, mealSummary, revisionState),
    coaching,
    agent: agent ? buildAgentMeta(agent, profile, mealSummary, previousPlan?.version ?? null) : null,
    revision: {
      basedOnVersion: previousPlan?.version ?? null,
      changes: [],
      summary: "",
    },
    ...(revisionState ? { revisionState } : {}),
  };

  plan.revision = buildRevision(previousPlan, plan, revisionRequest, revisionDirective?.notes);
  return plan;
}
