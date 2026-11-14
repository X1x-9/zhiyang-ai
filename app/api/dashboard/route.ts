import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  chinaDateKey,
  chinaDateLabel,
  chinaDayRange,
  chinaGreeting,
  chinaWeekStart,
  createDemoDashboard,
} from "@/lib/demo-data";
import { IdentityError, resolveIdentity } from "@/lib/identity";
import { deriveNutritionTargets } from "@/lib/nutrition-goal";
import { loadProfile } from "@/lib/profile-store";
import { chinaWeekDates, profileWeightPoint, weightDateLabel, type WeekSummary } from "@/lib/dashboard";
import { readProfileWeightKg } from "@/lib/space";
import { listWeightEntries } from "@/lib/weight-store";
import { listWorkoutRecords } from "@/lib/workout-store";

export async function GET() {
  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json(
        { error: "AUTH_REQUIRED", message: "请先登录后再访问个人健康数据。" },
        { status: 401 },
      );
    }

    const weekDates = chinaWeekDates();
    const weekStartKey = weekDates[0].key;
    const weekEndKey = weekDates[6].key;
    const workoutRecords = await listWorkoutRecords(identity, weekStartKey, weekEndKey);

    if (identity.kind === "demo") {
      return NextResponse.json(createDemoDashboard(identity.sessionId, undefined, workoutRecords));
    }

    const prisma = getPrisma();
    const profile = await loadProfile(identity);
    const targets = deriveNutritionTargets(profile);

    const { start, end } = chinaDayRange();
    const weekStart = chinaWeekStart();
    const [todayMeals, pendingMeals, weekMeals, weightEntries] = await Promise.all([
      prisma.mealRecord.findMany({
        where: { profileId: identity.profileId, status: "CONFIRMED", eatenAt: { gte: start, lt: end } },
        select: { estimatedKcal: true, proteinG: true, carbsG: true, fatG: true },
      }),
      prisma.mealRecord.count({ where: { profileId: identity.profileId, status: "PENDING", eatenAt: { gte: start, lt: end } } }),
      prisma.mealRecord.findMany({
        where: { profileId: identity.profileId, status: "CONFIRMED", eatenAt: { gte: weekStart, lt: end } },
        select: { eatenAt: true, estimatedKcal: true },
      }),
      listWeightEntries(identity),
    ]);

    const calories = todayMeals.reduce((sum, meal) => sum + (meal.estimatedKcal ?? 0), 0);
    const macroMeals = todayMeals.filter((meal) => meal.proteinG !== null && meal.carbsG !== null && meal.fatG !== null);
    const macros = macroMeals.length > 0
      ? {
          protein: {
            consumed: Math.round(macroMeals.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0)),
            goal: targets.proteinGoal,
          },
          carbs: {
            consumed: Math.round(macroMeals.reduce((sum, meal) => sum + (meal.carbsG ?? 0), 0)),
            goal: targets.carbsGoal,
          },
          fat: {
            consumed: Math.round(macroMeals.reduce((sum, meal) => sum + (meal.fatG ?? 0), 0)),
            goal: targets.fatGoal,
          },
          partial: macroMeals.length < todayMeals.length,
        }
      : null;

    const weekDays = weekDates.map((day) => {
      const dayMeals = weekMeals.filter((meal) => chinaDateKey(meal.eatenAt) === day.key);
      const workoutMinutes = workoutRecords
        .filter((record) => record.dateKey === day.key && record.completedAt)
        .reduce((sum, record) => sum + record.minutes, 0);
      return {
        ...day,
        meals: dayMeals.length,
        calories: dayMeals.reduce((sum, meal) => sum + (meal.estimatedKcal ?? 0), 0),
        workoutMinutes: workoutMinutes > 0 ? workoutMinutes : null,
      };
    });
    const recordedDays = weekDays.filter((day) => day.meals > 0).length;
    const weekWorkouts = workoutRecords.filter((record) => record.completedAt).length;
    const todayKey = chinaDateKey();
    const latestWeight = weightEntries[0] ?? null;
    const previousWeight = weightEntries[1] ?? null;
    const profilePoint = profileWeightPoint(readProfileWeightKg(profile));
    const recordSeries = weightEntries
      .slice(0, 7)
      .reverse()
      .map((entry) => ({ label: weightDateLabel(entry.dateKey), kg: entry.kg }));
    const weightSeries = profilePoint ? [profilePoint, ...recordSeries] : recordSeries;
    const weekWeightEntries = weightEntries.filter((entry) => entry.dateKey >= weekStartKey && entry.dateKey <= todayKey).length;
    const week: WeekSummary = {
      recordedDays,
      meals: weekMeals.length,
      workouts: weekWorkouts,
      weightEntries: weekWeightEntries,
      note:
        recordedDays >= 4
          ? `本周已有 ${recordedDays} 天记录${weekWorkouts > 0 ? `、${weekWorkouts} 次训练` : ""}；复盘只按已有记录呈现，不补推缺失数据。`
          : `本周只有 ${recordedDays} 天饮食记录，暂不对执行情况做评价。`,
      days: weekDays,
    };

    return NextResponse.json({
      demo: false,
      dateLabel: chinaDateLabel(),
      greeting: chinaGreeting(),
      displayName: profile?.name.trim() || identity.displayName,
      calories,
      calorieGoal: targets.calorieGoal,
      macros,
      waterMl: 0,
      waterGoal: 2000,
      waterHistory: {},
      weightKg: latestWeight?.kg ?? profilePoint?.kg ?? null,
      weightChangeKg: latestWeight && previousWeight ? Math.round((latestWeight.kg - previousWeight.kg) * 10) / 10 : null,
      weightSeries,
      weightSource: latestWeight ? "records" : profilePoint ? "profile" : null,
      pendingMeals,
      mealsToday: todayMeals.length,
      workout: null,
      week,
    });
  } catch (error) {
    if (error instanceof IdentityError) {
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE", message: "数据服务暂时不可用，请稍后重试。" }, { status: 503 });
    }
    console.error("DASHBOARD ERROR", error);
    return NextResponse.json({ error: "DASHBOARD_UNAVAILABLE", message: "暂时无法整理今日数据，请稍后重试。" }, { status: 503 });
  }
}
