"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChartNoAxesCombined, ChevronRight, Droplets, Dumbbell, LayoutDashboard, Leaf, Loader2, Maximize2, MessageCircle, Mic, Minimize2, Plus, Salad, Square, Trash2, UserRound, Utensils, Volume2, X } from "lucide-react";
import { AccountPanel } from "@/components/account-panel";
import { AuthCheckingScreen, AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import Hero38 from "@/components/originkit/hero-38";
import { LandingSections, MochiFigure } from "@/components/landing/landing-sections";
import { DashboardHero } from "@/components/dashboard-hero";
import { BackToTop, FloatingCompanion, GrowingLoader, HamsterLoader, HealthTipsCarousel, ScrollProgress } from "@/components/experience";
import { MealRecorder } from "@/components/meal-recorder";
import { MySpace } from "@/components/my-space";
import { DietPlan, ExercisePlan, PlanSwitcher } from "@/components/plan-experience";
import { SpaceCard } from "@/components/space-card";
import { WeightRecordForm } from "@/components/weight-record-form";
import { WeightReviewSection } from "@/components/weight-review";
import { WeightTrendChart, WeightValue } from "@/components/weight-trend-chart";
import { ReviewFluidTitle } from "@/components/review-fluid-title";
import { formatWeightChange, getDashboard, type DashboardData, type WeekSummary } from "@/lib/dashboard";
import { isAuthError } from "@/lib/api-error";
import { fetchProfile } from "@/lib/profile-client";
import { createEmptySpaceProfile, type SpaceProfile } from "@/lib/space";
import { loadWaterLog, recordWater, waterTodayKey } from "@/lib/water-log";
import { useHealthStore, type Page } from "@/stores/health-store";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const authAwareRetry = (failureCount: number, error: unknown) => !isAuthError(error) && failureCount < 2;

const navigation = [
  { id: "dashboard", label: "今日概览", short: "今天", icon: LayoutDashboard },
  { id: "profile", label: "我的空间", short: "我的", icon: UserRound },
  { id: "food", label: "餐食记录", short: "记录", icon: Utensils },
  { id: "plans", label: "饮食计划", short: "计划", icon: Salad },
  { id: "exercise", label: "运动计划", short: "运动", icon: Dumbbell, mobileHidden: true },
  { id: "coach", label: "AI 健康助手", short: "助手", icon: MessageCircle },
  { id: "review", label: "每周复盘", short: "复盘", icon: ChartNoAxesCombined },
] as const;

const REVIEW_TITLE_IMAGES: [string, string] = [
  "/images/review/review-heading-mountain.webp",
  "/images/hero/zhiyang-hero-meadow.webp",
];

const REVIEW_FRAME_VEGGIES = [
  "/images/review/review-veggie-broccoli.webp",
  "/images/review/review-veggie-banana.webp",
  "/images/review/review-veggie-cabbage.webp",
  "/images/review/review-veggie-pepper.webp",
  "/images/review/review-veggie-kiwi.webp",
  "/images/review/review-veggie-grape.webp",
  "/images/review/review-veggie-carrot.webp",
];

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="section-title"><h2>{title}</h2>{action}</div>;
}

function DemoNotice({ notice }: { notice?: string }) {
  return (
    <div className="demo-banner" role="note">
      <span className="demo-badge">演示沙盒</span>
      <p>数据仅存当前浏览器，请勿填写真实健康信息；登录后切换到账户数据。{notice ? ` ${notice}` : ""}</p>
    </div>
  );
}

function Dashboard({ identityKey }: { identityKey: string }) {
  const setPage = useHealthStore((state) => state.setPage);
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, retry: authAwareRetry });
  const [trainingStarted, setTrainingStarted] = React.useState(false);
  const [waterLog, setWaterLog] = React.useState<Record<string, number>>(() => loadWaterLog(identityKey));
  const waterAdded = waterLog[waterTodayKey()] ?? 0;

  const addCup = () => setWaterLog(recordWater(identityKey, 250));

  if (isPending) return <GrowingLoader label="正在整理今天的健康记录…" />;
  if (isError || !data) return <div className="empty-note" role="alert">暂时无法载入今日数据。{error instanceof Error ? ` ${error.message}` : ""} <button className="link-button" onClick={() => void refetch()}>重试</button></div>;

  const percent = data.calorieGoal && data.calorieGoal > 0 ? Math.round((data.calories / data.calorieGoal) * 100) : 0;
  const water = data.waterMl + waterAdded;
  const waterPercent = data.waterGoal > 0 ? Math.min(100, (water / data.waterGoal) * 100) : 0;
  const revealHydration = () => {
    const target = document.getElementById("hydration-card");
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    target.focus({ preventScroll: true });
  };

  return <div className="app-content">
    <DashboardHero
      data={data}
      water={water}
      waterLog={waterLog}
      percent={percent}
      onRecord={() => setPage("food")}
      onProfile={() => setPage("profile")}
      onNavigate={setPage}
      onHydration={revealHydration}
    />

    {data.demo && <DemoNotice notice={data.notice} />}

    <div className="dashboard-grid">
      <motion.div
        className="left-stack"
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="dashboard-pair">
          <section className="surface training-card">
            <SectionTitle title="今天的身体时间" action={<button onClick={() => setPage("exercise")}>查看运动计划 <ChevronRight size={13} /></button>} />
            {data.workout ? (
              <>
                <div className="training-content">
                  <div className="training-icon"><Dumbbell size={21} /></div>
                  <div className="training-info"><strong>{data.workout.title}</strong><p>{data.workout.exercises.join("、")}</p></div>
                  <span className="training-time">约 {data.workout.durationMinutes} 分钟</span>
                </div>
                <div className="training-bottom">
                  <span>{trainingStarted ? "已开始 · 按自己的状态调整强度" : "强度：轻松 · 可在家完成"}</span>
                  {trainingStarted
                    ? <Button variant="secondary" onClick={() => setTrainingStarted(false)}>结束训练</Button>
                    : <Button onClick={() => setTrainingStarted(true)}>开始训练</Button>}
                </div>
                {trainingStarted && <p className="training-note" role="status">这里只做计划提醒，不记录心率或动作数据；身体不适请立即停止。</p>}
              </>
            ) : (
              <div className="card-empty">
                <div className="training-icon"><Dumbbell size={21} /></div>
                <div><strong>今天还没有训练安排</strong><p>训练计划还没有接入个人记录，先按自己的节奏活动。</p></div>
              </div>
            )}
          </section>

          <section className="surface hydration-card" id="hydration-card" tabIndex={-1} aria-labelledby="hydration-title">
            <div className="section-title"><h2 id="hydration-title">喝水也算照顾自己</h2><span className="goal-tag">{water.toLocaleString("zh-CN")} / {data.waterGoal.toLocaleString("zh-CN")} ml</span></div>
            <div className="hydration-row">
              <span className="water-icon"><Droplets size={20} /></span>
              <div className="water-detail"><strong>每一杯都算数</strong><small>{waterAdded > 0 ? `今天已加 ${waterAdded} ml` : "今天已记录"}</small></div>
              <button className="water-add" onClick={addCup} aria-label="记录一杯水，250 毫升">+</button>
            </div>
            <div className="water-progress"><span style={{ width: `${waterPercent}%` }} /></div>
            <p className="water-note">{data.demo ? "演示数据 · 记录保存在当前浏览器" : "仅保存在当前浏览器"}</p>
          </section>
        </div>

        <HealthTipsCarousel />
      </motion.div>

      <motion.div
        className="right-stack"
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="surface quick-card">
          <SectionTitle title="记录今天的一点点" action={<button onClick={() => setPage("food")}>全部记录 <ChevronRight size={13} /></button>} />
          <div className="quick-actions">
            <button className="quick-action" onClick={() => setPage("food")}><span className="quick-icon"><Camera size={16} /></span>拍照记一餐</button>
            <button className="quick-action" onClick={() => setPage("food")}><span className="quick-icon"><Plus size={16} /></span>手动记一餐</button>
            <button className="quick-action" onClick={() => setPage("review")}><span className="quick-icon"><ChartNoAxesCombined size={16} /></span>看看本周复盘</button>
          </div>
        </section>

        <section className="assistant-card">
          <div className="assistant-head"><span className="assistant-spark"><Leaf size={17} /></span><strong>你的健康搭子</strong><small>日常建议</small></div>
          <div className="suggestions">
            <button className="suggestion" onClick={() => setPage("coach")}>晚餐怎么吃？</button>
            <button className="suggestion" onClick={() => setPage("coach")}>今天怎么练？</button>
          </div>
          <Button className="mt-4 w-full" onClick={() => setPage("coach")}>问问健康搭子 <ChevronRight size={15} /></Button>
        </section>

        <section className="surface weight-card">
          <SectionTitle title="体重趋势" action={<button onClick={() => setPage("review")}>看复盘 <ChevronRight size={13} /></button>} />
          {data.weightKg === null ? (
            <div className="card-empty compact">
              <div><strong>还没有体重记录</strong><p>记下第一笔，趋势会从这里长出来。</p></div>
            </div>
          ) : (
            <>
              <div className="weight-main"><strong><WeightValue value={data.weightKg} /></strong><span>kg</span><span className="weight-change">{formatWeightChange(data.weightChangeKg)}</span></div>
              <WeightTrendChart points={data.weightSeries} variant="card" />
              {data.weightSeries.some((point) => point.source === "profile") && <p className="chart-note">资料体重作为趋势起点。</p>}
              {data.demo && <p className="chart-note">演示沙盒数据，仅存当前浏览器。</p>}
            </>
          )}
          <WeightRecordForm latestKg={data.weightKg} />
        </section>
      </motion.div>
    </div>
  </div>;
}

