"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Clock3,
  Dumbbell,
  Footprints,
  HeartPulse,
  History,
  Info,
  Leaf,
  Loader2,
  MessageCircle,
  RotateCw,
  Salad,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Utensils,
  Wind,
  X,
} from "lucide-react";
import { FoodGuide } from "@/components/food-guide";
import { Reveal } from "@/components/experience";
import { GlitchButton } from "@/components/glitch-button";
import type { DashboardData } from "@/lib/dashboard";
import type { DynamicPlanAdjustment } from "@/lib/plan-adjustment";
import type { PlanDocument, PlanVersionSummary } from "@/lib/plan-engine";
import { createEmptySpaceProfile, dietLabels, spaceCompleteness, type SpaceProfile, type SpaceSession } from "@/lib/space";
import { useHealthStore } from "@/stores/health-store";

const ease = [0.22, 1, 0.36, 1] as const;

type PlanKind = "diet" | "exercise";

const flexNotes = [
  {
    icon: Utensils,
    title: "外食",
    copy: "先找一份蛋白质和一份蔬菜，主食按饥饿感决定留多少。",
  },
  {
    icon: Sun,
    title: "聚餐",
    copy: "把这顿当成生活的一部分；下一餐回到平时的结构，不用补偿。",
  },
  {
    icon: Clock3,
    title: "没时间",
    copy: "酸奶、水果、全麦面包也能凑成一顿；先保证有东西吃。",
  },
] as const;

const weekPlan = [
  { label: "周一", short: "一", title: "随意走", minutes: 0, tone: "rest" },
  { label: "周二", short: "二", title: "力量 A", minutes: 25, tone: "session" },
  { label: "周三", short: "三", title: "休息", minutes: 0, tone: "rest" },
  { label: "周四", short: "四", title: "快走 + 活动度", minutes: 20, tone: "session" },
  { label: "周五", short: "五", title: "休息", minutes: 0, tone: "rest" },
  { label: "周六", short: "六", title: "力量 B", minutes: 25, tone: "session" },
  { label: "周日", short: "日", title: "轻松走", minutes: 0, tone: "rest" },
] as const;

const sessions = [
  {
    id: "strength-a",
    day: "周二",
    title: "力量 A",
    subtitle: "下肢与核心",
    minutes: 25,
    tone: "strength",
    focus: "椅子深蹲 · 臀桥 · 死虫",
    steps: [
      { label: "热身", minutes: 5, text: "原地走、踝关节绕环，让身体微微发热。" },
      { label: "主训练", minutes: 15, text: "椅子深蹲 2×10、臀桥 2×12、死虫 2×8；组间休息 45 秒。" },
      { label: "收尾", minutes: 5, text: "小腿和大腿前侧拉伸，呼吸放慢。" },
    ],
    easier: "状态一般时，深蹲扶着椅背，臀桥减到 8 次；动作以无痛范围为限。",
  },
  {
    id: "walk",
    day: "周四",
    title: "快走 + 活动度",
    subtitle: "心肺与恢复",
    minutes: 20,
    tone: "cardio",
    focus: "快走 · 肩颈活动 · 髋部拉伸",
    steps: [
      { label: "热身", minutes: 3, text: "慢走 3 分钟，让呼吸和脚步找到节奏。" },
      { label: "快走", minutes: 12, text: "走到能说短句、但不想唱歌的速度。" },
      { label: "收尾", minutes: 5, text: "肩颈绕环、髋部拉伸，各做几次。" },
    ],
    easier: "拆成两次 10 分钟也可以；下雨就在室内原地走。",
  },
  {
    id: "strength-b",
    day: "周六",
    title: "力量 B",
    subtitle: "上肢与背部",
    minutes: 25,
    tone: "strength",
    focus: "墙面俯卧撑 · 划船 · 平板支撑",
    steps: [
      { label: "热身", minutes: 5, text: "手臂绕环、原地踏步，让肩背醒过来。" },
      { label: "主训练", minutes: 15, text: "墙面俯卧撑 2×10、弹力带划船 2×12、跪姿平板 2×20 秒。" },
      { label: "收尾", minutes: 5, text: "胸肩拉伸，慢慢呼吸。" },
    ],
    easier: "没有弹力带时，用毛巾做等长划船；平板改成跪姿或靠墙站立收腹。",
  },
] as const;

const intensityLevels = [
  {
    label: "轻松",
    short: "能完整聊天",
    copy: "呼吸平稳，能完整说一句话，还能哼歌。适合恢复日，或者刚开始的那几周。",
  },
  {
    label: "适中",
    short: "能说短句",
    copy: "呼吸变快，但还能说短句。",
  },
  {
    label: "有点挑战",
    short: "只能说几个词",
    copy: "需要专注，只能说几个词。每周少量出现就好；状态一般时，主动降一级。",
  },
] as const;

const exerciseNotes = [
  {
    icon: Timer,
    title: "忙的时候",
    copy: "把 25 分钟拆成两段 10 分钟，中间隔开也算，不用一次做完。",
  },
  {
    icon: Footprints,
    title: "久坐之后",
    copy: "起身走两分钟、接杯水，比等一整块时间更现实。",
  },
  {
    icon: Wind,
    title: "错过一次",
    copy: "不用补课。下一次按原节奏继续，计划不需要完美执行。",
  },
] as const;

function shanghaiWeekdayIndex() {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(label);
}

function todayLabel(index: number) {
  return index >= 0 ? `今天 · ${weekPlan[index]?.label ?? ""}` : "今天";
}

export function PlanSwitcher({ page, profile, hasStored }: { page: "plans" | "exercise"; profile: SpaceProfile; hasStored: boolean }) {
  const setPage = useHealthStore((state) => state.setPage);
  const completeness = spaceCompleteness(profile);
  const items = [
    { id: "plans", label: "饮食计划", caption: "餐盘与替换思路", icon: Salad },
    { id: "exercise", label: "运动计划", caption: "每周节奏与强度", icon: Dumbbell },
  ] as const;

  return (
    <div className="pp-switch-wrap">
      <nav className="pp-switcher" aria-label="计划类型">
        {items.map(({ id, label, caption, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              type="button"
              key={id}
              className={`pp-switch ${active ? "active" : ""}`}
              onClick={() => setPage(id)}
              aria-current={active ? "page" : undefined}
            >
              <span className="pp-switch-icon"><Icon size={17} aria-hidden="true" /></span>
              <span className="pp-switch-copy"><strong>{label}</strong><small>{caption}</small></span>
            </button>
          );
        })}
      </nav>
      <p className="pp-switch-note">
        <Info size={12} aria-hidden="true" />
        {hasStored ? `资料已填 ${completeness.filled}/${completeness.total} 项 · 可在下方生成计划` : "还没有保存资料 · 请先完成资料填写再生成"}
      </p>
    </div>
  );
}

type PlanGenerateOutcome =
  | { ok: true; version: number | null; summary: string | null }
  | { ok: false; message: string };

type PlanChatReply =
  | { ok: true; reply: string; applied: boolean; version: number | null; summary: string | null }
  | { ok: false; message: string };

type PlanDeleteOutcome =
  | { ok: true; deletedCount: number }
  | { ok: false; message: string };

type PlanState = {
  plan: PlanDocument | null;
  activePlan: PlanDocument | null;
  activeVersion: number | null;
  versions: PlanVersionSummary[];
  versionTotal: number;
  persisted: boolean;
  adjustment: DynamicPlanAdjustment | null;
  loading: boolean;
  chatting: boolean;
  activating: number | null;
  deleting: boolean;
  restoringAdjustment: boolean;
  error: string | null;
  generate: (feedback?: string, options?: { silentError?: boolean }) => Promise<PlanGenerateOutcome>;
  chat: (messages: Array<{ role: "user" | "assistant"; content: string }>, kind: PlanKind) => Promise<PlanChatReply>;
  activate: (version: number) => Promise<void>;
  remove: (versions: number[]) => Promise<PlanDeleteOutcome>;
  restoreAdjustment: () => Promise<void>;
};

type PlanStateResponse = {
  plan?: PlanDocument | null;
  activePlan?: PlanDocument | null;
  activeVersion?: number | null;
  versions?: PlanVersionSummary[];
  versionTotal?: number;
  persisted?: boolean;
  adjustment?: DynamicPlanAdjustment | null;
  generatedVersion?: number;
  deletedCount?: number;
  message?: string;
  reply?: string;
  applied?: boolean;
};

