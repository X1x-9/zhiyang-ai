import { buildSpaceTargets, type SpaceProfile } from "./space";

export type NutritionTargets = {
  calorieGoal: number | null;
  proteinGoal: number | null;
  carbsGoal: number | null;
  fatGoal: number | null;
};

export const DEMO_NUTRITION_TARGETS: NutritionTargets = {
  calorieGoal: 2250,
  proteinGoal: 125,
  carbsGoal: 230,
  fatGoal: 74,
};

export function deriveNutritionTargets(profile: SpaceProfile | null): NutritionTargets {
  if (!profile) return { calorieGoal: null, proteinGoal: null, carbsGoal: null, fatGoal: null };
  const { targets } = buildSpaceTargets(profile);
  if (!targets) return { calorieGoal: null, proteinGoal: null, carbsGoal: null, fatGoal: null };

  const calorieGoal = Math.round((targets.calorieLow + targets.calorieHigh) / 2 / 10) * 10;
  const proteinGoal = Math.round((targets.proteinLow + targets.proteinHigh) / 2);
  const fatGoal = Math.round((calorieGoal * 0.27) / 9);
  const carbsGoal = Math.max(0, Math.round((calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4));

  return { calorieGoal, proteinGoal, carbsGoal, fatGoal };
}

export function roundMacro(value: number) {
  return Math.round(value * 10) / 10;
}