function WeekTrail({ week }: { week: WeekSummary }) {
  if (!week.days?.length) return null;
  const first = week.days[0];
  const last = week.days[week.days.length - 1];
  return (
    <section className="review-trail" aria-labelledby="review-trail-title">
      <div className="review-trail-head">
        <div>
          <span className="review-trail-tag">本周七帧</span>
          <h2 id="review-trail-title">一天一帧，按记录往前走。</h2>
        </div>
        <span className="review-trail-range">{first.dateLabel} — {last.dateLabel}</span>
      </div>
      <div className="review-trail-track" role="list">
        {week.days.map((day, index) => {
          const recorded = day.meals > 0;
          const state = day.isFuture ? "future" : recorded ? "recorded" : "blank";
          const summary = day.isFuture
            ? "还没到"
            : recorded
              ? `${day.meals} 餐，约 ${day.calories.toLocaleString("zh-CN")} 千卡`
              : "没有记录";
          return (
            <article
              key={day.key}
              role="listitem"
              className={`review-frame is-${state}${day.isToday ? " is-today" : ""}`}
              style={{
                "--frame-index": index,
                "--frame-tilt": `${((index % 3) - 1) * 0.8}deg`,
                "--frame-lift": `${index % 2 === 0 ? 0 : 5}px`,
              } as React.CSSProperties}
              aria-label={`${day.label} ${day.dateLabel}，${summary}${day.workoutMinutes === null ? "" : `，训练 ${day.workoutMinutes} 分钟`}`}
            >
              <header className="review-frame-head">
                <span>{day.label}</span>
                <small>{day.isToday ? "今天" : day.dateLabel}</small>
              </header>
              <span className="review-frame-orb" aria-hidden="true">
                <img
                  className="review-frame-veggie"
                  src={REVIEW_FRAME_VEGGIES[index % REVIEW_FRAME_VEGGIES.length]}
                  alt=""
                  loading="lazy"
                  draggable={false}
                />
              </span>
              <div className="review-frame-body">
                <strong>{day.isFuture ? "未到" : recorded ? `${day.meals} 餐` : "未记录"}</strong>
                <small>{day.isFuture ? "还在路上" : recorded ? `${day.calories.toLocaleString("zh-CN")} kcal` : "保持空白"}</small>
              </div>
              {day.workoutMinutes !== null && <span className="review-frame-stamp">训练 {day.workoutMinutes} 分钟</span>}
            </article>
          );
        })}
      </div>
      <p className="review-trail-note">
        {week.workouts === null
          ? "训练记录尚未接入，本次复盘按饮食与体重记录呈现。"
          : "只按已有记录呈现。"}
      </p>
    </section>
  );
}

function ReviewPanel({ data, loading }: { data?: DashboardData; loading: boolean }) {
  if (loading) return <GrowingLoader label="正在整理本周记录…" />;
  if (!data) return <div className="empty-note" role="alert">暂时无法载入复盘数据。</div>;
  const { week } = data;
  return <>
    <WeekTrail week={week} />
    <WeightReviewSection />
    <div className="review-layout">
      <section className="surface review-score">
        <SectionTitle title="本周执行情况" action={<span className="goal-tag">只按已有记录</span>} />
        <div className="review-stat-grid">
          <div className="review-stat"><small>有记录的天数</small><strong>{week.recordedDays}<span>/ 7 天</span></strong></div>
          <div className="review-stat"><small>饮食记录</small><strong>{week.meals}<span>餐</span></strong></div>
          <div className="review-stat"><small>训练次数</small><strong>{week.workouts === null ? "未接入" : `${week.workouts} 次`}</strong></div>
          <div className="review-stat"><small>体重记录</small><strong>{week.weightEntries === null ? "未接入" : `${week.weightEntries} 次`}</strong></div>
        </div>
        <p className="review-note">{week.note}</p>
        {data.demo && <p className="chart-note">以上为演示数据，仅用于展示复盘结构。</p>}
      </section>
      <section className="assistant-card">
        <div className="assistant-head"><span className="assistant-spark"><Leaf size={17} /></span><strong>下周想调整什么？</strong><small>一起商量</small></div>
        <p>记录少的时候，先看看发生了什么，不急着改目标。</p>
        <Button className="mt-2 w-full" variant="secondary" onClick={() => useHealthStore.getState().setPage("coach")}>去聊聊 <ChevronRight size={15} /></Button>
      </section>
    </div>
  </>;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
  retry?: string;
  reaction?: ChatReactionId;
};

type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

const chatReactions = [
  { id: "like", label: "喜欢", emoji: "👍" },
  { id: "confused", label: "疑惑", emoji: "🤔" },
  { id: "unsatisfied", label: "不满意", emoji: "👎" },
  { id: "appreciate", label: "欣赏", emoji: "✨" },
  { id: "smile", label: "微笑", emoji: "🙂" },
] as const;

type ChatReactionId = (typeof chatReactions)[number]["id"];

type KnowledgeSource = {
  key: string;
  url: string;
  title: string;
  meta: string;
  index: number;
};

const knownSources = [
  { title: "中国居民膳食指南（2022）", meta: "中国营养学会 · 2022", url: "https://www.quanjiao.gov.cn/public/161055045/1112918720.html" },
  { title: "中国人群身体活动指南（2021）", meta: "国家卫健委专家解读", url: "http://wsjkw.shandong.gov.cn/hdjl/zxft/202201/t20220117_3840701.html" },
  { title: "睡眠健康核心信息及释义", meta: "全国爱卫办 · 2025", url: "https://www.nhc.gov.cn/guihuaxxs/c100133/202503/70d5836afe804a858b899ee951a24a13.shtml" },
  { title: "2025 美国膳食指南咨询委员会报告", meta: "USDA / HHS · 2024", url: "https://www.dietaryguidelines.gov/sites/default/files/2024-12/Part%20D_Ch%202_Dietary%20Patterns_FINAL_508.pdf" },
  { title: "体力活动与焦虑风险", meta: "eClinicalMedicine · 2025", url: "https://doi.org/10.1016/j.eclinm.2025.103285" },
  { title: "体力活动与心血管健康公平", meta: "AHA 科学声明 · 2023", url: "https://doi.org/10.1161/CIR.0000000000001148" },
] as const;

const CHAT_INTRO = "你好，我是你的健康搭子。可以问饮食、训练或记录方法；数字是估算，不适请就医。";
const CHAT_THREADS_KEY = "zhiyang-chat-threads-v1";
const CHAT_THREAD_LIMIT = 30;

function chatThreadsKey(identityKey: string) {
  return identityKey === "pending" ? null : `${CHAT_THREADS_KEY}:${identityKey}`;
}
const EMPTY_CHAT_MESSAGES: ChatMessage[] = [];

function chatMessageId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function chatIntroMessage(): ChatMessage {
  return { id: "intro", role: "assistant", content: CHAT_INTRO };
}

function chatThreadTitle(messages: ChatMessage[]) {
  const first = messages.find((message) => message.role === "user" && message.content.trim());
  if (!first) return "新的对话";
  const text = first.content.replace(/\s+/g, " ").trim();
  return text.length > 22 ? `${text.slice(0, 22)}…` : text;
}

function createChatThread(): ChatThread {
  const now = Date.now();
  return {
    id: chatMessageId("thread"),
    title: "新的对话",
    createdAt: now,
    updatedAt: now,
    messages: [chatIntroMessage()],
  };
}

function loadChatThreads(storageKey: string | null): ChatThread[] {
  if (typeof window === "undefined" || !storageKey) return [createChatThread()];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [createChatThread()];
    const stored = JSON.parse(raw) as unknown;
    if (!Array.isArray(stored)) return [createChatThread()];
    const threads: ChatThread[] = [];
    for (const item of stored) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string" || !Array.isArray(record.messages)) continue;
      const messages: ChatMessage[] = [];
      for (const rawMessage of record.messages) {
        if (!rawMessage || typeof rawMessage !== "object") continue;
        const message = rawMessage as Record<string, unknown>;
        if (typeof message.id !== "string" || typeof message.content !== "string") continue;
        if (message.role !== "user" && message.role !== "assistant") continue;
        if (message.role === "assistant" && !message.content.trim() && message.failed !== true) continue;
        const reaction = typeof message.reaction === "string" && chatReactions.some((entry) => entry.id === message.reaction)
          ? message.reaction as ChatReactionId
          : undefined;
        messages.push({
          id: message.id,
          role: message.role,
          content: message.content,
          ...(message.failed === true ? { failed: true } : {}),
          ...(typeof message.retry === "string" ? { retry: message.retry } : {}),
          ...(reaction ? { reaction } : {}),
        });
      }
      if (!messages.some((message) => message.id === "intro")) messages.unshift(chatIntroMessage());
      threads.push({
        id: record.id,
        title: typeof record.title === "string" && record.title.trim() ? record.title : chatThreadTitle(messages),
        createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
        updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
        messages,
      });
    }
    return threads.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, CHAT_THREAD_LIMIT);
  } catch {
    return [createChatThread()];
  }
}