function useGeneratedPlan(hasStored: boolean): PlanState {
  const [plan, setPlan] = React.useState<PlanDocument | null>(null);
  const [activePlan, setActivePlan] = React.useState<PlanDocument | null>(null);
  const [activeVersion, setActiveVersion] = React.useState<number | null>(null);
  const [versions, setVersions] = React.useState<PlanVersionSummary[]>([]);
  const [versionTotal, setVersionTotal] = React.useState(0);
  const [persisted, setPersisted] = React.useState(false);
  const [adjustment, setAdjustment] = React.useState<DynamicPlanAdjustment | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [chatting, setChatting] = React.useState(false);
  const [activating, setActivating] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [restoringAdjustment, setRestoringAdjustment] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const applyState = React.useCallback((data: PlanStateResponse | null) => {
    if (!data) return;
    setPlan(data.plan ?? null);
    setActivePlan(data.activePlan ?? null);
    setActiveVersion(data.activeVersion ?? null);
    setVersions(Array.isArray(data.versions) ? data.versions : []);
    setVersionTotal(typeof data.versionTotal === "number" ? data.versionTotal : (data.versions?.length ?? 0));
    setPersisted(Boolean(data.persisted));
    setAdjustment(data.adjustment ?? null);
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/plans/latest");
      if (!response.ok) return;
      applyState((await response.json()) as PlanStateResponse);
    } catch {
      // 读取失败不影响已有计划。
    }
  }, [applyState]);

  React.useEffect(() => {
    if (!hasStored) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/plans/latest");
        if (!response.ok) return;
        const data = (await response.json()) as PlanStateResponse;
        if (cancelled) return;
        applyState(data);
      } catch {
        // 读取失败不影响生成入口，用户仍可手动生成。
      }
    })();
    return () => { cancelled = true; };
  }, [hasStored, applyState]);

  React.useEffect(() => {
    if (!hasStored) return;
    const handler = () => { void refresh(); };
    window.addEventListener("plan-adjustment-changed", handler);
    return () => window.removeEventListener("plan-adjustment-changed", handler);
  }, [hasStored, refresh]);

  const generate = React.useCallback(async (feedback?: string, options?: { silentError?: boolean }): Promise<PlanGenerateOutcome> => {
    if (!hasStored || loading || chatting || activating !== null || deleting) {
      return { ok: false, message: "正在处理上一个操作，请稍候再试。" };
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback?.trim() ? { feedback: feedback.trim() } : {}),
      });
      const data = (await response.json().catch(() => null)) as PlanStateResponse | null;
      if (!response.ok || !data?.plan) throw new Error(data?.message ?? "计划生成失败，请稍后重试。");
      applyState(data);
      return {
        ok: true,
        version: data.generatedVersion ?? data.plan.version,
        summary: data.plan.revision?.summary ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "计划生成失败，请稍后重试。";
      if (!options?.silentError) setError(message);
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  }, [activating, applyState, chatting, deleting, hasStored, loading]);

  const chat = React.useCallback(async (messages: Array<{ role: "user" | "assistant"; content: string }>, kind: PlanKind): Promise<PlanChatReply> => {
    if (!hasStored || loading || chatting || activating !== null || deleting) {
      return { ok: false, message: "正在处理上一个操作，请稍候再试。" };
    }
    setChatting(true);
    try {
      const response = await fetch("/api/plans/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, kind }),
      });
      const data = (await response.json().catch(() => null)) as PlanStateResponse | null;
      if (!response.ok || !data?.reply) throw new Error(data?.message ?? "暂时没能回答，请稍后再试。");
      if (data.plan) applyState(data);
      return {
        ok: true,
        reply: data.reply,
        applied: Boolean(data.applied),
        version: data.generatedVersion ?? data.plan?.version ?? null,
        summary: data.plan?.revision?.summary ?? null,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "暂时没能回答，请稍后再试。" };
    } finally {
      setChatting(false);
    }
  }, [activating, applyState, chatting, deleting, hasStored, loading]);

  const activate = React.useCallback(async (version: number) => {
    if (!hasStored || activating !== null || loading || chatting || deleting) return;
    setActivating(version);
    setError(null);
    try {
      const response = await fetch("/api/plans/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = (await response.json().catch(() => null)) as PlanStateResponse | null;
      if (!response.ok || !data) throw new Error(data?.message ?? "这个版本暂时无法启用，请稍后重试。");
      applyState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "这个版本暂时无法启用，请稍后重试。");
    } finally {
      setActivating(null);
    }
  }, [activating, applyState, chatting, deleting, hasStored, loading]);

  const remove = React.useCallback(async (versions: number[]): Promise<PlanDeleteOutcome> => {
    if (!hasStored || deleting || loading || chatting || activating !== null) {
      return { ok: false, message: "正在处理上一个操作，请稍候再试。" };
    }
    if (versions.length === 0) {
      return { ok: false, message: "请先选择要删除的版本。" };
    }
    setDeleting(true);
    try {
      const response = await fetch("/api/plans/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versions }),
      });
      const data = (await response.json().catch(() => null)) as PlanStateResponse | null;
      if (!response.ok || !data) throw new Error(data?.message ?? "删除失败，请稍后重试。");
      applyState(data);
      return {
        ok: true,
        deletedCount: typeof data.deletedCount === "number" ? data.deletedCount : versions.length,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "删除失败，请稍后重试。" };
    } finally {
      setDeleting(false);
    }
  }, [activating, applyState, chatting, deleting, hasStored, loading]);

  const restoreAdjustment = React.useCallback(async () => {
    if (!hasStored || restoringAdjustment) return;
    setRestoringAdjustment(true);
    setError(null);
    try {
      const response = await fetch("/api/plans/adjust/restore", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? "暂时无法恢复正式计划。");
      setAdjustment(null);
      window.dispatchEvent(new CustomEvent("plan-adjustment-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法恢复正式计划。");
    } finally {
      setRestoringAdjustment(false);
    }
  }, [hasStored, restoringAdjustment]);

  return {
    plan: hasStored ? plan : null,
    activePlan: hasStored ? activePlan : null,
    activeVersion: hasStored ? activeVersion : null,
    versions: hasStored ? versions : [],
    versionTotal: hasStored ? versionTotal : 0,
    persisted: hasStored ? persisted : false,
    adjustment: hasStored ? adjustment : null,
    loading,
    chatting,
    activating,
    deleting,
    restoringAdjustment,
    error,
    generate,
    chat,
    activate,
    remove,
    restoreAdjustment,
  };
}

function useTilt(ref: React.RefObject<HTMLDivElement | null>) {
  const reduce = useReducedMotion();

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType !== "mouse") return;
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    element.style.setProperty("--tilt-x", `${(-py * 9).toFixed(2)}deg`);
    element.style.setProperty("--tilt-y", `${(px * 11).toFixed(2)}deg`);
  }

  function onPointerLeave() {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--tilt-x", "0deg");
    element.style.setProperty("--tilt-y", "0deg");
  }

  return { onPointerMove, onPointerLeave };
}

function PlanParticles({ tone }: { tone: "light" | "dark" }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const surface = canvas;
    const ctx = context;

    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = reduceQuery.matches;
    let frame = 0;
    let running = false;
    let width = 0;
    let height = 0;
    const colors = tone === "dark"
      ? [[244, 239, 218], [210, 183, 132], [255, 255, 255]]
      : [[114, 143, 115], [183, 121, 63], [255, 255, 255]];

    function makeSprite(color: number[]) {
      const sprite = document.createElement("canvas");
      sprite.width = 64;
      sprite.height = 64;
      const brush = sprite.getContext("2d");
      if (!brush) return sprite;
      const [r, g, b] = color;
      const gradient = brush.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, .9)`);
      gradient.addColorStop(0.38, `rgba(${r}, ${g}, ${b}, .32)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      brush.fillStyle = gradient;
      brush.fillRect(0, 0, 64, 64);
      return sprite;
    }

    const sprites = colors.map(makeSprite);
    type Mote = { x: number; y: number; r: number; speed: number; drift: number; phase: number; alpha: number; sprite: HTMLCanvasElement };
    let motes: Mote[] = [];

    function seed() {
      const count = Math.max(14, Math.min(46, Math.round(width / 26)));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 2.2,
        speed: 0.12 + Math.random() * 0.34,
        drift: 0.2 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.18 + Math.random() * 0.42,
        sprite: sprites[Math.floor(Math.random() * sprites.length)],
      }));
    }

    function draw(time: number) {
      ctx.clearRect(0, 0, width, height);
      for (const mote of motes) {
        const x = mote.x + Math.sin(time * 0.0004 + mote.phase) * mote.drift * 18;
        const rawY = mote.y - ((time * 0.012 * mote.speed) % (height + 40));
        const y = rawY < -20 ? rawY + height + 40 : rawY;
        const size = mote.r * 6;
        ctx.globalAlpha = mote.alpha;
        ctx.drawImage(mote.sprite, x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function loop(time: number) {
      if (!running) return;
      draw(time);
      frame = requestAnimationFrame(loop);
    }

    function start() {
      cancelAnimationFrame(frame);
      if (document.hidden) return;
      running = true;
      if (reduce) {
        draw(0);
        running = false;
        return;
      }
      frame = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(frame);
    }

    function resize() {
      const rect = surface.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      surface.width = Math.round(width * dpr);
      surface.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      start();
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    }, { threshold: 0 });
    const resizeObserver = new ResizeObserver(resize);
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    const onReducedMotion = () => { reduce = reduceQuery.matches; start(); };

    observer.observe(surface);
    resizeObserver.observe(surface);
    document.addEventListener("visibilitychange", onVisibility);
    reduceQuery.addEventListener("change", onReducedMotion);
    resize();

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceQuery.removeEventListener("change", onReducedMotion);
    };
  }, [tone]);

  return <canvas ref={canvasRef} className="pp-particles" aria-hidden="true" />;
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (!inView || reduce) return;
    let frame = 0;
    const started = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, value]);

  return <span ref={ref}>{(reduce ? value : display).toLocaleString("zh-CN")}</span>;
}

