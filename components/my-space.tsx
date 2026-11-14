"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleAlert,
  Info,
  RotateCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { GrowingLoader, Reveal } from "@/components/experience";
import { GlitchButton } from "@/components/glitch-button";
import HeroAccordion from "@/components/hero-accordion";
import { chinaTodayDateKey, getWeightEntries, type DashboardData } from "@/lib/dashboard";
import type { PlanDocument } from "@/lib/plan-engine";
import {
  activityOptions,
  buildSpacePlans,
  createDemoSpaceProfile,
  createEmptySpaceProfile,
  dayOptions,
  dietOptions,
  dietText,
  equipmentOptions,
  equipmentText,
  goalOptions,
  goalText,
  hasRhythmChoices,
  minuteOptions,
  normalizeEquipment,
  rhythmText,
  spaceCompleteness,
  validateSpaceProfile,
  type SpaceEquipment,
  type SpaceFieldErrorKey,
  type SpaceFieldErrors,
  type SpaceGender,
  type SpaceProfile,
} from "@/lib/space";
import { useHealthStore } from "@/stores/health-store";

const ease = [0.22, 1, 0.36, 1] as const;

const heroGalleryItems = [
  { image: "/images/plans/plan-exercise-hero.webp", alt: "" },
  { image: "/images/hero/hero-accordion-water.webp", alt: "" },
  { image: "/images/hero/zhiyang-hero-garden.webp", alt: "" },
  { image: "/images/plans/plan-diet-hero.webp", alt: "" },
  { image: "/images/hero/hero-accordion-canopy.webp", alt: "" },
];

const genderOptions: Array<{ value: SpaceGender; label: string }> = [
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "unspecified", label: "不透露" },
];

type MySpaceProps = {
  data?: DashboardData;
  loading: boolean;
  profile: SpaceProfile;
  hasStored: boolean;
  demo: boolean;
};

type ChoiceOption<T extends string> = { value: T; label: string };

function ChoiceGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
  wide,
  error,
}: {
  legend: string;
  value: T | "";
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (value: T) => void;
  wide?: boolean;
  error?: string;
}) {
  const errorId = `${legend}-error`;
  return (
    <fieldset
      className={`ms-choice-set${wide ? " ms-choice-wide" : ""}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      tabIndex={error ? -1 : undefined}
    >
      <legend>{legend}</legend>
      <div className="ms-choice">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={legend}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="ms-error" id={errorId}>{error}</p>}
    </fieldset>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ms-field">
      <label htmlFor={id}>
        {label}
        {hint && <small>{hint}</small>}
      </label>
      {children}
      {error && <p className="ms-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

function EquipmentPicker({
  value,
  onChange,
  error,
}: {
  value: SpaceEquipment[];
  onChange: (value: SpaceEquipment[]) => void;
  error?: string;
}) {
  const errorId = "ms-equipment-error";
  const toggle = (item: SpaceEquipment, checked: boolean) => {
    if (item === "bodyweight") {
      onChange(checked ? ["bodyweight"] : []);
      return;
    }
    const base = value.filter((current) => current !== "bodyweight" && current !== item);
    onChange(normalizeEquipment(checked ? [...base, item] : base));
  };
  return (
    <fieldset
      className="ms-equip-set"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      tabIndex={error ? -1 : undefined}
    >
      <legend>可用运动器材</legend>
      <p className="ms-equip-hint">请选择你可以使用的运动器材，计划会按器械安排动作。</p>
      <div className="ms-equip-grid">
        {equipmentOptions.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label key={option.value} className={`ms-equip${checked ? " is-checked" : ""}`}>
              <input
                type="checkbox"
                value={option.value}
                checked={checked}
                onChange={(event) => toggle(option.value, event.target.checked)}
              />
              <span className="ms-equip-box" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="ms-error" id={errorId}>{error}</p>}
    </fieldset>
  );
}

function formatMoment(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (amount: number) => String(amount).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MySpace({ data, loading, profile, hasStored, demo }: MySpaceProps) {
  const setPage = useHealthStore((state) => state.setPage);
  const setSpaceProfile = useHealthStore((state) => state.setSpaceProfile);
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const heroStageRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const plansRef = React.useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, { stiffness: 170, damping: 20, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 170, damping: 20, mass: 0.6 });
  const heroScale = useSpring(1, { stiffness: 200, damping: 24 });
  const heroChars = Array.from("我的空间。");

  const [draft, setDraft] = React.useState<SpaceProfile>(profile);
  const [draftBase, setDraftBase] = React.useState<SpaceProfile>(profile);
  const [errors, setErrors] = React.useState<SpaceFieldErrors>({});
  const [status, setStatus] = React.useState<{ kind: "idle" | "saved" | "error"; text: string }>({
    kind: "idle",
    text: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [confirmingClear, setConfirmingClear] = React.useState(false);
  const [clearedGuard, setClearedGuard] = React.useState(false);
  const [weightInput, setWeightInput] = React.useState("");
  const [weightBase, setWeightBase] = React.useState("");
  const [weightDirty, setWeightDirty] = React.useState(false);
  const [weightSaving, setWeightSaving] = React.useState(false);
  const [weightMessage, setWeightMessage] = React.useState<{ kind: "idle" | "saving" | "ok" | "error"; text: string }>({
    kind: "idle",
    text: "",
  });
  const weightInputRef = React.useRef<HTMLInputElement>(null);
  const weightEntriesQuery = useQuery({ queryKey: ["weight"], queryFn: getWeightEntries });
  const planQuery = useQuery({
    queryKey: ["plan"],
    queryFn: async () => {
      const response = await fetch("/api/plans/latest");
      if (!response.ok) return null;
      const data = (await response.json().catch(() => null)) as { plan?: PlanDocument | null } | null;
      return data?.plan ?? null;
    },
    enabled: hasStored,
  });
  const todayKey = chinaTodayDateKey();
  const todayWeightEntry = weightEntriesQuery.data?.entries.find((entry) => entry.dateKey === todayKey) ?? null;
  const todayWeightNote = todayWeightEntry?.note ?? "";

  if (profile !== draftBase) {
    setDraftBase(profile);
    if (!clearedGuard || profile.savedAt) {
      if (clearedGuard) setClearedGuard(false);
      setDraft(profile);
      setErrors({});
    }
  }

  React.useEffect(() => {
    if (!Object.values(errors).some(Boolean)) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const handleHeroTilt = (event: React.PointerEvent<HTMLDivElement>) => {
    const stage = heroStageRef.current;
    if (reduce || event.pointerType !== "mouse" || !stage) return;
    if (!window.matchMedia("(hover: hover) and (min-width: 961px)").matches) return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-y * 2.8);
    rotateY.set(x * 3.4);
    heroScale.set(1.006);
    stage.style.setProperty("--ms-glare-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    stage.style.setProperty("--ms-glare-y", `${((y + 0.5) * 100).toFixed(1)}%`);
    stage.dataset.tilting = "true";
  };

  const resetHeroTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
    heroScale.set(1);
    if (heroStageRef.current) delete heroStageRef.current.dataset.tilting;
  };

  const latestWeight = data?.weightKg ?? null;
  const syncedWeightKg = weightDirty
    ? weightInput
    : latestWeight !== null ? latestWeight.toFixed(1) : draft.weightKg;
  const syncedDraft: SpaceProfile = { ...draft, weightKg: syncedWeightKg };
  const displayWeight = latestWeight !== null
    ? latestWeight.toFixed(1)
    : syncedWeightKg.trim() && Number.isFinite(Number(syncedWeightKg)) ? Number(syncedWeightKg).toFixed(1) : "";

  if (weightBase !== displayWeight) {
    setWeightBase(displayWeight);
    if (!weightDirty) setWeightInput(displayWeight);
  }
  if (weightDirty && latestWeight !== null && weightInput.trim()
    && Number.isFinite(Number(weightInput)) && Math.abs(Number(weightInput) - latestWeight) < 0.05) {
    setWeightDirty(false);
  }
  const weightError = errors.weightKg ?? (weightMessage.kind === "error" ? weightMessage.text : "");

  const completeness = spaceCompleteness(syncedDraft);
  const plans = buildSpacePlans(syncedDraft);
  const generatedPlan = planQuery.data ?? null;
  const dietView = generatedPlan && generatedPlan.diet.meals.length > 0 ? generatedPlan.diet : plans.diet;
  const movementView = generatedPlan ? generatedPlan.movement : plans.movement;
  const dietLabelView = generatedPlan?.profileSnapshot?.dietLabel ?? dietText(draft.diet);
  const movementEnvironment = movementView.environmentLabel || equipmentText(draft.equipment);
  const movementMinutes = [...new Set(movementView.sessions.map((session) => session.minutes))];
  const sessionMinutesLabel = movementMinutes.length === 1
    ? `${movementMinutes[0]} 分钟`
    : movementMinutes.length > 1
      ? `${Math.min(...movementMinutes)}–${Math.max(...movementMinutes)} 分钟`
      : `${draft.minutes || "—"} 分钟`;
  const hasRhythm = hasRhythmChoices(syncedDraft);
  const goalLine = plans.goalLine;
  const isDemo = demo;
  const savedMoment = hasStored ? formatMoment(draft.savedAt) : "";
  const sourceLabel = hasStored
    ? isDemo ? "演示沙盒 · 已保存" : "已保存到账户"
    : isDemo ? "演示资料 · 尚未保存" : "尚未填写";
  const sourceClass = hasStored ? "is-saved" : isDemo ? "is-demo" : "is-empty";
  const name = draft.name.trim();
  const initial = name.slice(0, 1) || "你";

  const height = Number(draft.heightCm);
  const weight = Number(syncedWeightKg);
  const bmi = draft.heightCm.trim() && syncedWeightKg.trim()
    && Number.isFinite(height) && Number.isFinite(weight)
    && height >= 130 && height <= 220 && weight >= 35 && weight <= 200
    ? weight / (height / 100) ** 2
    : null;

  function update<K extends keyof SpaceProfile>(key: K, value: SpaceProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as SpaceFieldErrorKey]) return current;
      return { ...current, [key]: undefined };
    });
    setStatus((current) => current.kind === "idle" ? current : { kind: "idle", text: "" });
  }

  async function persistWeight(options: { force: boolean }): Promise<string | null> {
    if (!options.force && !weightDirty) return syncedWeightKg.trim() || null;
    if (weightSaving) return null;
    const raw = weightInput.trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 35 || value > 200) {
      setWeightMessage({ kind: "error", text: "体重需在 35–200 kg 之间。" });
      return null;
    }
    const rounded = Math.round(value * 10) / 10;
    setWeightSaving(true);
    setWeightMessage({ kind: "saving", text: "正在保存并同步…" });
    try {
      const payload: { dateKey: string; kg: number; note?: string } = { dateKey: todayKey, kg: rounded };
      if (weightEntriesQuery.data) payload.note = todayWeightNote;
      const response = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        entry?: { kg?: number };
        message?: string;
      } | null;
      if (!response.ok || !result?.entry || typeof result.entry.kg !== "number") {
        throw new Error(result?.message ?? "体重没有保存成功，请稍后重试。");
      }
      const savedKg = Number(result.entry.kg);
      const formatted = savedKg.toFixed(1);
      setWeightInput(formatted);
      setWeightDirty(true);
      setDraft((current) => ({ ...current, weightKg: formatted }));
      if (hasStored) {
        const nextProfile = { ...profile, weightKg: formatted };
        setDraftBase(nextProfile);
        setSpaceProfile(nextProfile);
      }
      setWeightMessage({ kind: "ok", text: `已保存 ${formatted} kg，并同步到今日概览与每周复盘。` });
      void queryClient.invalidateQueries({ queryKey: ["weight"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      return formatted;
    } catch (error) {
      setWeightMessage({ kind: "error", text: error instanceof Error ? error.message : "体重没有保存成功，请稍后重试。" });
      return null;
    } finally {
      setWeightSaving(false);
    }
  }

  function goTo(ref: React.RefObject<HTMLElement | null>) {
    const node = ref.current;
    if (!node) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    node.focus({ preventScroll: true });
  }

  function fillDemo() {
    if (!demo || !data) return;
    const demoProfile = createDemoSpaceProfile(data.displayName, data.weightKg);
    setDraft(demoProfile);
    setWeightDirty(false);
    setWeightInput(demoProfile.weightKg);
    setWeightMessage({ kind: "idle", text: "" });
    setErrors({});
    setStatus({ kind: "idle", text: "已填入演示资料；修改后点击保存，才会进入你的资料。" });
  }

  function resetDraft() {
    setDraft(profile);
    setWeightDirty(false);
    setWeightInput(displayWeight);
    setWeightMessage({ kind: "idle", text: "" });
    setErrors({});
    setStatus({ kind: "idle", text: hasStored ? "已恢复到上次保存的资料。" : "已恢复到初始内容。" });
  }

  function beginClear() {
    if (saving || clearing) return;
    setConfirmingClear(true);
    setStatus({
      kind: "idle",
      text: hasStored
        ? "清空会同时删除已保存的资料和所有计划版本，且无法恢复。"
        : "清空会移除当前填写内容，请先完成资料填写后再保存。",
    });
  }

  function cancelClear() {
    if (clearing) return;
    setConfirmingClear(false);
    setStatus({ kind: "idle", text: "" });
  }

  async function clearAll() {
    if (saving || clearing) return;
    setClearing(true);
    setStatus({ kind: "idle", text: "正在清空资料与对应计划…" });
    try {
      if (hasStored) {
        const response = await fetch("/api/profile", { method: "DELETE" });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "清空失败，请稍后重试。");
        setSpaceProfile(createEmptySpaceProfile());
        void queryClient.invalidateQueries({ queryKey: ["profile"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["plan"] });
      }
      setClearedGuard(true);
      setDraft(createEmptySpaceProfile());
      setWeightDirty(false);
      setWeightInput(displayWeight);
      setWeightMessage({ kind: "idle", text: "" });
      setErrors({});
      setConfirmingClear(false);
      setStatus({
        kind: "saved",
        text: hasStored
          ? "资料和对应计划已清空。请先完成资料填写，再保存并生成计划。"
          : "已清空填写内容。请先完成资料填写。",
      });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "清空失败，请稍后重试。" });
    } finally {
      setClearing(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || clearing || weightSaving) return;
    const nextErrors = validateSpaceProfile(syncedDraft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStatus({ kind: "error", text: "还有几项需要确认，已标在对应字段下面。" });
      return;
    }
    let weightKg = syncedDraft.weightKg.trim();
    if (weightDirty) {
      const savedWeight = await persistWeight({ force: false });
      if (!savedWeight) {
        setStatus({ kind: "error", text: "体重没有保存成功，请先检查体重。" });
        return;
      }
      weightKg = savedWeight;
    }
    const saved: SpaceProfile = {
      ...syncedDraft,
      name: syncedDraft.name.trim(),
      age: syncedDraft.age.trim(),
      heightCm: syncedDraft.heightCm.trim(),
      weightKg,
      targetWeightKg: syncedDraft.targetWeightKg.trim(),
      city: syncedDraft.city.trim(),
      avoid: syncedDraft.avoid.trim(),
      budget: syncedDraft.budget.trim(),
      source: isDemo ? "demo" : "local",
      savedAt: new Date().toISOString(),
    };

    setSaving(true);
    setStatus({ kind: "idle", text: "正在保存资料…" });
    let persisted: SpaceProfile = saved;
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: saved }),
      });
      const result = (await response.json().catch(() => null)) as { profile?: SpaceProfile; message?: string } | null;
      if (!response.ok || !result?.profile) throw new Error(result?.message ?? "资料没有保存成功，请稍后重试。");
      persisted = result.profile;
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "资料没有保存成功，请稍后重试。" });
      setSaving(false);
      return;
    }

    setSpaceProfile(persisted);
    setDraft(persisted);
    setWeightInput(persisted.weightKg);
    setWeightDirty(false);
    setWeightBase(persisted.weightKg.trim());
    setWeightMessage({ kind: "idle", text: "" });
    setErrors({});
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setStatus({ kind: "idle", text: "资料已保存，正在按资料生成计划…" });

    try {
      const response = await fetch("/api/plans/generate", { method: "POST" });
      const result = (await response.json().catch(() => null)) as { plan?: { version?: number }; message?: string } | null;
      if (!response.ok || !result?.plan?.version) throw new Error(result?.message ?? "计划生成失败，请稍后重试。");
      void queryClient.invalidateQueries({ queryKey: ["plan"] });
      setStatus({
        kind: "saved",
        text: `已保存到${isDemo ? "演示沙盒" : "你的账户"} · ${formatMoment(persisted.savedAt)}。饮食与运动计划已生成（v${result.plan.version}）。`,
      });
    } catch (error) {
      setStatus({
        kind: "saved",
        text: `已保存到${isDemo ? "演示沙盒" : "你的账户"} · ${formatMoment(persisted.savedAt)}。${error instanceof Error ? error.message : "计划生成失败，请稍后重试。"}可在计划页重试。`,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !hasStored) {
    return <div className="ms-shell"><div className="ms-loading"><GrowingLoader label="正在准备你的空间…" /></div></div>;
  }

  const targets = plans.targets;
  const targetsNote = targets
    ? "按 Mifflin-St Jeor 公式估算。"
    : plans.targetsReason ?? "补充年龄、身高与体重后给出参考。";

  return (
    <div className="ms-shell">
      <div
        ref={heroStageRef}
        className="ms-hero-stage"
        onPointerMove={handleHeroTilt}
        onPointerLeave={resetHeroTilt}
        onPointerCancel={resetHeroTilt}
      >
        <motion.section
          className="ms-hero"
          aria-labelledby="ms-title"
          style={reduce ? undefined : { rotateX, rotateY, scale: heroScale }}
        >
        <div className="ms-hero-gallery">
          <HeroAccordion
            items={heroGalleryItems}
            defaultIndex={2}
            expandRatio={0.42}
            duration={0.9}
            autoPlayMs={9000}
            reduced={!!reduce}
          />
        </div>
        <span className="ms-hero-veil" aria-hidden="true" />
        <motion.div
          className="ms-hero-copy"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.62, ease }}
        >
          <h1 id="ms-title" className="ms-title-3d" aria-label="我的空间。">
            {heroChars.map((char, index) => (
              <span
                key={`${char}-${index}`}
                className={`ms-char${char === "。" ? " ms-char-dot" : ""}`}
                style={{ "--char-index": index } as React.CSSProperties}
                aria-hidden="true"
              >
                {char}
              </span>
            ))}
          </h1>
          <p className="ms-hero-lede">
            把身体的情况和生活的节奏写在这里。饮食与运动计划，会跟着你填的内容重新排；没填的部分，保持空白。
          </p>
          <div className="ms-hero-meta" aria-label="资料状态">
            <span className={`ms-source ${sourceClass}`}><i aria-hidden="true" />{sourceLabel}</span>
            <span>资料 {completeness.filled}/{completeness.total}</span>
            {savedMoment && <span>上次保存 {savedMoment}</span>}
          </div>
          <div className="ms-hero-actions">
            <GlitchButton tone="cream" className="ms-hero-fill" onClick={() => goTo(formRef)}>
              填写资料 <ArrowDown size={15} aria-hidden="true" />
            </GlitchButton>
            <button type="button" className="ms-hero-link" onClick={() => goTo(plansRef)}>
              看生成的计划 <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>

        <div className="ms-stack">
          <span className="ms-stack-layer ms-stack-one" aria-hidden="true" />
          <span className="ms-stack-layer ms-stack-two" aria-hidden="true" />
          <motion.aside
            className="ms-pass"
            aria-label="个人档案摘要"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.72, delay: reduce ? 0 : 0.1, ease }}
          >
          <div className="ms-pass-top">
            <span className="ms-pass-file">个人档案 / PROFILE</span>
            <span className="ms-pass-stamp" aria-hidden="true">{initial}</span>
          </div>
          <h2>{name || "还没有称呼"}</h2>
          <p className="ms-pass-goal">
            {rhythmText(draft)}
          </p>
          <dl className="ms-pass-grid">
            <div><dt>身高</dt><dd>{draft.heightCm ? `${draft.heightCm} cm` : "—"}</dd></div>
            <div><dt>体重</dt><dd>{displayWeight ? `${displayWeight} kg` : "—"}</dd></div>
            <div><dt>目标体重</dt><dd>{draft.targetWeightKg ? `${draft.targetWeightKg} kg` : "—"}</dd></div>
            <div><dt>饮食偏好</dt><dd>{dietText(draft.diet)}</dd></div>
          </dl>
          <div className="ms-pass-ticks">
            <div className="ms-ticks" aria-hidden="true">
              {Array.from({ length: completeness.total }, (_, index) => (
                <i key={index} className={index < completeness.filled ? "on" : ""} />
              ))}
            </div>
            <span>资料 {completeness.filled}/{completeness.total}</span>
          </div>
          <p className="ms-pass-foot">
            <ShieldCheck size={12} aria-hidden="true" />
            {hasStored ? (isDemo ? "保存在演示沙盒" : "已保存到你的账户") : (isDemo ? "保存后进入演示沙盒" : "保存后进入你的账户")}
          </p>
          </motion.aside>
        </div>
        <span className="ms-hero-glare" aria-hidden="true" />
        </motion.section>
      </div>

      {isDemo && (
        <p className="ms-notice" role="note">
          <Info size={14} aria-hidden="true" />
          当前填入的是演示资料，可以按自己的情况修改；保存后写入当前浏览会话的独立沙盒，不会进入其他访问者的数据。
        </p>
      )}

      <div className="ms-workspace">
        <form className="ms-form" ref={formRef} onSubmit={submit} noValidate tabIndex={-1}>
          <div className="ms-form-head">
            <div>
              <h2>把你的情况写下来。</h2>
            </div>
            <span className="ms-form-state">
              {hasStored ? `${isDemo ? "演示资料" : "账户资料"}${savedMoment ? ` · ${savedMoment}` : ""}` : "尚未保存"}
            </span>
          </div>

          <section className="ms-form-section" aria-labelledby="ms-basic">
            <div className="ms-section-head">
              <h3 id="ms-basic"><span>01</span>先认识一下</h3>
            </div>
            <div className="ms-grid">
              <Field id="ms-name" label="称呼" hint="必填" error={errors.name}>
                <input
                  className="ms-input"
                  id="ms-name"
                  value={draft.name}
                  maxLength={12}
                  autoComplete="nickname"
                  placeholder="怎么称呼你"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "ms-name-error" : undefined}
                  onChange={(event) => update("name", event.target.value)}
                />
              </Field>

              <fieldset className="ms-choice-set">
                <legend>性别</legend>
                <div className="ms-choice ms-choice-compact">
                  {genderOptions.map((option) => (
                    <label key={option.value}>
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={draft.gender === option.value}
                        onChange={() => update("gender", option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field id="ms-age" label="年龄" hint="14–90 岁" error={errors.age}>
                <input
                  className="ms-input"
                  id="ms-age"
                  type="number"
                  inputMode="numeric"
                  min={14}
                  max={90}
                  value={draft.age}
                  placeholder="例如 28"
                  aria-invalid={Boolean(errors.age)}
                  aria-describedby={errors.age ? "ms-age-error" : undefined}
                  onChange={(event) => update("age", event.target.value)}
                />
              </Field>

              <Field id="ms-height" label="身高" hint="cm" error={errors.heightCm}>
                <input
                  className="ms-input"
                  id="ms-height"
                  type="number"
                  inputMode="decimal"
                  min={130}
                  max={220}
                  step="0.1"
                  value={draft.heightCm}
                  placeholder="例如 168"
                  aria-invalid={Boolean(errors.heightCm)}
                  aria-describedby={errors.heightCm ? "ms-height-error" : undefined}
                  onChange={(event) => update("heightCm", event.target.value)}
                />
              </Field>

              <div className="ms-field">
                <label htmlFor="ms-weight">当前体重<small>kg · 保存后同步</small></label>
                <div className={`ms-weight-sync${weightInput ? "" : " is-empty"}`}>
                  <div className="ms-weight-field">
                    <input
                      ref={weightInputRef}
                      id="ms-weight"
                      className="ms-weight-input"
                      type="number"
                      inputMode="decimal"
                      min={35}
                      max={200}
                      step="0.1"
                      value={weightInput}
                      placeholder="例如 65.0"
                      aria-label="当前体重，单位千克"
                      aria-invalid={Boolean(weightError)}
                      aria-describedby="ms-weight-note"
                      disabled={weightSaving || saving}
                      onChange={(event) => {
                        update("weightKg", event.target.value);
                        setWeightInput(event.target.value);
                        setWeightDirty(true);
                        setWeightMessage({ kind: "idle", text: "" });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        void persistWeight({ force: true });
                      }}
                    />
                    <span className="ms-weight-unit">kg</span>
                  </div>
                  <button
                    type="button"
                    className="ms-weight-sync-link"
                    onClick={() => void persistWeight({ force: true })}
                    disabled={weightSaving || saving || clearing}
                  >
                    {weightSaving ? "保存中…" : "保存"} {!weightSaving && <Check size={12} aria-hidden="true" />}
                  </button>
                </div>
                <p
                  id="ms-weight-note"
                  className={`ms-weight-sync-note${weightError ? " is-error" : weightMessage.kind === "ok" ? " is-ok" : weightMessage.kind === "saving" ? " is-saving" : ""}`}
                  role={weightError ? "alert" : "status"}
                  aria-live="polite"
                >
                  {weightError
                    ? weightError
                    : weightMessage.kind === "saving" || weightMessage.kind === "ok"
                      ? weightMessage.text
                      : todayWeightEntry
                        ? "今天已有一笔记录，保存会更新今天的值，并同步到概览与复盘。"
                        : "保存后会新增今天的一笔体重记录，并同步到今日概览与每周复盘。"}
                </p>
              </div>

              <Field id="ms-target-weight" label="目标体重" hint="kg" error={errors.targetWeightKg}>
                <input
                  className="ms-input"
                  id="ms-target-weight"
                  type="number"
                  inputMode="decimal"
                  min={35}
                  max={200}
                  step="0.1"
                  value={draft.targetWeightKg}
                  placeholder="例如 58"
                  aria-invalid={Boolean(errors.targetWeightKg)}
                  aria-describedby={errors.targetWeightKg ? "ms-target-weight-error" : undefined}
                  onChange={(event) => update("targetWeightKg", event.target.value)}
                />
              </Field>

              <Field id="ms-city" label="所在城市" hint="选填 · 训练计划会参考天气" error={errors.city}>
                <input
                  className="ms-input"
                  id="ms-city"
                  value={draft.city}
                  maxLength={20}
                  autoComplete="address-level2"
                  placeholder="例如 杭州"
                  aria-invalid={Boolean(errors.city)}
                  aria-describedby={errors.city ? "ms-city-error" : undefined}
                  onChange={(event) => update("city", event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="ms-form-section" aria-labelledby="ms-rhythm">
            <div className="ms-section-head">
              <h3 id="ms-rhythm"><span>02</span>你的节奏</h3>
            </div>
            <div className="ms-choice-grid">
              <ChoiceGroup legend="健康目标" value={draft.goal} options={goalOptions} onChange={(value) => update("goal", value)} error={errors.goal} />
              <ChoiceGroup legend="日常活动" value={draft.activity} options={activityOptions} onChange={(value) => update("activity", value)} error={errors.activity} />
            </div>
            <div className="ms-choice-grid">
              <ChoiceGroup legend="每周训练次数" value={draft.days} options={dayOptions} onChange={(value) => update("days", value)} error={errors.days} />
              <ChoiceGroup legend="每次训练时长" value={draft.minutes} options={minuteOptions} onChange={(value) => update("minutes", value)} error={errors.minutes} />
            </div>
            <EquipmentPicker value={draft.equipment} onChange={(value) => update("equipment", value)} error={errors.equipment} />
          </section>

          <section className="ms-form-section" aria-labelledby="ms-table">
            <div className="ms-section-head">
              <h3 id="ms-table"><span>03</span>餐桌与预算</h3>
            </div>
            <ChoiceGroup legend="饮食偏好" value={draft.diet} options={dietOptions} onChange={(value) => update("diet", value)} wide error={errors.diet} />
            <div className="ms-grid ms-grid-spaced">
              <Field id="ms-budget" label="每日饮食预算" hint="元 / 天" error={errors.budget}>
                <input
                  className="ms-input"
                  id="ms-budget"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1000}
                  value={draft.budget}
                  placeholder="例如 60"
                  aria-invalid={Boolean(errors.budget)}
                  aria-describedby={errors.budget ? "ms-budget-error" : undefined}
                  onChange={(event) => update("budget", event.target.value)}
                />
              </Field>
              <Field id="ms-avoid" label="需要避开的食物" error={errors.avoid}>
                <input
                  className="ms-input"
                  id="ms-avoid"
                  value={draft.avoid}
                  maxLength={80}
                  placeholder="例如：花生、乳糖、海鲜"
                  aria-invalid={Boolean(errors.avoid)}
                  aria-describedby={errors.avoid ? "ms-avoid-error" : undefined}
                  onChange={(event) => update("avoid", event.target.value)}
                />
              </Field>
            </div>
          </section>

          <div className="ms-form-foot">
            <p className={`ms-status ${status.kind}`} role="status" aria-live="polite">
              {status.kind === "saved"
                ? <Check size={13} aria-hidden="true" />
                : status.kind === "error"
                  ? <CircleAlert size={13} aria-hidden="true" />
                  : <ShieldCheck size={13} aria-hidden="true" />}
              <span>{status.text || "保存后写入资料。"}</span>
            </p>
            <div className="ms-form-actions">
              {confirmingClear ? (
                <>
                  <button type="button" className="ms-ghost-btn is-danger" onClick={() => void clearAll()} disabled={clearing}>
                    {clearing ? "正在清空…" : hasStored ? "确认清空资料与计划" : "确认清空"}
                  </button>
                  <button type="button" className="ms-ghost-btn" onClick={cancelClear} disabled={clearing}>取消</button>
                </>
              ) : (
                <>
                  {isDemo && <button type="button" className="ms-ghost-btn" onClick={fillDemo} disabled={clearing}>填入演示资料</button>}
                  <button type="button" className="ms-ghost-btn is-danger" onClick={beginClear} disabled={clearing || saving}>清空资料</button>
                  <button type="button" className="ms-ghost-btn" onClick={resetDraft}>撤销修改</button>
                  <GlitchButton type="submit" disabled={saving || clearing || weightSaving}>{saving ? "正在生成计划…" : "保存并生成计划"} {!saving && <ArrowRight size={15} aria-hidden="true" />}</GlitchButton>
                </>
              )}
            </div>
          </div>
        </form>

        <aside className="ms-aside" aria-label="参考范围与目标">
          <section className="ms-ref" aria-labelledby="ms-ref-heading">
            <div className="ms-ref-head">
              <h3 id="ms-ref-heading">这些数字，先当参考。</h3>
              <span>按当前填写</span>
            </div>
            <div className="ms-ref-list">
              <div className="ms-ref-row">
                <span className="ms-ref-label"><span>BMI</span></span>
                <strong className="ms-ref-value">{bmi !== null ? bmi.toFixed(1) : "—"}<small>kg/m²</small></strong>
              </div>
              <div className="ms-ref-row">
                <span className="ms-ref-label"><span>每日热量</span></span>
                <strong className="ms-ref-value">
                  {targets ? `${targets.calorieLow.toLocaleString("zh-CN")}–${targets.calorieHigh.toLocaleString("zh-CN")}` : "—"}
                  <small>kcal</small>
                </strong>
              </div>
              <div className="ms-ref-row">
                <span className="ms-ref-label"><span>蛋白质</span></span>
                <strong className="ms-ref-value">
                  {targets ? `${targets.proteinLow}–${targets.proteinHigh}` : "—"}
                  <small>g</small>
                </strong>
              </div>
              <div className="ms-ref-row">
                <span className="ms-ref-label"><span>饮水</span></span>
                <strong className="ms-ref-value">
                  {targets ? `${targets.waterLow.toFixed(1)}–${targets.waterHigh.toFixed(1)}` : "—"}
                  <small>L</small>
                </strong>
              </div>
            </div>
            <p className={`ms-ref-note${targets ? "" : " is-alert"}`}>{targetsNote}</p>
          </section>

          <section className="ms-goal-card" aria-label="目标线">
            <span className="ms-goal-label">目标线</span>
            <p>{goalLine ?? "还没有填写目标体重。先把目标写下来，或者先保持现在的节奏。"}</p>
            <div className="ms-goal-meta">
              <span>{goalText(draft.goal)}</span>
              <span>{draft.days ? `${draft.days} 次 / 周` : "每周次数待选择"}</span>
              <span>{equipmentText(draft.equipment)}</span>
            </div>
            <button type="button" onClick={() => setPage("coach")}>
              和健康搭子聊聊 <ArrowRight size={13} aria-hidden="true" />
            </button>
          </section>
        </aside>
      </div>

      <div className="ms-plans-wrap" ref={plansRef} tabIndex={-1} aria-label="按当前资料生成的饮食与运动计划">
        {hasRhythm ? (
          <>
            <header className="ms-plans-head">
              <div className="ms-plans-title">
                <h2>饮食与运动，先各排一版。</h2>
                {generatedPlan && <span className="ms-plans-version">计划 v{generatedPlan.version}</span>}
              </div>
            </header>

            <div className="ms-plans">
          <Reveal>
            <article className="ms-plan">
              <div className="ms-plan-head">
                <div>
                  <h3>一日四餐，留出替换的余地。</h3>
                  <p>{dietLabelView} · {draft.budget.trim() ? `预算约 ¥${draft.budget.trim()}/天` : "未填写预算"}</p>
                </div>
              </div>
              <ol className="ms-meals">
                {dietView.meals.map((meal) => (
                  <li className="ms-meal" key={meal.time}>
                    <div className="ms-meal-when">
                      <b>{meal.time}</b>
                      <span>{meal.label}</span>
                    </div>
                    <div className="ms-meal-what">
                      <strong>{meal.title}</strong>
                      <p>{meal.detail}</p>
                      <small><RotateCw size={11} aria-hidden="true" />{meal.swap}</small>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="ms-plan-notes">
                <p><CircleAlert size={13} aria-hidden="true" />{dietView.avoidNote}</p>
                <p><Wallet size={13} aria-hidden="true" />{dietView.budgetNote}</p>
              </div>
              <div className="ms-plan-foot">
                <button type="button" className="ms-plan-cta" onClick={() => setPage("plans")}>
                  打开完整饮食计划 <ArrowRight size={14} aria-hidden="true" />
                </button>
                <button type="button" className="ms-plan-ghost" onClick={() => setPage("food")}>去记录一餐</button>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.06}>
            <article className="ms-plan">
              <div className="ms-plan-head">
                <div>
                  <h3>一周几次，先排进日历。</h3>
                  <p>
                    {movementEnvironment} · 每周 {movementView.sessionCount} 次 · 每次 {sessionMinutesLabel}
                    · 共约 {movementView.totalMinutes} 分钟
                  </p>
                </div>
              </div>
              <div
                className="ms-week"
                role="img"
                aria-label={`每周安排：${movementView.sessions.map((session) => `${session.day}${session.title}${session.minutes}分钟`).join("，")}`}
              >
                {movementView.week.map((day) => (
                  <div key={day.label} className={`ms-week-day ${day.session ? "has" : "rest"}`} aria-hidden="true">
                    <span>{day.short}</span>
                    <i />
                    <small>{day.session ? `${day.session.minutes}′` : "·"}</small>
                  </div>
                ))}
              </div>
              <ul className="ms-sessions">
                {movementView.sessions.map((session) => (
                  <li key={`${session.day}-${session.title}`}>
                    <span className="ms-session-day">{session.day}</span>
                    <div><strong>{session.title}</strong><p>{session.focus}</p></div>
                    <span className="ms-session-min">{session.minutes}′</span>
                  </li>
                ))}
              </ul>
              <div className="ms-plan-notes">
                <p><Info size={13} aria-hidden="true" />以无痛范围为限，状态一般时先减量。这里只做计划提醒，不记录心率或完成情况。</p>
              </div>
              <div className="ms-plan-foot">
                <button type="button" className="ms-plan-cta" onClick={() => setPage("exercise")}>
                  打开完整运动计划 <ArrowRight size={14} aria-hidden="true" />
                </button>
                <button type="button" className="ms-plan-ghost" onClick={() => setPage("coach")}>问问怎么开始</button>
              </div>
            </article>
          </Reveal>
            </div>
          </>
        ) : (
          <div className="ms-plans-empty">
            <span className="ms-plans-empty-kicker">饮食与运动计划</span>
            <h2>去完善资料吧，找到属于你的节奏</h2>
            <button type="button" className="ms-plan-cta" onClick={() => goTo(formRef)}>
              去完善资料 <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <Reveal>
        <section className="ms-boundary is-slim" aria-labelledby="ms-boundary-title">
          <div className="ms-boundary-copy">
            <h2 id="ms-boundary-title">这份计划是怎么来的。</h2>
            <p>按固定规则从资料生成，不调用 AI；缺失保持“待补充”，不补猜、不做疾病判断，也不是医疗处方。</p>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