function formatChatTime(timestamp: number) {
  const date = new Date(timestamp);
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("zh-CN", sameDay
    ? { hour: "2-digit", minute: "2-digit", hour12: false }
    : { month: "numeric", day: "numeric" }).format(date);
}

const urlPattern = /https?:\/\/[^\s<>"'“”‘’）)\]】]+/g;
const sourceLabelPattern = /^(?:[-*•·–—>\s]*)(?:来源|参考来源|参考资料|参考文献|引用来源)[ \t]*[:：]?/;

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "来源链接";
  }
}

function canonicalSourceUrl(value: string) {
  const trimmed = value.replace(/[，。；：！？、,.!?;:）)\]】》"']+$/g, "");
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

function extractSourceUrls(content: string) {
  const urls: string[] = [];
  for (const match of content.matchAll(urlPattern)) {
    const url = canonicalSourceUrl(match[0]);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function sourceTitleFromContent(content: string, url: string) {
  const line = content.split(/\r?\n/).find((item) => extractSourceUrls(item).includes(url)) ?? "";
  const cleaned = line
    .replace(urlPattern, "")
    .replace(/^\s*(?:[-*•·–—]|\d+[.)、])\s*/, "")
    .replace(/(?:参考来源|参考资料|参考文献|引用来源|来源)\s*[:：]?/g, "")
    .replace(/[（(]\s*[)）]/g, "")
    .replace(/[·|,，;；:：\-–—\s]+$/g, "")
    .trim();
  if (cleaned.length >= 3) return cleaned.length > 46 ? `${cleaned.slice(0, 46)}…` : cleaned;
  return sourceHost(url);
}

function splitAnswer(content: string) {
  const urls = extractSourceUrls(content);
  if (!urls.length) return { body: content, urls };
  const lines = content.split(/\r?\n/);
  let start = lines.length;
  let sawUrl = false;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line) {
      start = index;
      continue;
    }
    const hasUrl = extractSourceUrls(line).length > 0;
    if (!hasUrl && !sourceLabelPattern.test(line)) break;
    start = index;
    if (hasUrl) sawUrl = true;
  }
  if (!sawUrl || start >= lines.length || lines.length - start > 12) return { body: content, urls };
  const body = lines.slice(0, start).join("\n").trimEnd();
  if (body.length < 20) return { body: content, urls };
  return { body, urls };
}

type SpeechResultMap = {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: SpeechResultMap }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const emptySpeechSubscribe = () => () => {};
const hasSpeechSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;

function speechErrorMessage(code: string) {
  if (code === "not-allowed" || code === "service-not-allowed") return "浏览器没拿到麦克风权限，允许后再试。";
  if (code === "no-speech") return "没有听到声音，再试一次。";
  if (code === "audio-capture") return "没有找到可用的麦克风。";
  if (code === "network") return "语音识别需要联网，网络恢复后再试。";
  if (code === "aborted") return "";
  return "语音输入没有成功，稍后再试。";
}