function PlateInstrument() {
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const tilt = useTilt(sceneRef);

  return (
    <div className="pp-instrument-float">
      <div className="pp-plate-scene" ref={sceneRef} {...tilt}>
        <div className="pp-plate-tilt">
          <div className="pp-plate-card">
            <span className="pp-plate-surface" aria-hidden="true">
              <span className="pp-plate-orbit orbit-a" />
              <span className="pp-plate-orbit orbit-b" />
            </span>
            <span className="pp-plate-glass" aria-hidden="true" />
            <div className="pp-plate-body">
              <div className="pp-instrument-head"><span>一餐的样子</span></div>
              <div className="pp-plate-stack">
                <span className="pp-plate-ring pp-plate-ring-3" aria-hidden="true" />
                <span className="pp-plate-ring pp-plate-ring-2" aria-hidden="true" />
                <span className="pp-plate-ring pp-plate-ring-1" aria-hidden="true" />
                <div className="pp-plate-disc" role="img" aria-label="示例餐盘结构：一半蔬菜，四分之一蛋白质，四分之一主食">
                  <span className="pp-plate-half" aria-hidden="true">½</span>
                  <span className="pp-plate-half-label" aria-hidden="true">蔬菜</span>
                </div>
              </div>
              <div className="pp-plate-legend" aria-hidden="true">
                <span><i className="veg" />蔬菜 ½</span>
                <span><i className="protein" />蛋白质 ¼</span>
                <span><i className="staple" />主食 ¼</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekInstrument({ plan, hasStored }: { plan?: PlanDocument | null; hasStored: boolean }) {
  const [today, setToday] = React.useState(-1);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const tilt = useTilt(sceneRef);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setToday(shanghaiWeekdayIndex()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const days = plan
    ? plan.movement.week.map((day) => ({
        label: day.label,
        short: day.short,
        title: day.session?.title ?? "休息",
        minutes: day.session?.minutes ?? 0,
        tone: day.session ? "session" : "rest",
      }))
    : hasStored
      ? weekPlan.map((day) => ({ label: day.label, short: day.short, title: day.title, minutes: day.minutes, tone: day.tone }))
      : weekPlan.map((day) => ({ label: day.label, short: day.short, title: "待生成", minutes: 0, tone: "rest" as const }));
  const spoken = days.filter((day) => day.minutes > 0).map((day) => `${day.label}${day.title}${day.minutes}分钟`).join("，");
  const ariaLabel = plan
    ? `按资料生成的周节奏：${spoken}。`
    : hasStored
      ? "示例周节奏：周二力量二十五分钟，周四快走与活动度二十分钟，周六力量二十五分钟。"
      : "还没有生成周节奏；保存资料后再生成。";
  const foot = plan
    ? `${plan.movement.sessionCount} 次活动 · 约 ${plan.movement.totalMinutes} 分钟`
    : hasStored
      ? "3 次活动 · 约 70 分钟"
      : "保存资料后生成";

  return (
    <div className="pp-instrument-float">
      <div className="pp-week-scene" ref={sceneRef} {...tilt}>
        <div className="pp-week-card">
          <span className="pp-plate-glass" aria-hidden="true" />
          <div className="pp-week-body">
            <div className="pp-instrument-head"><span>本周节奏</span></div>
            <div className="pp-week-mini" role="img" aria-label={ariaLabel}>
              {days.map((day, index) => (
                <div key={day.label} className={`pp-week-mini-day ${day.tone === "session" ? "has-session" : ""} ${index === today ? "is-today" : ""}`} aria-hidden="true">
                  <span>{day.short}</span>
                  <i />
                  <small>{day.minutes > 0 ? `${day.minutes}′` : "·"}</small>
                </div>
              ))}
            </div>
            <div className="pp-week-mini-foot"><Footprints size={13} aria-hidden="true" /> {foot} · {todayLabel(today)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanHero({ kind, data, plan, hasStored }: { kind: PlanKind; data?: DashboardData; plan?: PlanDocument | null; hasStored: boolean }) {
  const reduce = useReducedMotion();
  const diet = kind === "diet";
  const goal = data?.calorieGoal ?? null;
  const macros = data?.macros ?? null;
  const targets = plan?.targets ?? null;
  const firstSessionMinutes = plan?.movement.sessions[0]?.minutes ?? null;

  return (
    <section className={`pp-hero pp-hero-${kind}`} aria-labelledby={`pp-${kind}-title`}>
      <div className="pp-hero-media">
        <Image
          src={diet ? "/images/plan-diet-hero.webp" : "/images/plan-exercise-hero.webp"}
          alt={diet ? "木质餐桌上摆放着燕麦鸡蛋碗、酸奶、牛油果和蔬菜的早餐" : "清晨湖畔的木栈道上，一名男子正在做弓步拉伸"}
          fill
          sizes="(max-width: 800px) 100vw, 1150px"
          priority
        />
      </div>
      <div className="pp-hero-veil" aria-hidden="true" />
      <PlanParticles tone={diet ? "light" : "dark"} />
      <div className="pp-hero-inner">
        <motion.div
          className="pp-hero-copy"
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.7, ease }}
        >
          <div className="pp-kicker">
            <span>{diet ? "DIET" : "MOVEMENT"}</span>
            <i aria-hidden="true" />
            <span>{diet ? "饮食计划" : "运动计划"}</span>
          </div>
          <h1 id={`pp-${kind}-title`}>{diet ? "吃得刚刚好，\n比吃得完美更重要。" : "把训练，\n放回风里。"}</h1>
          <p className="pp-hero-lede">
            {plan
              ? diet
                ? "按资料生成的餐次与热量结构；份量按饥饿感微调。"
                : "按资料生成的每周节奏；状态一般时先减量。"
              : diet
                ? "每餐先有蛋白质、蔬菜和主食。"
                : hasStored
                  ? "每周三次的示例节奏；忙时走十分钟也算。"
                  : "保存资料后才会生成你的计划。"}
          </p>
          <div className="pp-meta-row">
            {diet ? (
              <>
                {targets ? (
                  <>
                    <span className="pp-chip">每日参考 <strong>{targets.calorieLow}–{targets.calorieHigh}</strong> kcal</span>
                    <span className="pp-chip">蛋白质 <strong>{targets.proteinLow}–{targets.proteinHigh}</strong> g</span>
                  </>
                ) : hasStored ? (
                  <>
                    <span className="pp-chip">目标待生成</span>
                    <span className="pp-chip">生成后显示蛋白质区间</span>
                  </>
                ) : (
                  <>
                    <span className="pp-chip">{goal !== null ? <>演示参考 <strong>{goal.toLocaleString("zh-CN")}</strong> kcal</> : "参考目标未接入"}</span>
                    <span className="pp-chip">{macros ? <>演示蛋白质 <strong>{macros.protein.goal}</strong> g</> : "营养明细未接入"}</span>
                  </>
                )}
                <span className="pp-chip">{data && data.mealsToday > 0 ? <>今天已记录 <strong>{data.mealsToday}</strong> 餐</> : "今天还没有记录"}</span>
              </>
            ) : plan ? (
              <>
                <span className="pp-chip">每周 <strong>{plan.movement.sessionCount}</strong> 次</span>
                <span className="pp-chip">{firstSessionMinutes !== null ? <>每次约 <strong>{firstSessionMinutes}</strong> 分钟</> : "时长待生成"}</span>
                <span className="pp-chip">{plan.movement.environmentLabel}</span>
              </>
            ) : hasStored ? (
              <>
                <span className="pp-chip">安排待生成</span>
                <span className="pp-chip">生成后显示每周节奏</span>
              </>
            ) : (
              <>
                <span className="pp-chip">资料未保存</span>
                <span className="pp-chip">保存后生成每周节奏</span>
              </>
            )}
          </div>
        </motion.div>
        <motion.div
          className="pp-hero-instrument"
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.85, delay: reduce ? 0 : 0.14, ease }}
        >
          {diet ? <PlateInstrument /> : <WeekInstrument plan={plan} hasStored={hasStored} />}
        </motion.div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <header className="pp-sec-head">
      <div className="pp-sec-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </header>
  );
}

const mealTones = ["amber", "sage", "clay", "forest"] as const;

function GeneratedDiet({ plan }: { plan: PlanDocument }) {
  const effectiveDiet = plan.revisionState?.diet?.style ? dietLabels[plan.revisionState.diet.style] : plan.profileSnapshot.dietLabel;
  return (
    <div className="pp-generated-block">
      <div className="pp-generated-subhead">
        <strong>一天的吃法</strong>
        <span>
          {effectiveDiet} · {plan.dataBasis.usesMealRecords ? "资料 + 近 7 天已确认餐食" : "按资料生成"}
        </span>
      </div>
      <div className="pp-meal-grid">
        {plan.diet.meals.map((meal, index) => (
          <MealCard
            key={`${meal.time}-${meal.label}`}
            meal={{
              time: meal.time,
              label: meal.label,
              title: meal.title,
              detail: meal.detail,
              swap: meal.swap,
              tags: [meal.kcalHint, effectiveDiet].filter((tag): tag is string => Boolean(tag)),
              tone: mealTones[index % mealTones.length],
            }}
          />
        ))}
      </div>
      <div className="pp-generated-notes">
        <p>{plan.diet.avoidNote}</p>
        <p>{plan.diet.budgetNote}</p>
      </div>
    </div>
  );
}

function DynamicAdjustmentBlock({ adjustment, restoring, restore }: {
  adjustment: DynamicPlanAdjustment;
  restoring: boolean;
  restore: () => Promise<void>;
}) {
  return (
    <section className="pp-dynamic" aria-labelledby="pp-dynamic-title">
      <header className="pp-dynamic-head">
        <div className="pp-dynamic-copy">
          <div className="pp-sec-eyebrow">动态饮食调整</div>
          <h3 id="pp-dynamic-title">{adjustment.title}</h3>
          <p>{adjustment.summary}</p>
        </div>
        <span className="pp-dynamic-badge">基于 v{adjustment.baseVersion} · 不占版本</span>
      </header>

      <div className={`pp-dynamic-grid${adjustment.remainingToday.length === 0 ? " is-single" : ""}`}>
        <div className="pp-dynamic-col is-today">
          <div className="pp-dynamic-subhead">
            <div className="pp-dynamic-heading">
              <Clock3 size={17} aria-hidden="true" />
              <strong>今天剩下</strong>
            </div>
            <span className="pp-dynamic-status">{adjustment.remainingToday.length > 0 ? `${adjustment.remainingToday.length} 个餐次` : "已记录完"}</span>
          </div>
          {adjustment.remainingToday.length > 0 ? (
            <ul className="pp-dynamic-meals">
              {adjustment.remainingToday.map((meal) => (
                <li key={`${meal.label}-${meal.time}`}>
                  <span className="pp-dynamic-time">{meal.time}</span>
                  <div>
                    <strong>{meal.label} · {meal.title}</strong>
                    <p>{meal.change}{meal.kcalHint ? ` · ${meal.kcalHint}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pp-dynamic-empty">今天的计划餐次已经记录完，明天按轻一点的安排继续。</p>
          )}
        </div>

        <div className="pp-dynamic-col is-next">
          <div className="pp-dynamic-subhead">
            <div className="pp-dynamic-heading">
              <Sun size={17} aria-hidden="true" />
              <strong>{adjustment.nextDayLabel}</strong>
            </div>
            <span className="pp-dynamic-status">正常节奏</span>
          </div>
          <ul className="pp-dynamic-meals">
            {adjustment.nextDayMeals.map((meal) => (
              <li key={`${meal.label}-${meal.time}`}>
                <span className="pp-dynamic-time">{meal.time}</span>
                <div>
                  <strong>{meal.label} · {meal.title}</strong>
                  <p>{meal.change}{meal.kcalHint ? ` · ${meal.kcalHint}` : ""}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="pp-dynamic-next-note">{adjustment.nextDayNote}</p>

      <div className="pp-dynamic-foot">
        <details className="pp-dynamic-safety">
          <summary><ShieldCheck size={13} aria-hidden="true" />安全边界</summary>
          <p>{adjustment.safetyNote}</p>
        </details>
        <button type="button" className="pp-dynamic-restore" onClick={() => void restore()} disabled={restoring}>
          {restoring ? <Loader2 size={14} className="pp-spin" aria-hidden="true" /> : <RotateCw size={14} aria-hidden="true" />}
          {restoring ? "恢复中…" : "恢复正式计划"}
        </button>
      </div>
    </section>
  );
}

const sessionToneLabels: Record<SpaceSession["tone"], string> = {
  strength: "力量",
  cardio: "心肺",
  mobility: "恢复",
};

function GeneratedMovement({ plan }: { plan: PlanDocument }) {
  const [openDay, setOpenDay] = React.useState<string | null>(null);
  const toggleDay = (label: string) => setOpenDay((current) => current === label ? null : label);
  return (
    <div className="pp-generated-block">
      <div className="pp-generated-subhead">
        <strong>一周的安排</strong>
        <span>{plan.movement.environmentLabel} · {plan.movement.sessionCount} 次 · 约 {plan.movement.totalMinutes} 分钟</span>
      </div>
      <div className="pp-generated-week">
        {plan.movement.week.map((day) => {
          const session = day.session;
          const open = openDay === day.label;
          return (
            <div
              key={day.label}
              className={`pp-daybook${session ? " has-session" : " is-rest"}${open ? " is-open" : ""}`}
              role="button"
              tabIndex={0}
              aria-expanded={open}
              aria-label={session
                ? `${day.label}：${session.title}，${sessionToneLabels[session.tone]}，${session.minutes} 分钟，${session.focus}`
                : `${day.label}：休息 / 散步`}
              onClick={() => toggleDay(day.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleDay(day.label);
                }
              }}
            >
              <div className="pp-daybook-page">
                <span className="pp-daybook-day">{day.label}</span>
                <strong>{session?.title ?? "休息 / 散步"}</strong>
                {session ? (
                  <ul className="pp-daybook-moves">
                    {session.focus.split(" · ").filter(Boolean).map((move) => <li key={move}>{move}</li>)}
                  </ul>
                ) : (
                  <p>今天不安排训练，饭后轻松走一走，给身体留出恢复的时间。</p>
                )}
                <small>{session ? `${sessionToneLabels[session.tone]} · ${session.minutes} 分钟` : "恢复日"}</small>
              </div>
              <div className="pp-daybook-cover" aria-hidden="true">
                <span className="pp-daybook-day">{day.label}</span>
                <strong>{session?.title ?? "休息 / 散步"}</strong>
                <div className="pp-daybook-foot">
                  <small>{session ? `${session.minutes} 分钟` : "恢复日"}</small>
                  <em>翻开</em>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatPlanTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

const agentStatusShort = {
  OK: "建议已完成",
  SKIPPED: "未运行",
  FAILED: "已回退",
} as const;

function PlanStatusBanner({ plan, activeVersion, activating, deleting, activate }: {
  plan: PlanDocument;
  activeVersion: number | null;
  activating: number | null;
  deleting: boolean;
  activate: (version: number) => Promise<void>;
}) {
  const active = plan.version === activeVersion;
  return (
    <div className={`pp-plan-status ${active ? "is-active" : "is-pending"}`} role="status">
      <span className="pp-plan-status-icon" aria-hidden="true">
        {active ? <Check size={16} /> : <Info size={16} />}
      </span>
      <div className="pp-plan-status-copy">
        <strong>{active ? `v${plan.version} 已启用为当前计划` : `v${plan.version} 是建议版本，尚未启用`}</strong>
        <p>
          {active
            ? "新版本会先作为建议。"
            : activeVersion !== null
              ? `当前启用 v${activeVersion}；确认后再启用本版。`
              : "确认依据后启用。"}
        </p>
      </div>
      {!active && (
        <button type="button" className="pp-plan-activate" onClick={() => void activate(plan.version)} disabled={activating !== null || deleting}>
          {activating === plan.version ? <Loader2 size={15} className="pp-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          {activating === plan.version ? "启用中…" : "启用这个版本"}
        </button>
      )}
    </div>
  );
}

function PlanRevisionBlock({ plan }: { plan: PlanDocument }) {
  const revision = plan.revision;
  if (!revision || revision.basedOnVersion === null) return null;
  return (
    <div className="pp-plan-revision">
      <div className="pp-generated-subhead">
        <strong>本版变化</strong>
        <span>{revision.basedOnVersion === null ? "首版" : `对比 v${revision.basedOnVersion}`}</span>
      </div>
      <p className="pp-plan-revision-summary">{revision.summary}</p>
      {revision.request && (
        <p className="pp-plan-revision-request"><span>你的意见</span>{revision.request}</p>
      )}
      {revision.changes.length > 0 && (
        <ul>
          {revision.changes.map((change) => (
            <li key={change.area}>
              <strong>{change.area}</strong>
              <span>{change.before}</span>
              <ArrowRight size={12} aria-hidden="true" />
              <span>{change.after}</span>
            </li>
          ))}
        </ul>
      )}
      {revision.notes && revision.notes.length > 0 && (
        <div className="pp-plan-revision-notes">
          {revision.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      )}
    </div>
  );
}

function PlanHistory({ versions, versionTotal, activating, deleting, activate, remove }: {
  versions: PlanVersionSummary[];
  versionTotal: number;
  activating: number | null;
  deleting: boolean;
  activate: (version: number) => Promise<void>;
  remove: (versions: number[]) => Promise<PlanDeleteOutcome>;
}) {
  const [managing, setManaging] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set());
  const [confirming, setConfirming] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const versionSignature = versions.map((item) => `${item.version}:${item.active ? 1 : 0}`).join("|");
  const [knownVersionSignature, setKnownVersionSignature] = React.useState(versionSignature);
  if (knownVersionSignature !== versionSignature) {
    setKnownVersionSignature(versionSignature);
    const allowed = new Set(versions.filter((item) => !item.active).map((item) => item.version));
    setSelected((current) => {
      const next = new Set([...current].filter((version) => allowed.has(version)));
      return next.size === current.size ? current : next;
    });
    setConfirming(false);
    if (allowed.size === 0) setManaging(false);
  }

  if (versions.length === 0) return null;
  const hiddenCount = Math.max(0, versionTotal - versions.length);
  const deletableCount = versions.filter((item) => !item.active).length;
  const busy = activating !== null || deleting;

  const toggle = (version: number) => {
    setDeleteError(null);
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const startManaging = () => {
    setManaging(true);
    setSelected(new Set());
    setConfirming(false);
    setDeleteError(null);
    setNotice(null);
  };

  const stopManaging = () => {
    setManaging(false);
    setSelected(new Set());
    setConfirming(false);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (selected.size === 0 || deleting) return;
    const outcome = await remove([...selected]);
    if (outcome.ok) {
      setManaging(false);
      setSelected(new Set());
      setConfirming(false);
      setDeleteError(null);
      setNotice(`已删除 ${outcome.deletedCount} 个版本。`);
      return;
    }
    setConfirming(false);
    setDeleteError(outcome.message);
  };

  return (
    <div className={`pp-plan-history ${managing ? "is-managing" : ""}`}>
      <div className="pp-generated-subhead pp-plan-history-head">
        <div className="pp-plan-history-title">
          <strong>版本历史</strong>
          <span>共 {versionTotal} 版</span>
        </div>
        {deletableCount > 0 && (
          <button
            type="button"
            className="pp-plan-history-manage"
            onClick={() => (managing ? stopManaging() : startManaging())}
            disabled={busy}
          >
            {managing ? <Check size={12} aria-hidden="true" /> : <Settings2 size={12} aria-hidden="true" />}
            {managing ? "完成" : "管理"}
          </button>
        )}
      </div>
      {notice && <p className="pp-plan-history-notice" role="status">{notice}</p>}
      {hiddenCount > 0 && (
        <p className="pp-plan-history-note">这里显示最近 {versions.length} 个版本，更早的 {hiddenCount} 版仍保留在账户中。</p>
      )}
      <ul>
        {versions.map((item) => (
          <li key={item.version} className={[item.active ? "is-active" : item.isLatest ? "is-latest" : "", selected.has(item.version) ? "is-selected" : ""].filter(Boolean).join(" ")}>
            <div className="pp-plan-history-version">
              {managing && (
                <input
                  type="checkbox"
                  className="pp-plan-history-check"
                  checked={selected.has(item.version)}
                  disabled={item.active || deleting}
                  onChange={() => toggle(item.version)}
                  aria-label={item.active ? `v${item.version} 当前启用，不能删除` : `选择 v${item.version} 以删除`}
                />
              )}
              <div className="pp-plan-history-version-main">
                <strong>v{item.version}</strong>
                {item.active && <span className="pp-plan-history-badge">当前启用</span>}
                {!item.active && item.isLatest && <span className="pp-plan-history-badge is-suggest">最新建议</span>}
              </div>
            </div>
            <div className="pp-plan-history-copy">
              <p>{item.summary}</p>
              <small>
                {formatPlanTime(item.createdAt)}
                {item.basedOnVersion !== null ? ` · 基于 v${item.basedOnVersion}` : " · 首版"}
                {item.inputSummary ? ` · 已确认餐食 ${item.inputSummary.confirmedMeals} 餐 / ${item.inputSummary.recordedDays} 天` : ""}
              </small>
            </div>
            {item.active ? (
              <span className="pp-plan-history-current"><Check size={13} aria-hidden="true" />正在使用</span>
            ) : managing ? null : (
              <button
                type="button"
                className="pp-plan-history-activate"
                onClick={() => void activate(item.version)}
                disabled={busy}
              >
                {activating === item.version ? <Loader2 size={13} className="pp-spin" aria-hidden="true" /> : <History size={13} aria-hidden="true" />}
                {activating === item.version ? "启用中…" : "启用此版"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {managing && (
        <div className={`pp-plan-history-managebar ${selected.size > 0 ? "has-selection" : ""}`}>
          <p>
            {confirming
              ? `确认删除 ${selected.size} 个版本？删除后不可恢复。`
              : selected.size > 0
                ? `已选 ${selected.size} 个版本 · 删除后不可恢复`
                : "勾选要删除的版本；当前启用的版本不能删除。"}
          </p>
          {selected.size > 0 && (
            <div className="pp-plan-history-manage-actions">
              {confirming ? (
                <>
                  <button type="button" className="pp-plan-history-cancel" onClick={() => setConfirming(false)} disabled={deleting}>再想想</button>
                  <button type="button" className="pp-plan-history-danger" onClick={() => void confirmDelete()} disabled={deleting}>
                    {deleting ? <Loader2 size={13} className="pp-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                    {deleting ? "删除中…" : "确认删除"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="pp-plan-history-cancel" onClick={() => { setSelected(new Set()); setConfirming(false); }} disabled={deleting}>取消选择</button>
                  <button type="button" className="pp-plan-history-danger" onClick={() => setConfirming(true)} disabled={deleting}>
                    <Trash2 size={13} aria-hidden="true" />删除所选
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {deleteError && <p className="pp-plan-history-error" role="alert">{deleteError}</p>}
    </div>
  );
}

const revisionQuickChips: Record<PlanKind, readonly string[]> = {
  diet: ["去掉加餐", "整体清淡一点", "晚餐还能怎么换？", "为什么这样安排？"],
  exercise: ["每次缩短到 20 分钟", "改成无器材训练", "我只有哑铃和瑜伽垫", "强度怎么判断？"],
};

const revisionPlaceholders: Record<PlanKind, string> = {
  diet: "问计划里的安排，或直接说想改哪里",
  exercise: "问训练安排，或直接说想改哪里",
};

type RevisionMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  tone?: "ok" | "error";
};

function PlanRevisionDialog({ kind, plan, busy, onClose, onChat, onRegenerate }: {
  kind: PlanKind;
  plan: PlanDocument;
  busy: boolean;
  onClose: () => void;
  onChat: (messages: Array<{ role: "user" | "assistant"; content: string }>) => Promise<PlanChatReply>;
  onRegenerate: () => Promise<PlanGenerateOutcome>;
}) {
  const reduce = useReducedMotion();
  const [feedback, setFeedback] = React.useState("");
  const [messages, setMessages] = React.useState<RevisionMessage[]>(() => [{
    id: 1,
    role: "assistant",
    text: kind === "diet"
      ? "可以问我为什么这样安排、某一餐怎么替换，也可以直接说想改哪里。"
      : "可以问我为什么这样安排、训练强度怎么判断，也可以直接说想改哪里。",
  }]);
  const [pending, setPending] = React.useState(false);
  const idRef = React.useRef(1);
  const threadRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(frame);
      returnFocusRef.current?.focus();
    };
    // 挂载时初始化会话，计划更新后保留当前对话。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, pending, reduce]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || pending || busy) return;
    const userMessage: RevisionMessage = { id: ++idRef.current, role: "user", text: value };
    const history = [...messages.filter((message) => message.tone !== "error"), userMessage]
      .map((message) => ({ role: message.role, content: message.text }));
    setMessages((prev) => [...prev, userMessage]);
    setFeedback("");
    setPending(true);
    const outcome = await onChat(history);
    setPending(false);
    if (!outcome.ok) {
      setMessages((prev) => [...prev, { id: ++idRef.current, role: "assistant", tone: "error", text: outcome.message }]);
      return;
    }
    const appliedLine = outcome.applied && outcome.version !== null
      ? `已生成 v${outcome.version}${outcome.summary ? `：${outcome.summary}` : "。"}`
      : null;
    setMessages((prev) => [...prev, {
      id: ++idRef.current,
      role: "assistant",
      tone: outcome.applied ? "ok" : undefined,
      text: appliedLine ? `${outcome.reply}\n\n${appliedLine}` : outcome.reply,
    }]);
  }

  async function regenerate() {
    if (pending || busy) return;
    setMessages((prev) => [...prev, { id: ++idRef.current, role: "user", text: "不加意见，直接重新生成一版。" }]);
    setPending(true);
    const outcome = await onRegenerate();
    setPending(false);
    setMessages((prev) => [...prev, {
      id: ++idRef.current,
      role: "assistant",
      tone: outcome.ok ? "ok" : "error",
      text: outcome.ok ? `已按当前资料重新生成 v${outcome.version}。` : outcome.message,
    }]);
  }

  return createPortal(
    <div className="pp-revision-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="pp-revision-dialog" role="dialog" aria-modal="true" aria-labelledby="pp-revision-title">
        <header className="pp-revision-head">
          <div>
            <div className="pp-sec-eyebrow">AI 计划搭子 · 当前 v{plan.version}</div>
            <h2 id="pp-revision-title">聊聊这份计划。</h2>
          </div>
          <button type="button" className="pp-revision-close" onClick={onClose} aria-label="关闭计划对话">
            <X size={17} />
          </button>
        </header>

        <div className="pp-revision-thread" ref={threadRef} aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`pp-revision-msg is-${message.role}${message.tone ? ` is-${message.tone}` : ""}`}>
              <span className="pp-revision-avatar" aria-hidden="true">
                {message.role === "assistant" ? <Sparkles size={13} /> : "你"}
              </span>
              <div className="pp-revision-bubble">{message.text}</div>
            </div>
          ))}
          {pending && (
            <div className="pp-revision-msg is-assistant">
              <span className="pp-revision-avatar" aria-hidden="true"><Sparkles size={13} /></span>
              <div className="pp-revision-bubble is-typing">
                <Loader2 size={13} className="pp-spin" aria-hidden="true" />正在结合当前计划想一想…
              </div>
            </div>
          )}
        </div>

        <div className="pp-revision-quick" role="group" aria-label="快捷提问或调整">
          {revisionQuickChips[kind].map((chip) => (
            <button
              type="button"
              key={chip}
              onClick={() => void send(chip)}
              disabled={pending || busy}
            >
              {chip}
            </button>
          ))}
        </div>

        <form className="pp-revision-compose" onSubmit={(event) => { event.preventDefault(); void send(feedback); }}>
          <textarea
            ref={textareaRef}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={2}
            maxLength={600}
            placeholder={revisionPlaceholders[kind]}
            disabled={pending || busy}
            aria-label="输入问题或调整意见"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send(feedback);
              }
            }}
          />
          <div className="pp-revision-compose-foot">
            <button type="button" className="pp-revision-regenerate" onClick={() => void regenerate()} disabled={pending || busy}>
              <RotateCw size={13} aria-hidden="true" />直接重生成
            </button>
            <button type="submit" className="pp-revision-send" disabled={pending || busy || !feedback.trim()} aria-label="发送消息">
              {pending ? <Loader2 size={15} className="pp-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
            </button>
          </div>
        </form>

        <p className="pp-revision-note">可以问安排，也可以直接说想改哪里。改计划会生成新版本；热量、蛋白质目标与安全边界仍由规则计算。</p>
      </div>
    </div>,
    document.body,
  );
}

function GeneratedPlanPanel({ kind, profile, hasStored, planState }: {
  kind: PlanKind;
  profile: SpaceProfile;
  hasStored: boolean;
  planState: PlanState;
}) {
  const setPage = useHealthStore((state) => state.setPage);
  const { plan, activeVersion, versions, versionTotal, adjustment, loading, chatting, activating, deleting, restoringAdjustment, error, generate, chat, activate, remove, restoreAdjustment } = planState;
  const completeness = hasStored ? spaceCompleteness(profile) : spaceCompleteness(createEmptySpaceProfile());
  const [revisionOpen, setRevisionOpen] = React.useState(false);

  if (!hasStored) {
    return (
      <Reveal>
        <section className="pp-generated pp-generated--empty" aria-labelledby="pp-generated-title">
          <header className="pp-generated-head">
            <div>
              <div className="pp-sec-eyebrow">你的计划 · 尚未生成</div>
              <h2 id="pp-generated-title">请先完成资料填写。</h2>
            </div>
            <span className="pp-generated-stamp">未保存资料</span>
          </header>
          <div className="pp-generated-empty-row">
            <div>
              <strong>还需要：{completeness.missing.join("、")}</strong>
            </div>
            <GlitchButton className="pp-generated-cta" onClick={() => setPage("profile")}>去补充资料 <ArrowRight size={15} aria-hidden="true" /></GlitchButton>
          </div>
        </section>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <section className={`pp-generated pp-generated--${kind}`} aria-labelledby="pp-generated-title">
        <header className="pp-generated-head">
          <div>
            <div className="pp-sec-eyebrow">你的生成计划{plan ? ` · 版本 v${plan.version}` : ""}</div>
            <h2 id="pp-generated-title">
              {plan
                ? kind === "diet"
                  ? "为你量身定制的专属饮食计划。"
                  : "为你量身定制的专属运动计划。"
                : "资料已就位，生成第一版。"}
            </h2>
          </div>
          <button
            type="button"
            className="pp-generated-regen"
            onClick={() => { if (plan) setRevisionOpen(true); else void generate(); }}
            disabled={loading || activating !== null || deleting}
          >
            {loading ? <Loader2 size={15} className="pp-spin" aria-hidden="true" /> : plan ? <MessageCircle size={15} aria-hidden="true" /> : <RotateCw size={15} aria-hidden="true" />}
            {loading ? "生成中…" : plan ? "生成新版本" : "生成我的计划"}
          </button>
        </header>

        {plan && revisionOpen && (
          <PlanRevisionDialog
            kind={kind}
            plan={plan}
            busy={loading || chatting || activating !== null || deleting}
            onClose={() => setRevisionOpen(false)}
            onChat={(messages) => chat(messages, kind)}
            onRegenerate={() => generate(undefined, { silentError: true })}
          />
        )}

        {plan && <PlanStatusBanner plan={plan} activeVersion={activeVersion} activating={activating} deleting={deleting} activate={activate} />}

        {error && <p className="pp-generated-error" role="alert">{error}</p>}
        {loading && !plan && (
          <div className="pp-generated-loading">
            <Loader2 size={18} className="pp-spin" aria-hidden="true" />
            <span>正在汇总记录并计算…</span>
          </div>
        )}

        {plan && (
          <>
            <div className="pp-generated-meta">
              <span>v{plan.version}</span>
              <span>{formatPlanTime(plan.generatedAt)}</span>
              <span>资料 {plan.completeness.filled}/{plan.completeness.total}</span>
              <span>{plan.dataBasis.source === "demo" ? "演示资料" : "资料页填写"}</span>
              {plan.dataBasis.usesMealRecords && <span>已确认餐食 {plan.dataBasis.mealRecordCount} 餐</span>}
              {plan.agent && <span>AI {agentStatusShort[plan.agent.status]}</span>}
              <span>{plan.engineName} · {plan.engineVersion}</span>
            </div>

            {plan.targets ? (
              <div className="pp-generated-targets">
                <div><small>每日热量参考</small><strong>{plan.targets.calorieLow}–{plan.targets.calorieHigh}</strong><span>kcal</span></div>
                <div><small>蛋白质参考</small><strong>{plan.targets.proteinLow}–{plan.targets.proteinHigh}</strong><span>g</span></div>
                <div><small>饮水参考</small><strong>{plan.targets.waterLow.toFixed(1)}–{plan.targets.waterHigh.toFixed(1)}</strong><span>L</span></div>
                <div><small>当前目标</small><strong className="is-text">{plan.profileSnapshot.goalLabel}</strong><span>每周 {plan.movement.sessionCount} 次</span></div>
              </div>
            ) : (
              <div className="pp-generated-reason">
                <Info size={15} aria-hidden="true" />
                <p>{plan.targetsReason ?? "资料不足，暂时不生成热量与蛋白质目标。"}</p>
              </div>
            )}
            {plan.goalLine && <p className="pp-generated-goal">{plan.goalLine}</p>}

            {kind === "diet" ? <GeneratedDiet plan={plan} /> : <GeneratedMovement plan={plan} />}

            {kind === "diet" && adjustment && (
              <DynamicAdjustmentBlock adjustment={adjustment} restoring={restoringAdjustment} restore={restoreAdjustment} />
            )}

            <PlanRevisionBlock plan={plan} />

            <PlanHistory versions={versions} versionTotal={versionTotal} activating={activating} deleting={deleting} activate={activate} remove={remove} />
          </>
        )}
      </section>
    </Reveal>
  );
}

function ExampleDivider() {
  return (
    <div className="pp-example-divider" role="note">
      <span>以下为通用示例</span>
    </div>
  );
}

function MacroRow({ label, value, goal, tone }: { label: string; value: number; goal: number | null; tone: string }) {
  const percent = goal && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className="pp-macro">
      <div className="pp-macro-head"><span>{label}</span><b>{Math.round(value)} <small>/ {goal === null ? "—" : `${goal} g`}</small></b></div>
      <div className="pp-macro-track" role="progressbar" aria-label={`${label}参考目标进度`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span className={tone} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

type MealCardData = {
  time: string;
  label: string;
  title: string;
  detail?: string;
  swap: string;
  tags: readonly string[];
  tone: "amber" | "sage" | "clay" | "forest";
};

function MealCard({ meal }: { meal: MealCardData }) {
  const [flipped, setFlipped] = React.useState(false);
  return (
    <button
      type="button"
      className={`pp-meal tone-${meal.tone} ${flipped ? "flipped" : ""}`}
      aria-expanded={flipped}
      onClick={(event) => {
        if (event.detail > 0 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        setFlipped((value) => !value);
      }}
    >
      <span className="pp-meal-sheet pp-meal-sheet-back" aria-hidden="true" />
      <span className="pp-meal-sheet pp-meal-sheet-mid" aria-hidden="true" />
      <span className="pp-meal-inner">
        <span className="pp-meal-face pp-meal-front" aria-hidden={flipped}>
          <span className="pp-meal-top"><span className="pp-meal-time">{meal.time}</span></span>
          <span className="pp-meal-kicker">{meal.label}</span>
          <strong>{meal.title}</strong>
          {meal.detail && <span className="pp-meal-detail">{meal.detail}</span>}
          <span className="pp-meal-tags">{meal.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
          <span className="pp-meal-hint">
            <span className="pp-meal-hint-hover">悬停看替换</span>
            <span className="pp-meal-hint-touch">点按看替换</span>
            <RotateCw size={12} aria-hidden="true" />
          </span>
        </span>
        <span className="pp-meal-face pp-meal-back" aria-hidden={!flipped}>
          <span className="pp-meal-back-top"><span>替换思路</span><RotateCw size={12} aria-hidden="true" /></span>
          <span className="pp-meal-swap">{meal.swap}</span>
          <span className="pp-meal-hint">
            <span className="pp-meal-hint-hover">翻回</span>
            <span className="pp-meal-hint-touch">再点翻回</span>
          </span>
        </span>
      </span>
    </button>
  );
}

function DietTargets({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const goal = data?.calorieGoal ?? null;
  const macros = data?.macros ?? null;
  return (
    <Reveal>
      <section className="pp-section" aria-labelledby="pp-target-title">
        <SectionHead
          eyebrow="参考目标"
          title="参考目标，不是考试分数。"
        />
        <div className="pp-target-card">
          <div className="pp-target-main">
            <span className="pp-target-label">每日参考热量</span>
            <div className="pp-target-number">
              {goal !== null ? <><AnimatedNumber value={goal} /><em>kcal</em></> : <span aria-label="目标未接入">—</span>}
            </div>
            <p className="pp-target-source">
              {loading ? "正在读取目标…" : goal === null ? "目标还没有接入" : data?.demo ? "演示目标" : "参考目标"}
            </p>
            <div className="pp-target-today">
              {data && data.mealsToday > 0
                ? <>今天已确认 <strong>{data.calories.toLocaleString("zh-CN")}</strong> kcal · {data.mealsToday} 餐</>
                : loading ? "正在读取今日记录…" : "今天还没有已确认的餐食记录"}
            </div>
          </div>
          <div className="pp-target-macros">
            {macros ? (
              <>
                <MacroRow label="蛋白质" value={macros.protein.consumed} goal={macros.protein.goal} tone="protein" />
                <MacroRow label="碳水" value={macros.carbs.consumed} goal={macros.carbs.goal} tone="carbs" />
                <MacroRow label="脂肪" value={macros.fat.consumed} goal={macros.fat.goal} tone="fat" />
              </>
            ) : (
              <div className="pp-macro-empty">
                <Info size={16} aria-hidden="true" />
                <p>营养明细还没有接入。</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function DietFlex() {
  return (
    <Reveal>
      <section className="pp-section" aria-labelledby="pp-flex-title">
        <SectionHead
          eyebrow="留出弹性"
          title="计划要能落地，才值得坚持。"
        />
        <div className="pp-flex-grid">
          {flexNotes.map(({ icon: Icon, title, copy }) => (
            <article className="pp-flex-card" key={title}>
              <span className="pp-flex-icon"><Icon size={17} aria-hidden="true" /></span>
              <div><h3>{title}</h3><p>{copy}</p></div>
              <small>一般搭配建议</small>
            </article>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

function HonestyPanel({ generated, hasStored }: { generated: boolean; hasStored: boolean }) {
  const setPage = useHealthStore((state) => state.setPage);
  return (
    <Reveal>
      <section className="pp-dark pp-honest" aria-labelledby="pp-honest-title">
        <div className="pp-dark-copy">
          <div className="pp-sec-eyebrow">计划的边界</div>
          <h2 id="pp-honest-title">{generated ? "示例只补充结构，不替代你的计划。" : hasStored ? "这份示例，不会替你做决定。" : "没有资料，就没有你的计划。"}</h2>
          <p>
            {generated
              ? "上方按资料计算，其余为通用示例，不构成营养处方。"
              : hasStored
                ? "还没有生成计划；下方是通用示例，生成后才按资料计算。"
                : "保存资料后才会生成计划；这里不做个体医疗或营养处方。"}
          </p>
        </div>
        <div className="pp-dark-actions">
          <GlitchButton tone="cream" className="pp-dark-glitch" onClick={() => setPage("coach")}>和健康搭子讨论 <ArrowRight size={16} aria-hidden="true" /></GlitchButton>
          <button type="button" className="pp-cta-ghost" onClick={() => setPage("food")}>回到餐食记录</button>
        </div>
      </section>
    </Reveal>
  );
}

export function DietPlan({ data, loading, profile, hasStored }: { data?: DashboardData; loading: boolean; profile: SpaceProfile; hasStored: boolean }) {
  const planState = useGeneratedPlan(hasStored);
  return (
    <div className="pp-page">
      <PlanHero kind="diet" data={data} plan={planState.plan} hasStored={hasStored} />
      <GeneratedPlanPanel kind="diet" profile={profile} hasStored={hasStored} planState={planState} />
      {!hasStored && <DietTargets data={data} loading={loading} />}
      {planState.plan && <ExampleDivider />}
      <FoodGuide />
      <DietFlex />
      <HonestyPanel generated={Boolean(planState.plan)} hasStored={hasStored} />
    </div>
  );
}

function ExerciseWeek({ today }: { today: number }) {
  return (
    <Reveal>
      <section className="pp-section" aria-labelledby="pp-week-title">
        <SectionHead
          eyebrow="每周节奏"
          title="一周三次，留出恢复的空白。"
        />
        <div className="pp-week-panel">
          <div className="pp-week-rail">
            {weekPlan.map((day, index) => (
              <div key={day.label} className={`pp-week-cell ${day.tone === "session" ? "has-session" : "rest"} ${index === today ? "is-today" : ""}`}>
                <div className="pp-week-day">
                  {day.label}
                  {index === today && <span className="pp-week-today-flag">今天</span>}
                </div>
                <div className="pp-week-title">{day.title}</div>
                <div className="pp-week-minutes">{day.minutes > 0 ? `${day.minutes} 分钟` : "—"}</div>
              </div>
            ))}
          </div>
          <div className="pp-week-foot">
            <span><i className="pp-legend-dot session" />示例活动</span>
            <span><i className="pp-legend-dot rest" />休息或散步</span>
            <span className="pp-week-caption">3 次活动 · 约 70 分钟</span>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

type SessionTone = "strength" | "cardio" | "mobility";

type SessionCard = {
  id: string;
  day: string;
  tag: string;
  title: string;
  subtitle: string;
  minutes: number;
  focus: string;
  tone: SessionTone;
  steps: Array<{ label: string; minutes: number; text: string }>;
  easier: string;
};

const sessionToneMeta = {
  strength: { tag: "力量", subtitle: "力量与核心", easier: "减少一组或降低负重；动作以无痛范围为限。" },
  cardio: { tag: "心肺", subtitle: "心肺与恢复", easier: "改成慢走，或拆成两段各 10 分钟。" },
  mobility: { tag: "活动度", subtitle: "活动度与恢复", easier: "缩短到一个动作做几次就好，幅度以舒适为限。" },
} as const;

function sampleCards(): SessionCard[] {
  return sessions.map((item) => ({
    id: item.id,
    day: item.day,
    tag: "示例",
    title: item.title,
    subtitle: item.subtitle,
    minutes: item.minutes,
    tone: item.tone,
    focus: item.focus,
    steps: item.steps.map((step) => ({ ...step })),
    easier: item.easier,
  }));
}

function planCards(plan: PlanDocument): SessionCard[] {
  return plan.movement.sessions.map((session) => {
    const meta = sessionToneMeta[session.tone];
    const warm = Math.max(3, Math.round(session.minutes * 0.2));
    const cool = Math.max(3, Math.round(session.minutes * 0.2));
    const main = Math.max(1, session.minutes - warm - cool);
    const mainText = session.tone === "cardio"
      ? `按计划保持：${session.focus}；以能说短句的速度为宜。`
      : session.tone === "mobility"
        ? `依次完成：${session.focus}；动作放慢，不做弹振。`
        : `按计划重点完成：${session.focus}；组间休息 45 秒，按状态增减组数。`;
    return {
      id: `${session.day}-${session.title}`,
      day: session.day,
      tag: "计划",
      title: session.title,
      subtitle: meta.subtitle,
      minutes: session.minutes,
      tone: session.tone,
      focus: session.focus,
      steps: [
        { label: "热身", minutes: warm, text: "原地走、踝关节绕环，让身体微微发热。" },
        { label: "主训练", minutes: main, text: mainText },
        { label: "收尾", minutes: cool, text: "拉伸主要发力的部位，呼吸放慢。" },
      ],
      easier: meta.easier,
    };
  });
}

function SessionDeck({ plan }: { plan: PlanDocument | null }) {
  const usingPlan = Boolean(plan && plan.movement.sessions.length > 0);
  const cards = React.useMemo(() => (usingPlan && plan ? planCards(plan) : sampleCards()), [usingPlan, plan]);
  const [active, setActive] = React.useState(0);
  const tabsRef = React.useRef<Array<HTMLButtonElement | null>>([]);
  const reduce = useReducedMotion();
  const index = Math.min(active, cards.length - 1);
  const session = cards[index];
  const minutes = [...new Set(cards.map((card) => card.minutes))];
  const title = usingPlan
    ? minutes.length === 1 ? `一次 ${minutes[0]} 分钟，怎么排。` : "一次训练，怎么排。"
    : "一次 25 分钟，怎么排。";

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const next = (index + direction + cards.length) % cards.length;
    setActive(next);
    tabsRef.current[next]?.focus();
  }

  return (
    <Reveal>
      <section className="pp-section" aria-labelledby="pp-session-title">
        <SectionHead
          eyebrow="一次训练"
          title={title}
        />
        <div className="pp-deck">
          <div className="pp-deck-tabs" role="tablist" aria-label={usingPlan ? "当前计划的训练课" : "示例训练课"} aria-orientation="vertical" onKeyDown={onKeyDown}>
            {cards.map((item, itemIndex) => (
              <button
                type="button"
                key={item.id}
                ref={(element) => { tabsRef.current[itemIndex] = element; }}
                role="tab"
                id={`pp-session-tab-${itemIndex}`}
                aria-selected={itemIndex === index}
                aria-controls={`pp-session-panel-${itemIndex}`}
                tabIndex={itemIndex === index ? 0 : -1}
                className={`pp-session-tab ${itemIndex === index ? "active" : ""}`}
                onClick={() => setActive(itemIndex)}
              >
                {itemIndex === index && (
                  <motion.span
                    layoutId="pp-session-glider"
                    className={`pp-session-glider tone-${item.tone}`}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 26, mass: 0.9 }}
                    aria-hidden="true"
                  />
                )}
                <span className="pp-session-tab-inner">
                  <span className="pp-session-day">{item.day} · {item.tag}</span>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle} · {item.minutes} 分钟</small>
                </span>
              </button>
            ))}
          </div>
          <div
            className="pp-session-panel"
            role="tabpanel"
            id={`pp-session-panel-${index}`}
            aria-labelledby={`pp-session-tab-${index}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={session.id}
                initial={reduce ? false : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 1 } : { opacity: 0, x: -8 }}
                transition={{ duration: reduce ? 0 : 0.28, ease }}
              >
                <div className="pp-session-head">
                  <div>
                    <h3>{session.title}<small>{session.subtitle}</small></h3>
                  </div>
                  <span className="pp-session-time"><Timer size={13} aria-hidden="true" />约 {session.minutes} 分钟</span>
                </div>
                <p className="pp-session-focus">{session.focus}</p>
                <ol className="pp-steps">
                  {session.steps.map((step, stepIndex) => (
                    <li key={step.label}>
                      <span className="pp-step-num" aria-hidden="true">{String(stepIndex + 1).padStart(2, "0")}</span>
                      <div><strong>{step.label} · {step.minutes} 分钟</strong><p>{step.text}</p></div>
                    </li>
                  ))}
                </ol>
                <div className="pp-easier"><Wind size={15} aria-hidden="true" /><p><strong>状态一般时</strong>{session.easier}</p></div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function IntensityMeter() {
  const [level, setLevel] = React.useState(1);
  const reduce = useReducedMotion();

  return (
    <Reveal>
      <section className="pp-section" aria-labelledby="pp-intensity-title">
        <SectionHead
          eyebrow="强度感受"
          title="强度，用说话测试来定。"
        />
        <div className="pp-intensity">
          <div className="pp-intensity-scale" role="group" aria-label="选择强度感受示例">
            {intensityLevels.map((item, index) => (
              <button
                type="button"
                key={item.label}
                className={`pp-intensity-btn ${index === level ? "active" : ""}`}
                aria-pressed={index === level}
                onClick={() => setLevel(index)}
              >
                {index === level && (
                  <motion.span
                    layoutId="pp-intensity-pill"
                    className="pp-intensity-pill"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                    aria-hidden="true"
                  />
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="pp-intensity-copy" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={level}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 1 } : { opacity: 0, y: -5 }}
                transition={{ duration: reduce ? 0 : 0.22, ease }}
              >
                <strong>{intensityLevels[level].short}</strong>
                <p>{intensityLevels[level].copy}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="pp-intensity-note"><Info size={13} aria-hidden="true" /> 有心肺疾病、正在康复或孕期，请先遵医嘱；这里的强度只是日常参考。</p>
        </div>
      </section>
    </Reveal>
  );
}

function ExerciseLife() {
  return (
    <Reveal>
      <section className="pp-section" aria-labelledby="pp-life-title">
        <SectionHead
          eyebrow="真实生活"
          title="让计划，跟得上真实生活。"
        />
        <div className="pp-life-grid">
          {exerciseNotes.map(({ icon: Icon, title, copy }) => (
            <article className="pp-life-card" key={title}>
              <span className="pp-flex-icon"><Icon size={17} aria-hidden="true" /></span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

function SafetyPanel() {
  const setPage = useHealthStore((state) => state.setPage);
  return (
    <Reveal>
      <section className="pp-dark pp-safety" aria-labelledby="pp-safety-title">
        <div className="pp-dark-copy">
          <div className="pp-sec-eyebrow">安全边界</div>
          <h2 id="pp-safety-title">先听身体的，再听计划的。</h2>
          <div className="pp-safety-list">
            <div className="pp-safety-item">
              <HeartPulse size={15} aria-hidden="true" />
              <div><strong>立即停下</strong><p>胸痛、眩晕、异常气促或心悸时，停止活动，必要时就医。</p></div>
            </div>
            <div className="pp-safety-item">
              <ShieldCheck size={15} aria-hidden="true" />
              <div><strong>先问专业人士</strong><p>伤病恢复期、孕期、慢性病或正在调整用药，先咨询医生或康复师。</p></div>
            </div>
          </div>
        </div>
        <div className="pp-dark-actions">
          <GlitchButton tone="cream" className="pp-dark-glitch" onClick={() => setPage("coach")}>和健康搭子聊聊 <ArrowRight size={16} aria-hidden="true" /></GlitchButton>
        </div>
      </section>
    </Reveal>
  );
}

export function ExercisePlan({ data, profile, hasStored }: { data?: DashboardData; loading?: boolean; profile: SpaceProfile; hasStored: boolean }) {
  const [today, setToday] = React.useState(-1);
  const planState = useGeneratedPlan(hasStored);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setToday(shanghaiWeekdayIndex()));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="pp-page">
      <PlanHero kind="exercise" data={data} plan={planState.plan} hasStored={hasStored} />
      <GeneratedPlanPanel kind="exercise" profile={profile} hasStored={hasStored} planState={planState} />
      {hasStored && !planState.plan && <ExerciseWeek today={today} />}
      {planState.plan
        ? planState.plan.movement.sessions.length > 0 && <SessionDeck plan={planState.plan} />
        : hasStored && <SessionDeck plan={null} />}
      <IntensityMeter />
      <ExerciseLife />
      <SafetyPanel />
      <p className="pp-endnote">
        <Leaf size={12} aria-hidden="true" /> 智养 AI · {planState.plan ? `${planState.activeVersion === planState.plan.version ? "计划已启用" : "建议版本待启用"} v${planState.plan.version} + 通用建议` : hasStored ? "资料已保存 · 示例结构" : "尚未生成计划"} · 今天做到一点点，就已经在往前。
      </p>
    </div>
  );
}