function speechChunks(text: string) {
  const sentences = text.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (current && current.length + piece.length > 120) {
      chunks.push(current);
      current = piece;
    } else {
      current += piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function readableText(content: string) {
  return content
    .replace(urlPattern, "")
    .replace(/\[\d{1,2}\]/g, "")
    .replace(/^[ \t]*(?:[-*•·#]+|\d+[.)、])[ \t]*/gm, "")
    .replace(/\*\*|__|`{1,3}/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 4000);
}

function ChatPanel({ identityKey }: { identityKey: string }) {
  const storageKey = chatThreadsKey(identityKey);
  const [threads, setThreads] = React.useState<ChatThread[]>(() => loadChatThreads(storageKey));
  const [activeThreadId, setActiveThreadId] = React.useState(() => threads[0]?.id ?? "");
  const [question, setQuestion] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [reaction, setReaction] = React.useState<ChatReactionId | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches);
  const [expanded, setExpanded] = React.useState(false);
  const speechSupported = React.useSyncExternalStore(emptySpeechSubscribe, () => Boolean(speechRecognitionConstructor()), () => false);
  const ttsSupported = React.useSyncExternalStore(emptySpeechSubscribe, hasSpeechSynthesis, () => false);
  const [listening, setListening] = React.useState(false);
  const [voiceHint, setVoiceHint] = React.useState("");
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseRef = React.useRef("");
  const voiceHintTimerRef = React.useRef<number | null>(null);
  const speechRunRef = React.useRef(0);
  const spokenRef = React.useRef<SpeechSynthesisUtterance[]>([]);

  const orderedThreads = React.useMemo(() => [...threads].sort((a, b) => b.updatedAt - a.updatedAt), [threads]);
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null;
  const messages = activeThread?.messages ?? EMPTY_CHAT_MESSAGES;

  React.useEffect(() => {
    if (!storageKey) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(threads));
      } catch {
        // 存储不可用或已满时，当前会话仍可继续使用。
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [threads, storageKey]);

  React.useEffect(() => {
    if (messages.length < 2) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: expanded ? "auto" : "smooth" });
  }, [messages, expanded]);

  React.useEffect(() => () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (voiceHintTimerRef.current) window.clearTimeout(voiceHintTimerRef.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  React.useEffect(() => {
    if (!expanded) return;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  const sources = React.useMemo(() => {
    const entries = new Map<string, Omit<KnowledgeSource, "index">>();
    const order: string[] = [];
    for (const message of messages) {
      if (message.role !== "assistant" || message.failed || message.id === "intro") continue;
      for (const key of extractSourceUrls(message.content)) {
        if (entries.has(key)) continue;
        const known = knownSources.find((source) => canonicalSourceUrl(source.url) === key);
        entries.set(key, {
          key,
          url: known?.url ?? key,
          title: known?.title ?? sourceTitleFromContent(message.content, key),
          meta: known?.meta ?? sourceHost(key),
        });
        order.push(key);
      }
    }
    return order.map((key, position) => ({ ...entries.get(key)!, index: position + 1 }));
  }, [messages]);

  function citationsFor(content: string) {
    return extractSourceUrls(content)
      .map((url) => sources.find((source) => source.key === url))
      .filter((source): source is KnowledgeSource => Boolean(source));
  }

  function showVoiceHint(message: string) {
    if (!message) return;
    setVoiceHint(message);
    if (voiceHintTimerRef.current) window.clearTimeout(voiceHintTimerRef.current);
    voiceHintTimerRef.current = window.setTimeout(() => setVoiceHint(""), 4200);
  }

  function stopListening() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setListening(false);
    recognition?.abort();
  }

  function toggleListening() {
    if (!canChat || pending) return;
    if (listening) {
      stopListening();
      return;
    }
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      showVoiceHint("当前浏览器不支持语音输入，用键盘输入就可以。");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    voiceBaseRef.current = question.trim() ? `${question.trim()} ` : "";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      setQuestion(`${voiceBaseRef.current}${transcript}`.slice(0, 1000));
    };
    recognition.onerror = (event) => {
      showVoiceHint(speechErrorMessage(event.error));
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setVoiceHint("");
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      showVoiceHint("语音输入没能启动，稍后再试。");
    }
  }

  function stopSpeaking() {
    speechRunRef.current += 1;
    spokenRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }

  function toggleSpeak(message: ChatMessage) {
    if (!ttsSupported) return;
    if (speakingId === message.id) {
      stopSpeaking();
      return;
    }
    const text = readableText(splitAnswer(message.content).body);
    if (!text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const run = speechRunRef.current + 1;
    speechRunRef.current = run;
    const chunks = speechChunks(text);
    const preferred = synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("zh"));
    const utterances = chunks.map((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "zh-CN";
      utterance.rate = 1.02;
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => {
        if (speechRunRef.current === run && index === chunks.length - 1) setSpeakingId(null);
      };
      utterance.onerror = () => {
        if (speechRunRef.current === run && index === chunks.length - 1) setSpeakingId(null);
      };
      return utterance;
    });
    spokenRef.current = utterances;
    setSpeakingId(message.id);
    for (const utterance of utterances) synth.speak(utterance);
  }

  async function send(value: string, options: { appendUser?: boolean; reaction?: ChatReactionId } = {}) {
    const { appendUser = true, reaction: reactionId } = options;
    const text = value.trim();
    if (!activeThread || pending || (!text && !reactionId)) return;
    stopSpeaking();
    stopListening();
    const threadId = activeThread.id;
    const history = messages
      .filter((message) => message.id !== "intro" && !message.failed && message.content.trim())
      .map(({ role, content }) => ({ role, content }))
      .slice(-12);
    if (reactionId && !history.some((message) => message.role === "assistant")) return;
    if (appendUser) {
      history.push({ role: "user", content: text });
      setReaction(null);
    }
    const userMessage: ChatMessage | null = appendUser
      ? { id: chatMessageId("user"), role: "user", content: text }
      : null;
    const assistantId = chatMessageId("assistant");
    setThreads((current) => current.map((thread) => {
      if (thread.id !== threadId) return thread;
      const nextMessages: ChatMessage[] = [
        ...thread.messages,
        ...(userMessage ? [userMessage] : []),
        { id: assistantId, role: "assistant", content: "" },
      ];
      return {
        ...thread,
        messages: nextMessages,
        title: thread.title === "新的对话" ? chatThreadTitle(nextMessages) : thread.title,
        updatedAt: Date.now(),
      };
    }));
    setQuestion("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, ...(reactionId ? { reaction: reactionId } : {}) }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        const message = response.status === 401
          ? "AI 对话当前未对该环境开放。需要部署方配置模型服务与访问控制后才能使用。"
          : data?.message ?? "健康助手服务暂不可用，请稍后重试。";
        throw new Error(message);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取助手回复，请重试。");
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        // eslint-disable-next-line react-hooks/immutability -- accumulate the streamed response locally
        answer += decoder.decode(chunk, { stream: true });
        setThreads((current) => current.map((thread) => thread.id === threadId
          ? { ...thread, messages: thread.messages.map((message) => message.id === assistantId ? { ...message, content: answer } : message) }
          : thread));
      }
      if (!answer.trim()) throw new Error("这次没有收到回答，请再试一次。");
      setThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, updatedAt: Date.now() } : thread));
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败，请稍后重试。";
      setThreads((current) => current.map((thread) => thread.id === threadId
        ? {
            ...thread,
            updatedAt: Date.now(),
            messages: thread.messages.map((item) => item.id === assistantId
              ? { ...item, content: message, failed: true, retry: text, reaction: reactionId }
              : item),
          }
        : thread));
    } finally {
      setPending(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(question);
  }

  function react(id: ChatReactionId) {
    if (pending) return;
    if (reaction === id) {
      setReaction(null);
      return;
    }
    setReaction(id);
    void send("", { appendUser: false, reaction: id });
  }

  function startNewChat() {
    if (pending) return;
    stopSpeaking();
    stopListening();
    const thread = createChatThread();
    setThreads((current) => [thread, ...current].slice(0, CHAT_THREAD_LIMIT));
    setActiveThreadId(thread.id);
    setQuestion("");
    setReaction(null);
    setHistoryOpen(false);
  }

  function selectThread(id: string) {
    if (id !== activeThread?.id) {
      stopSpeaking();
      stopListening();
      setActiveThreadId(id);
      setQuestion("");
      setReaction(null);
    }
    setHistoryOpen(false);
  }

  function deleteThread(id: string) {
    if (pending) return;
    if (id === activeThread?.id) {
      stopSpeaking();
      stopListening();
    }
    const remaining = orderedThreads.filter((thread) => thread.id !== id);
    setThreads((current) => current.filter((thread) => thread.id !== id));
    if (id === activeThread?.id) {
      setActiveThreadId(remaining[0]?.id ?? "");
      setQuestion("");
      setReaction(null);
    }
  }

  const hasUserMessage = messages.some((message) => message.role === "user");
  const hasAnswer = messages.some((message) => message.id !== "intro" && message.role === "assistant" && !message.failed && message.content.trim());
  const streamingMessageId = pending ? messages[messages.length - 1]?.id ?? null : null;
  const canChat = Boolean(activeThread);
  const suggestions = ["晚餐怎么搭配更合适？", "今天适合做什么训练？", "怎么记录才算准确？"];
  const activeReaction = chatReactions.find((item) => item.id === reaction);

  const layout = <div className={`coach-layout${expanded ? " is-expanded" : ""}`}>
    <section className="surface chat-panel">
      <span className="chat-flag" aria-hidden="true">AI 健康搭子</span>
      <div className="chat-shell">
        <aside id="chat-history" className={`chat-history${historyOpen ? " is-open" : ""}`} aria-label="对话记录">
          <div className="chat-history-head">
            <span className="chat-history-title"><MessageCircle size={12} aria-hidden="true" /> 对话记录</span>
            <span className="chat-history-count">{threads.length}</span>
            <button type="button" className="chat-history-close" aria-label="收起对话记录" onClick={() => setHistoryOpen(false)}><X size={13} /></button>
          </div>
          <button type="button" className="chat-new" onClick={startNewChat} disabled={pending}>
            <Plus size={12} aria-hidden="true" /> 新建对话
          </button>
          <div className="chat-thread-list">
            {orderedThreads.map((thread) => (
              <div className={`chat-thread${thread.id === activeThread?.id ? " is-active" : ""}`} key={thread.id}>
                <button
                  type="button"
                  className="chat-thread-main"
                  onClick={() => selectThread(thread.id)}
                  aria-current={thread.id === activeThread?.id ? "true" : undefined}
                  title={thread.title}
                >
                  <span className="chat-thread-title">{thread.title}</span>
                  <span className="chat-thread-time">{formatChatTime(thread.updatedAt)}</span>
                </button>
                <button
                  type="button"
                  className="chat-thread-delete"
                  aria-label={`删除对话：${thread.title}`}
                  title="删除对话"
                  onClick={() => deleteThread(thread.id)}
                  disabled={pending}
                >
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <p className="chat-history-note">对话按账号保存在本机浏览器，清除站点数据后消失。</p>
        </aside>
        <div className="chat-main">
          <div className="chat-head">
            <span className="coach-avatar"><img src="/brand/cochi-avatar.png" alt="" /></span>
            <div className="chat-head-copy"><strong>你的健康搭子</strong><small>基于个人计划提供日常建议</small></div>
            <button
              type="button"
              className="chat-history-toggle"
              aria-expanded={historyOpen}
              aria-controls="chat-history"
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <MessageCircle size={11} aria-hidden="true" />
              <span>{threads.length} 条对话</span>
            </button>
            <button
              type="button"
              className="chat-expand"
              aria-label={expanded ? "退出全屏" : "全屏聊天"}
              aria-pressed={expanded}
              title={expanded ? "退出全屏" : "全屏聊天"}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? <Minimize2 size={13} aria-hidden="true" /> : <Maximize2 size={13} aria-hidden="true" />}
            </button>
          </div>
          <div className={`chat-messages${activeThread ? "" : " is-empty"}`} ref={scrollRef} aria-live="polite" aria-busy={pending}>
            {!activeThread && (
              <div className="chat-empty">
                <span className="chat-empty-icon" aria-hidden="true"><MessageCircle size={20} /></span>
                <strong>还没有对话</strong>
                <p>新建一个对话，问问饮食、训练或记录上的问题。</p>
                <button type="button" className="chat-empty-new" onClick={startNewChat}>
                  <Plus size={12} aria-hidden="true" /> 新建对话
                </button>
              </div>
            )}
            {activeThread && messages.map((message) => {
              const parsed = message.role === "assistant" && !message.failed ? splitAnswer(message.content) : { body: message.content, urls: [] as string[] };
              const citations = message.role === "assistant" && !message.failed ? citationsFor(message.content) : [];
              return (
                <div className={`message ${message.role === "user" ? "user" : "bot"}${message.failed ? " failed" : ""}`} key={message.id}>
                  {parsed.body || (pending ? <HamsterLoader size="mini" label="正在思考…" /> : null)}
                  {citations.length > 0 && (
                    <div className="message-sources" aria-label="本条回答引用的来源">
                      {citations.map((source) => (
                        <a className="message-source" href={source.url} target="_blank" rel="noreferrer" key={source.key} title={source.title}>
                          <b aria-hidden="true">{source.index}</b>
                          <span>{source.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {ttsSupported && message.role === "assistant" && !message.failed && message.content.trim() && message.id !== streamingMessageId && (
                    <button
                      type="button"
                      className={`message-speak${speakingId === message.id ? " is-speaking" : ""}`}
                      aria-label={speakingId === message.id ? "停止朗读这条回答" : "朗读这条回答"}
                      aria-pressed={speakingId === message.id}
                      onClick={() => toggleSpeak(message)}
                    >
                      {speakingId === message.id ? <Square size={9} aria-hidden="true" /> : <Volume2 size={11} aria-hidden="true" />}
                      <span>{speakingId === message.id ? "停止" : "朗读"}</span>
                    </button>
                  )}
                  {message.failed && (message.retry || message.reaction) && (
                    <button type="button" className="chat-retry" onClick={() => void send(message.retry ?? "", { appendUser: false, reaction: message.reaction })} disabled={pending}>重新发送</button>
                  )}
                </div>
              );
            })}
            {activeThread && <cite className="chat-cite">健康建议仅供日常参考，不替代医生诊断或治疗。</cite>}
          </div>
          {activeThread && !hasUserMessage && (
            <div className="chat-suggestions">
              {suggestions.map((item) => <button type="button" className="suggestion" key={item} onClick={() => void send(item)} disabled={pending}>{item}</button>)}
            </div>
          )}
          <div className="chat-reactions">
            <span className="chat-reactions-label" aria-live="polite">{activeReaction ? `已选：${activeReaction.label}` : "快捷评价"}</span>
            <div className="chat-reaction-list" role="group" aria-label="快捷评价">
              {chatReactions.map(({ id, label, emoji }) => (
                <button
                  type="button"
                  key={id}
                  className={`chat-reaction${reaction === id ? " is-selected" : ""}`}
                  aria-label={label}
                  aria-pressed={reaction === id}
                  disabled={!hasAnswer || pending}
                  onClick={() => react(id)}
                >
                  <span className="chat-reaction-emoji" aria-hidden="true">{emoji}</span>
                  <span className="chat-reaction-tip" aria-hidden="true">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <form className="chat-input" onSubmit={submit}>
            <span className="chat-input-tag" aria-hidden="true">你的问题 →</span>
            {voiceHint && <span className="chat-voice-hint" role="status">{voiceHint}</span>}
            <label className="sr-only" htmlFor="coach-question">输入你的问题</label>
            <input id="coach-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={listening ? "正在听，请说话…" : canChat ? "问问你的健康搭子…" : "先新建一个对话"} maxLength={1000} disabled={!canChat} />
            {speechSupported && (
              <button
                type="button"
                className={`chat-mic${listening ? " is-listening" : ""}`}
                aria-label={listening ? "停止语音输入" : "语音输入"}
                aria-pressed={listening}
                title={listening ? "停止语音输入" : "语音输入"}
                disabled={!canChat || pending}
                onClick={toggleListening}
              >
                {listening ? <Square size={13} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
              </button>
            )}
            <Button aria-label="发送问题" disabled={!canChat || !question.trim() || pending}>{pending ? <Loader2 size={17} className="animate-spin" /> : <ChevronRight size={17} />}</Button>
          </form>
        </div>
      </div>
    </section>
    <aside className="chat-aside">
      <section className="info-panel">
        <h3>什么时候该找医生</h3>
        <p>持续疼痛、明显不适、进食障碍风险、孕期或慢性病用药调整，请优先咨询医生或营养师。</p>
      </section>
      <CoachLaptopIllustration />
    </aside>
  </div>;

  return expanded && typeof document !== "undefined" ? createPortal(layout, document.body) : layout;
}

function CoachLaptopIllustration() {
  return <section className="info-panel chat-laptop-panel">
    <div className="chat-laptop-head">
      <h3>健康搭子在线</h3>
    </div>
    <div className="laptop-loader" aria-hidden="true">
      <span className="lp-aura" />
      <div className="lp-particles">
        <span className="lp-particle" />
        <span className="lp-particle" />
        <span className="lp-particle" />
        <span className="lp-particle" />
        <span className="lp-particle" />
        <span className="lp-particle" />
      </div>
      <span className="lp-shadow" />
      <div className="lp-scene">
        <div className="lp-laptop">
          <div className="lp-screen">
            <div className="lp-bezel">
              <span className="lp-cam" />
              <div className="lp-display">
                <div className="lp-app">
                  <div className="lp-bar">
                    <span className="lp-avatar" />
                    <span className="lp-barlines"><i /><i /></span>
                    <span className="lp-menudots"><i /><i /><i /></span>
                  </div>
                  <div className="lp-chat">
                    <div className="lp-msg lp-msg--in lp-msg--1"><span className="lp-msgtext">今晚吃啥？</span></div>
                    <div className="lp-msg lp-msg--out lp-msg--2"><span className="lp-msgtext">按记录配一份</span></div>
                    <div className="lp-msg lp-msg--in lp-msg--3"><span className="lp-msgtext">少油多蔬菜</span></div>
                    <div className="lp-typing"><i /><i /><i /></div>
                  </div>
                  <div className="lp-progress"><i /></div>
                  <div className="lp-input">
                    <span className="lp-field">
                      <span className="lp-typed">今晚吃啥</span>
                      <span className="lp-caret" />
                    </span>
                    <span className="lp-send" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lp-hinge" />
          <div className="lp-deck">
            <div className="lp-base" />
            <div className="lp-keys">
              <div className="lp-row">
                <span className="lp-key" /><span className="lp-key" /><span className="lp-key" />
                <span className="lp-key lp-hit lp-k1" /><span className="lp-key" /><span className="lp-key" />
                <span className="lp-key" /><span className="lp-key" /><span className="lp-key" /><span className="lp-key" />
              </div>
              <div className="lp-row">
                <span className="lp-key lp-hit lp-k5" /><span className="lp-key" /><span className="lp-key" />
                <span className="lp-key" /><span className="lp-key" /><span className="lp-key lp-hit lp-k2" />
                <span className="lp-key" /><span className="lp-key" /><span className="lp-key" /><span className="lp-key" />
              </div>
              <div className="lp-row">
                <span className="lp-key" /><span className="lp-key lp-hit lp-k3" /><span className="lp-key" />
                <span className="lp-key" /><span className="lp-key" /><span className="lp-key" />
                <span className="lp-key lp-hit lp-k4" /><span className="lp-key" /><span className="lp-key" /><span className="lp-key" />
              </div>
              <div className="lp-row">
                <span className="lp-key lp-key--shift lp-shift lp-k6" /><span className="lp-key" /><span className="lp-key" />
                <span className="lp-key" /><span className="lp-key" /><span className="lp-key" />
                <span className="lp-key lp-key--space" /><span className="lp-key lp-key--enter" />
              </div>
            </div>
            <span className="lp-pad" />
          </div>
          <div className="lp-front" />
        </div>
      </div>
    </div>
  </section>;
}

function CoachOrbitVisual() {
  return <div className="coach-visual" aria-hidden="true">
    <div className="svg-frame">
      <svg style={{ "--i": 0, "--j": 0 } as React.CSSProperties}>
        <g id="out1">
          <path d="M72 172C72 116.772 116.772 72 172 72C227.228 72 272 116.772 272 172C272 227.228 227.228 272 172 272C116.772 272 72 227.228 72 172ZM197.322 172C197.322 158.015 185.985 146.678 172 146.678C158.015 146.678 146.678 158.015 146.678 172C146.678 185.985 158.015 197.322 172 197.322C185.985 197.322 197.322 185.985 197.322 172Z" />
          <path mask="url(#path-1-inside-1_111_3212)" strokeMiterlimit="16" strokeWidth="2" stroke="#00FFFF" d="M72 172C72 116.772 116.772 72 172 72C227.228 72 272 116.772 272 172C272 227.228 227.228 272 172 272C116.772 272 72 227.228 72 172ZM197.322 172C197.322 158.015 185.985 146.678 172 146.678C158.015 146.678 146.678 158.015 146.678 172C146.678 185.985 158.015 197.322 172 197.322C185.985 197.322 197.322 185.985 197.322 172Z" />
        </g>
      </svg>

      <svg style={{ "--i": 1, "--j": 1 } as React.CSSProperties}>
        <g id="out2">
          <mask fill="white" id="path-2-inside-2_111_3212">
            <path d="M102.892 127.966C93.3733 142.905 88.9517 160.527 90.2897 178.19L94.3752 177.88C93.1041 161.1 97.3046 144.36 106.347 130.168L102.892 127.966Z" />
            <path d="M93.3401 194.968C98.3049 211.971 108.646 226.908 122.814 237.541L125.273 234.264C111.814 224.163 101.99 209.973 97.2731 193.819L93.3401 194.968Z" />
            <path d="M152.707 92.3592C140.33 95.3575 128.822 101.199 119.097 109.421L121.742 112.55C130.981 104.739 141.914 99.1897 153.672 96.3413L152.707 92.3592Z" />
            <path d="M253.294 161.699C255.099 175.937 253.132 190.4 247.59 203.639L243.811 202.057C249.075 189.48 250.944 175.74 249.23 162.214L253.294 161.699Z" />
            <path d="M172 90.0557C184.677 90.0557 197.18 92.9967 208.528 98.6474C219.875 104.298 229.757 112.505 237.396 122.621L234.126 125.09C226.869 115.479 217.481 107.683 206.701 102.315C195.921 96.9469 184.043 94.1529 172 94.1529V90.0557Z" />
            <path d="M244.195 133.235C246.991 138.442 249.216 143.937 250.83 149.623L246.888 150.742C245.355 145.34 243.242 140.12 240.586 135.174L244.195 133.235Z" />
            <path d="M234.238 225.304C223.932 237.338 210.358 246.126 195.159 250.604C179.961 255.082 163.79 255.058 148.606 250.534L149.775 246.607C164.201 250.905 179.563 250.928 194.001 246.674C208.44 242.42 221.335 234.071 231.126 222.639L234.238 225.304Z" />
          </mask>
          <path mask="url(#path-2-inside-2_111_3212)" fill="#00FFFF" d="M102.892 127.966L105.579 123.75L101.362 121.063L98.6752 125.28L102.892 127.966ZM90.2897 178.19L85.304 178.567L85.6817 183.553L90.6674 183.175L90.2897 178.19ZM94.3752 177.88L94.7529 182.866L99.7386 182.488L99.3609 177.503L94.3752 177.88ZM106.347 130.168L110.564 132.855L113.251 128.638L109.034 125.951L106.347 130.168ZM93.3401 194.968L91.9387 190.168L87.1391 191.569L88.5405 196.369L93.3401 194.968ZM122.814 237.541L119.813 241.54L123.812 244.541L126.813 240.542L122.814 237.541ZM125.273 234.264L129.272 237.265L132.273 233.266L128.274 230.265L125.273 234.264ZM97.2731 193.819L102.073 192.418L100.671 187.618L95.8717 189.02L97.2731 193.819ZM152.707 92.3592L157.567 91.182L156.389 86.3226L151.53 87.4998L152.707 92.3592ZM119.097 109.421L115.869 105.603L112.05 108.831L115.278 112.649L119.097 109.421ZM121.742 112.55L117.924 115.778L121.152 119.596L124.97 116.368L121.742 112.55ZM153.672 96.3413L154.849 101.201L159.708 100.023L158.531 95.1641L153.672 96.3413ZM253.294 161.699L258.255 161.07L257.626 156.11L252.666 156.738L253.294 161.699ZM247.59 203.639L245.66 208.251L250.272 210.182L252.203 205.569L247.59 203.639ZM243.811 202.057L239.198 200.126L237.268 204.739L241.88 206.669L243.811 202.057ZM249.23 162.214L248.601 157.253L243.641 157.882L244.269 162.842L249.23 162.214ZM172 90.0557V85.0557H167V90.0557H172ZM208.528 98.6474L206.299 103.123L206.299 103.123L208.528 98.6474ZM237.396 122.621L240.409 126.611L244.399 123.598L241.386 119.608L237.396 122.621ZM234.126 125.09L230.136 128.103L233.149 132.093L237.139 129.08L234.126 125.09ZM206.701 102.315L204.473 106.791L204.473 106.791L206.701 102.315ZM172 94.1529H167V99.1529H172V94.1529ZM244.195 133.235L248.601 130.87L246.235 126.465L241.83 128.83L244.195 133.235ZM250.83 149.623L252.195 154.433L257.005 153.067L255.64 148.257L250.83 149.623ZM246.888 150.742L242.078 152.107L243.444 156.917L248.254 155.552L246.888 150.742ZM240.586 135.174L238.22 130.768L233.815 133.134L236.181 137.539L240.586 135.174ZM234.238 225.304L238.036 228.556L241.288 224.759L237.491 221.506L234.238 225.304ZM195.159 250.604L196.572 255.4L196.572 255.4L195.159 250.604ZM148.606 250.534L143.814 249.107L142.386 253.899L147.178 255.326L148.606 250.534ZM149.775 246.607L151.203 241.816L146.411 240.388L144.983 245.18L149.775 246.607ZM194.001 246.674L195.415 251.47L195.415 251.47L194.001 246.674ZM231.126 222.639L234.379 218.841L230.581 215.589L227.329 219.386L231.126 222.639ZM98.6752 125.28C88.5757 141.13 83.8844 159.826 85.304 178.567L95.2754 177.812C94.0191 161.227 98.1709 144.681 107.109 130.653L98.6752 125.28ZM90.6674 183.175L94.7529 182.866L93.9976 172.895L89.912 173.204L90.6674 183.175ZM99.3609 177.503C98.1715 161.8 102.102 146.135 110.564 132.855L102.131 127.481C92.5071 142.585 88.0368 160.4 89.3895 178.258L99.3609 177.503ZM109.034 125.951L105.579 123.75L100.205 132.183L103.661 134.385L109.034 125.951ZM88.5405 196.369C93.8083 214.41 104.78 230.259 119.813 241.54L125.815 233.542C112.512 223.558 102.802 209.532 98.1397 193.566L88.5405 196.369ZM126.813 240.542L129.272 237.265L121.274 231.263L118.815 234.54L126.813 240.542ZM128.274 230.265C115.679 220.813 106.486 207.534 102.073 192.418L92.4735 195.221C97.493 212.412 107.948 227.513 122.272 238.263L128.274 230.265ZM95.8717 189.02L91.9387 190.168L94.7415 199.767L98.6745 198.619L95.8717 189.02ZM151.53 87.4998C138.398 90.681 126.188 96.8793 115.869 105.603L122.325 113.239C131.457 105.519 142.262 100.034 153.884 97.2187L151.53 87.4998ZM115.278 112.649L117.924 115.778L125.56 109.322L122.915 106.193L115.278 112.649ZM124.97 116.368C133.616 109.059 143.846 103.866 154.849 101.201L152.495 91.4818C139.981 94.5132 128.347 100.419 118.514 108.732L124.97 116.368ZM158.531 95.1641L157.567 91.182L147.848 93.5364L148.812 97.5185L158.531 95.1641ZM248.334 162.327C250.028 175.697 248.181 189.277 242.978 201.708L252.203 205.569C258.082 191.522 260.169 176.177 258.255 161.07L248.334 162.327ZM249.521 199.027L245.741 197.445L241.88 206.669L245.66 208.251L249.521 199.027ZM248.423 203.987C254.025 190.602 256.014 175.98 254.19 161.585L244.269 162.842C245.873 175.5 244.125 188.357 239.198 200.126L248.423 203.987ZM249.858 167.174L253.923 166.659L252.666 156.738L248.601 157.253L249.858 167.174ZM172 95.0557C183.903 95.0557 195.644 97.8172 206.299 103.123L210.757 94.1717C198.717 88.1761 185.45 85.0557 172 85.0557V95.0557ZM206.299 103.123C216.954 108.429 226.233 116.135 233.406 125.634L241.386 119.608C233.281 108.874 222.796 100.167 210.757 94.1717L206.299 103.123ZM234.383 118.631L231.113 121.1L237.139 129.08L240.409 126.611L234.383 118.631ZM238.116 122.077C230.393 111.849 220.403 103.552 208.93 97.8393L204.473 106.791C214.56 111.814 223.345 119.11 230.136 128.103L238.116 122.077ZM208.93 97.8393C197.458 92.1263 184.816 89.1529 172 89.1529V99.1529C183.269 99.1529 194.385 101.767 204.473 106.791L208.93 97.8393ZM177 94.1529V90.0557H167V94.1529H177ZM239.79 135.601C242.416 140.49 244.504 145.649 246.02 150.988L255.64 148.257C253.927 142.225 251.567 136.395 248.601 130.87L239.79 135.601ZM249.464 144.813L245.523 145.932L248.254 155.552L252.195 154.433L249.464 144.813ZM251.698 149.376C250.067 143.628 247.818 138.073 244.991 132.808L236.181 137.539C238.666 142.168 240.644 147.052 242.078 152.107L251.698 149.376ZM242.951 139.579L246.561 137.64L241.83 128.83L238.22 130.768L242.951 139.579ZM230.441 222.051C220.763 233.351 208.017 241.603 193.746 245.808L196.572 255.4C212.698 250.649 227.101 241.325 238.036 228.556L230.441 222.051ZM193.746 245.808C179.475 250.012 164.291 249.99 150.033 245.742L147.178 255.326C163.289 260.125 180.447 260.151 196.572 255.4L193.746 245.808ZM153.397 251.962L154.567 248.035L144.983 245.18L143.814 249.107L153.397 251.962ZM148.348 251.399C163.7 255.973 180.049 255.997 195.415 251.47L192.588 241.877C179.077 245.858 164.702 245.837 151.203 241.816L148.348 251.399ZM195.415 251.47C210.78 246.942 224.504 238.058 234.924 225.891L227.329 219.386C218.167 230.084 206.099 237.897 192.588 241.877L195.415 251.47ZM227.874 226.436L230.986 229.101L237.491 221.506L234.379 218.841L227.874 226.436Z" />
        </g>
      </svg>

      <svg style={{ "--i": 0, "--j": 2 } as React.CSSProperties}>
        <g id="inner3">
          <path d="M195.136 135.689C188.115 131.215 179.948 128.873 171.624 128.946C163.299 129.019 155.174 131.503 148.232 136.099L148.42 136.382C155.307 131.823 163.368 129.358 171.627 129.286C179.886 129.213 187.988 131.537 194.954 135.975L195.136 135.689Z" />
          <path d="M195.136 208.311C188.115 212.784 179.948 215.127 171.624 215.054C163.299 214.981 155.174 212.496 148.232 207.901L148.42 207.618C155.307 212.177 163.368 214.642 171.627 214.714C179.886 214.786 187.988 212.463 194.954 208.025L195.136 208.311Z" />
          <path mask="url(#path-5-inside-3_111_3212)" fill="#00FFFF" d="M195.136 135.689L195.474 135.904L195.689 135.566L195.351 135.352L195.136 135.689ZM171.624 128.946L171.627 129.346L171.624 128.946ZM148.232 136.099L148.011 135.765L147.678 135.986L147.899 136.32L148.232 136.099ZM148.42 136.382L148.086 136.603L148.307 136.936L148.641 136.716L148.42 136.382ZM171.627 129.286L171.63 129.686L171.627 129.286ZM194.954 135.975L194.739 136.313L195.076 136.528L195.291 136.19L194.954 135.975ZM195.136 208.311L195.351 208.648L195.689 208.433L195.474 208.096L195.136 208.311ZM171.624 215.054L171.627 214.654L171.624 215.054ZM148.232 207.901L147.899 207.68L147.678 208.014L148.011 208.234L148.232 207.901ZM148.42 207.618L148.641 207.284L148.307 207.063L148.086 207.397L148.42 207.618ZM171.627 214.714L171.63 214.314L171.627 214.714ZM194.954 208.025L195.291 207.81L195.076 207.472L194.739 207.687L194.954 208.025ZM195.351 135.352C188.265 130.836 180.022 128.473 171.62 128.546L171.627 129.346C179.874 129.274 187.966 131.594 194.921 136.026L195.351 135.352ZM171.62 128.546C163.218 128.619 155.018 131.127 148.011 135.765L148.453 136.432C155.33 131.88 163.38 129.418 171.627 129.346L171.62 128.546ZM147.899 136.32L148.086 136.603L148.753 136.161L148.566 135.878L147.899 136.32ZM148.641 136.716C155.463 132.199 163.448 129.757 171.63 129.686L171.623 128.886C163.287 128.958 155.15 131.447 148.199 136.049L148.641 136.716ZM171.63 129.686C179.812 129.614 187.839 131.916 194.739 136.313L195.169 135.638C188.138 131.158 179.959 128.813 171.623 128.886L171.63 129.686ZM195.291 136.19L195.474 135.904L194.799 135.474L194.617 135.76L195.291 136.19ZM194.921 207.974C187.966 212.406 179.874 214.726 171.627 214.654L171.62 215.454C180.022 215.527 188.265 213.163 195.351 208.648L194.921 207.974ZM171.627 214.654C163.38 214.582 155.33 212.12 148.453 207.567L148.011 208.234C155.018 212.873 163.218 215.38 171.62 215.454L171.627 214.654ZM148.566 208.122L148.753 207.838L148.086 207.397L147.899 207.68L148.566 208.122ZM148.199 207.951C155.15 212.553 163.287 215.041 171.623 215.114L171.63 214.314C163.448 214.243 155.463 211.801 148.641 207.284L148.199 207.951ZM171.623 215.114C179.959 215.187 188.138 212.842 195.169 208.362L194.739 207.687C187.839 212.084 179.812 214.386 171.63 214.314L171.623 215.114ZM194.617 208.239L194.799 208.526L195.474 208.096L195.291 207.81L194.617 208.239Z" />
        </g>
        <path stroke="#00FFFF" d="M240.944 172C240.944 187.951 235.414 203.408 225.295 215.738C215.176 228.068 201.095 236.508 185.45 239.62C169.806 242.732 153.567 240.323 139.5 232.804C125.433 225.285 114.408 213.12 108.304 198.384C102.2 183.648 101.394 167.25 106.024 151.987C110.654 136.723 120.434 123.537 133.696 114.675C146.959 105.813 162.884 101.824 178.758 103.388C194.632 104.951 209.472 111.97 220.751 123.249" id="out3" />
      </svg>

      <svg style={{ "--i": 1, "--j": 3 } as React.CSSProperties}>
        <g id="inner1">
          <path fill="#00FFFF" d="M145.949 124.51L148.554 129.259C156.575 124.859 165.672 122.804 174.806 123.331C183.94 123.858 192.741 126.944 200.203 132.236C207.665 137.529 213.488 144.815 217.004 153.261C220.521 161.707 221.59 170.972 220.09 179.997L224.108 180.665L224.102 180.699L229.537 181.607C230.521 175.715 230.594 169.708 229.753 163.795L225.628 164.381C224.987 159.867 223.775 155.429 222.005 151.179C218.097 141.795 211.628 133.699 203.337 127.818C195.045 121.937 185.266 118.508 175.118 117.923C165.302 117.357 155.525 119.474 146.83 124.037C146.535 124.192 146.241 124.349 145.949 124.51ZM224.638 164.522C224.009 160.091 222.819 155.735 221.082 151.563C217.246 142.352 210.897 134.406 202.758 128.634C194.62 122.862 185.021 119.496 175.06 118.922C165.432 118.367 155.841 120.441 147.311 124.914L148.954 127.91C156.922 123.745 165.876 121.814 174.864 122.333C184.185 122.87 193.166 126.019 200.782 131.421C208.397 136.822 214.339 144.257 217.928 152.877C221.388 161.188 222.526 170.276 221.23 179.173L224.262 179.677C224.998 174.671 225.35 169.535 224.638 164.522Z" clipRule="evenodd" fillRule="evenodd" />
          <path fill="#00FFFF" d="M139.91 220.713C134.922 217.428 130.469 213.395 126.705 208.758L130.983 205.286L130.985 205.288L134.148 202.721C141.342 211.584 151.417 217.642 162.619 219.839C173.821 222.036 185.438 220.232 195.446 214.742L198.051 219.491C197.759 219.651 197.465 219.809 197.17 219.963C186.252 225.693 173.696 227.531 161.577 225.154C154.613 223.789 148.041 221.08 142.202 217.234L139.91 220.713ZM142.752 216.399C148.483 220.174 154.934 222.833 161.769 224.173C173.658 226.504 185.977 224.704 196.689 219.087L195.046 216.09C185.035 221.323 173.531 222.998 162.427 220.82C151.323 218.643 141.303 212.747 134.01 204.122L131.182 206.5C134.451 210.376 138.515 213.607 142.752 216.399Z" clipRule="evenodd" fillRule="evenodd" />
        </g>
      </svg>

      <svg style={{ "--i": 2, "--j": 4 } as React.CSSProperties}>
        <path fill="#00FFFF" d="M180.956 186.056C183.849 184.212 186.103 181.521 187.41 178.349C188.717 175.177 189.013 171.679 188.258 168.332C187.503 164.986 185.734 161.954 183.192 159.65C180.649 157.346 177.458 155.883 174.054 155.46C170.649 155.038 167.197 155.676 164.169 157.288C161.14 158.9 158.683 161.407 157.133 164.468C155.582 167.528 155.014 170.992 155.505 174.388C155.997 177.783 157.524 180.944 159.879 183.439L161.129 182.259C159.018 180.021 157.648 177.186 157.207 174.141C156.766 171.096 157.276 167.989 158.667 165.245C160.057 162.5 162.261 160.252 164.977 158.806C167.693 157.36 170.788 156.788 173.842 157.167C176.895 157.546 179.757 158.858 182.037 160.924C184.317 162.99 185.904 165.709 186.581 168.711C187.258 171.712 186.992 174.849 185.82 177.694C184.648 180.539 182.627 182.952 180.032 184.606L180.956 186.056Z" id="center1" />
        <path fill="#00FFFF" d="M172 166.445C175.068 166.445 177.556 168.932 177.556 172C177.556 175.068 175.068 177.556 172 177.556C168.932 177.556 166.444 175.068 166.444 172C166.444 168.932 168.932 166.445 172 166.445ZM172 177.021C174.773 177.021 177.021 174.773 177.021 172C177.021 169.227 174.773 166.979 172 166.979C169.227 166.979 166.979 169.227 166.979 172C166.979 174.773 169.227 177.021 172 177.021Z" id="center" />
      </svg>
    </div>
  </div>;
}

function CoachCubes() {
  return <div className="coach-cubes" aria-hidden="true">
    <div className="cube-scale">
      <div className="cube-container">
        {[0, 1, 2].map((layer) => (
          <div className="cube" key={layer}>
            {[-1, 0, 1].map((x) => (
              <div key={x} style={{ "--x": x, "--y": 0 } as React.CSSProperties}>
                {[3, 2, 1].map((i) => (
                  <span key={i} style={{ "--i": i } as React.CSSProperties} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>;
}

function OtherPage({ page, spaceProfile, hasStored, demo, identityKey }: { page: string; spaceProfile: SpaceProfile; hasStored: boolean; demo: boolean; identityKey: string }) {
  const dashboardQuery = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, retry: authAwareRetry });
  const reviewTitleRef = React.useRef<HTMLHeadingElement | null>(null);
  if (page === "profile") {
    return <div className="app-content">
      <MySpace data={dashboardQuery.data} loading={dashboardQuery.isPending} profile={spaceProfile} hasStored={hasStored} demo={demo} />
    </div>;
  }
  if (page === "plans" || page === "exercise") {
    return <div className="app-content pp-shell">
      <PlanSwitcher page={page} profile={spaceProfile} hasStored={hasStored} />
      {page === "plans"
        ? <DietPlan data={dashboardQuery.data} loading={dashboardQuery.isPending} profile={spaceProfile} hasStored={hasStored} />
        : <ExercisePlan data={dashboardQuery.data} profile={spaceProfile} hasStored={hasStored} />}
    </div>;
  }
  const content: Record<string, { eyebrow?: string; title: React.ReactNode; intro?: string }> = {
    food: { eyebrow: "多模态餐食记录", title: "一张照片，轻松记下一餐。" },
    coach: {
      eyebrow: "不确定的时候，随时聊聊",
      title: <>你好，我在听<span className="coach-title-dot">。</span></>,
    },
    review: {
      title: (
        <>
          <span className="review-title-line">看见过程，</span>
          <span className="review-title-line review-title-line--offset">而不是结果</span>
        </>
      ),
    },
  };
  const item = content[page] ?? content.food;
  return <div className="app-content">
    <div className={`page-heading${page === "coach" ? " page-heading--coach" : ""}${page === "review" ? " page-heading--review" : ""}`}>
      <div className="page-heading-copy">
        {item.eyebrow && <div className="eyebrow">{item.eyebrow}</div>}
        <div className={page === "coach" ? "coach-title-row" : undefined}>
          <h1 ref={page === "review" ? reviewTitleRef : undefined} className={page === "review" ? "review-title" : undefined}>
            {item.title}
            {page === "review" && (
              <ReviewFluidTitle hostRef={reviewTitleRef} images={REVIEW_TITLE_IMAGES} />
            )}
          </h1>
          {page === "coach" && (
            <div className="coach-mochi" aria-hidden="true">
              <MochiFigure />
            </div>
          )}
        </div>
        {item.intro && <p>{item.intro}</p>}
      </div>
      {page === "coach" && <CoachCubes />}
      {page === "review" && (
        <div className="review-cosmos" aria-hidden="true">
          <span className="review-orbit-ring" />
          <span className="review-earth" />
          <i className="review-star review-star--1" />
          <i className="review-star review-star--2" />
          <i className="review-star review-star--3" />
          <i className="review-star review-star--4" />
          <i className="review-star review-star--5" />
          <i className="review-star review-star--6" />
        </div>
      )}
    </div>
    {page === "food" && <MealRecorder />}
    {page === "coach" && <ChatPanel identityKey={identityKey} />}
    {page === "review" && <ReviewPanel data={dashboardQuery.data} loading={dashboardQuery.isPending} />}
  </div>;
}

function CoreApp({ onHome }: { onHome: () => void }) {
  const page = useHealthStore((state) => state.page);
  const visitedPages = useHealthStore((state) => state.visitedPages);
  const setPage = useHealthStore((state) => state.setPage);
  const storedSpaceProfile = useHealthStore((state) => state.spaceProfile);
  const setSpaceProfile = useHealthStore((state) => state.setSpaceProfile);
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: fetchProfile, retry: authAwareRetry });
  const dashboardQuery = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, retry: authAwareRetry });
  const scrollPositions = React.useRef<Record<string, number>>({});
  const activePageRef = React.useRef<Page>(page);
  const previousPageRef = React.useRef<Page>(page);
  const [slideOrigin, setSlideOrigin] = React.useState<Page>(page);
  const [slideFrom, setSlideFrom] = React.useState<Page | null>(null);
  if (slideOrigin !== page) {
    setSlideFrom(slideOrigin);
    setSlideOrigin(page);
  }
  const pageOrder = (value: Page) => navigation.findIndex((item) => item.id === value);
  const slideDirection = slideFrom && pageOrder(page) < pageOrder(slideFrom) ? "backward" : "forward";
  const renderedPages = visitedPages.includes(page) ? visitedPages : [...visitedPages, page];
  const dashboard = dashboardQuery.data;
  const authRequired = (!profileQuery.data && isAuthError(profileQuery.error)) || (!dashboardQuery.data && isAuthError(dashboardQuery.error));
  const authPending = !authRequired && !profileQuery.data && profileQuery.isPending;
  const profilePage = page === "profile";
  const pendingMeals = dashboard?.pendingMeals ?? 0;
  const activeNavIndex = Math.max(0, navigation.findIndex((item) => item.id === page));
  const hasStoredSpace = Boolean(storedSpaceProfile?.savedAt);
  const identityKey = profileQuery.data?.account?.email ?? (profileQuery.data?.demo ? "demo" : "pending");
  const spaceProfile = React.useMemo(() => {
    if (storedSpaceProfile) return storedSpaceProfile;
    const accountName = dashboard?.demo ? "" : dashboard?.displayName && dashboard.displayName !== "你" ? dashboard.displayName : "";
    return createEmptySpaceProfile(accountName);
  }, [storedSpaceProfile, dashboard]);

  React.useEffect(() => {
    if (profileQuery.data?.profile) setSpaceProfile(profileQuery.data.profile);
  }, [profileQuery.data, setSpaceProfile]);

  const resetAccountData = React.useCallback(() => {
    setSpaceProfile(null);
    void queryClient.resetQueries({ queryKey: ["dashboard"] });
    void queryClient.resetQueries({ queryKey: ["meals"] });
    void queryClient.resetQueries({ queryKey: ["profile"] });
  }, [queryClient, setSpaceProfile]);

  const handleAccountChanged = React.useCallback(() => {
    useHealthStore.setState({ page: "dashboard" });
    resetAccountData();
  }, [resetAccountData]);

  React.useEffect(() => {
    const rememberScroll = () => {
      scrollPositions.current[activePageRef.current] = window.scrollY;
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, []);

  useIsomorphicLayoutEffect(() => {
    activePageRef.current = page;
    if (previousPageRef.current === page) return;
    previousPageRef.current = page;
    window.scrollTo({ top: scrollPositions.current[page] ?? 0, behavior: "auto" });
  }, [page]);

  if (authRequired) {
    return <AuthScreen onAuthenticated={resetAccountData} onHome={onHome} />;
  }

  if (authPending) {
    return <AuthCheckingScreen />;
  }

  return <div className="app-shell">
    <ScrollProgress />
    <aside className="sidebar" aria-label="主导航">
      <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); setPage("dashboard"); }}><span className="brand-mark"><img src="/brand/icon-192.png" alt="" width={36} height={36} /></span><span>智养 AI<small>WELLNESS, IN SYNC</small></span></a>
      <div className="nav-label">你的空间</div>
      <nav className="nav-list" style={{ "--nav-index": activeNavIndex } as React.CSSProperties}>
        <span className="nav-glider" aria-hidden="true" />
        {navigation.map(({ id, label, icon: Icon }) => (
          <button className={`nav-item ${page === id ? "active" : ""}`} key={id} onClick={() => setPage(id)} aria-current={page === id ? "page" : undefined}>
            <span className="nav-icon"><Icon size={18} /></span>{label}
            {id === "food" && pendingMeals > 0 && <span className="nav-badge">{pendingMeals}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="coach-card">
          <CoachOrbitVisual />
          <strong>慢一点，也算在前进。</strong>
          <button className="coach-cta" onClick={() => setPage("coach")}>
            <i className="animation" aria-hidden="true" />
            和搭子聊聊
            <i className="animation" aria-hidden="true" />
          </button>
        </div>
        <SpaceCard
          profile={spaceProfile}
          saved={hasStoredSpace}
          demo={Boolean(dashboard?.demo)}
          active={profilePage}
          shortcuts={navigation.filter((item) => item.id !== "profile")}
          onOpen={() => setPage("profile")}
          onNavigate={setPage}
        />
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumb">
          <button type="button" className="breadcrumb-home" onClick={onHome}>返回首页</button><span className="slash">/</span>
          <strong>{page === "profile" ? "个人资料" : navigation.find((item) => item.id === page)?.label ?? "个人档案"}</strong>
        </div>
        <div className="topbar-actions">
          {dashboard?.demo && <span className="demo-chip">演示沙盒</span>}
          <span className="date-pill">{dashboard?.dateLabel ?? "今天"}</span>
          <AccountPanel data={profileQuery.data} loading={profileQuery.isPending} onChanged={handleAccountChanged} />
        </div>
      </header>
      <div className="mobile-brand">
        <span className="brand-mark"><img src="/brand/icon-192.png" alt="" width={29} height={29} /></span><b>智养 AI</b>
        {dashboard?.demo && <span className="demo-chip">演示</span>}
        <AccountPanel data={profileQuery.data} loading={profileQuery.isPending} onChanged={handleAccountChanged} compact />
        <button type="button" className="mobile-home" onClick={onHome}>首页</button>
      </div>
      <section className="page-content">
        {renderedPages.map((visitedPage) => (
          <React.Activity key={visitedPage} mode={visitedPage === page ? "visible" : "hidden"}>
            <div className={`page-panel min-w-0${visitedPage === page ? " is-active" : ""}`} data-slide={visitedPage === page && slideFrom ? slideDirection : undefined}>
              {visitedPage === "dashboard" ? <Dashboard key={identityKey} identityKey={identityKey} /> : <OtherPage key={identityKey} page={visitedPage} spaceProfile={spaceProfile} hasStored={hasStoredSpace} demo={Boolean(profileQuery.data?.demo)} identityKey={identityKey} />}
            </div>
          </React.Activity>
        ))}
      </section>
      <footer className="footer-note"><span>智养 AI 仅提供日常健康管理建议，不替代专业医疗意见。</span></footer>
    </main>

    <nav className="mobile-nav" aria-label="移动端导航">
      {navigation.filter((item) => !("mobileHidden" in item && item.mobileHidden)).map(({ id, short, icon: Icon }) => {
        const active = page === id || (id === "plans" && page === "exercise");
        return (
          <button className={active ? "active" : ""} key={id} onClick={() => setPage(id)} aria-current={active ? "page" : undefined}>
            <span><Icon size={18} /></span>{short}
          </button>
        );
      })}
    </nav>

    <FloatingCompanion hidden={page === "coach" || page === "profile"} onOpen={() => setPage("coach")} />
    <BackToTop />
  </div>;
}

const landingAnchors: Partial<Record<Page, string>> = {
  food: "module-food",
  plans: "module-plans",
  exercise: "module-exercise",
  coach: "module-coach",
  review: "module-review",
};

export default function HomePage() {
  const [landing, setLanding] = React.useState(true);
  const returnAnchor = React.useRef<string | null>(null);
  const enteringRef = React.useRef(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!landing) return;
    void queryClient.prefetchQuery({ queryKey: ["profile"], queryFn: fetchProfile, retry: authAwareRetry });
    void queryClient.prefetchQuery({ queryKey: ["dashboard"], queryFn: getDashboard, retry: authAwareRetry });
  }, [landing, queryClient]);

  const enterCore = React.useCallback(async (target: Page, anchor?: string) => {
    if (enteringRef.current) return;
    enteringRef.current = true;
    returnAnchor.current = anchor ?? null;
    useHealthStore.getState().setPage(target);
    try {
      await Promise.race([
        Promise.allSettled([
          queryClient.ensureQueryData({ queryKey: ["profile"], queryFn: fetchProfile, retry: authAwareRetry }),
          queryClient.ensureQueryData({ queryKey: ["dashboard"], queryFn: getDashboard, retry: authAwareRetry }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } finally {
      setLanding(false);
      enteringRef.current = false;
    }
  }, [queryClient]);

  React.useEffect(() => {
    if (!landing) {
      window.scrollTo(0, 0);
      return;
    }
    const anchor = returnAnchor.current;
    if (!anchor) {
      window.scrollTo(0, 0);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [landing]);

  return <>
    <main className="landing-shell" hidden={!landing}>
      <Hero38 onEnter={(target: Page) => enterCore(target)} />
      <LandingSections onEnter={(target: Page) => enterCore(target, landingAnchors[target])} />
    </main>
    {!landing && <CoreApp onHome={() => setLanding(true)} />}
  </>;
}
