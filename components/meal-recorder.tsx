"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Camera, Check, Loader2, Pencil, Plus, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { HamsterLoader } from "@/components/experience";
import { Button } from "@/components/ui/button";
import type { DynamicPlanAdjustment } from "@/lib/plan-adjustment";
import { useHealthStore } from "@/stores/health-store";

type Nutrition = { proteinG: number; carbsG: number; fatG: number };
type MealDataSource = "food_table" | "model_estimate" | "manual";
type AnalysisItem = {
  name: string;
  grams: number;
  kcal: number;
  confidence: "high" | "medium" | "low";
  nutrition: Nutrition;
  per100?: Nutrition & { kcal: number };
  estimatedName?: string;
  dataSource?: MealDataSource;
  foodId?: string;
  matchedName?: string;
  matchScore?: number;
};
type Analysis = {
  dish: string;
  items: AnalysisItem[];
  totalKcal: number;
  uncertainty: string;
  nutrition: Nutrition;
  foodDataVersion?: string;
  foodDataSource?: string;
  nutritionSummary?: { foodTableItems: number; modelEstimateItems: number };
};

type MealItemRecord = {
  name: string;
  amountGrams?: number;
  calories?: number;
  foodId?: string;
  dataSource?: MealDataSource;
  matchedName?: string;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};

type MealRecord = {
  id: string;
  title: string;
  mealType: string;
  items: MealItemRecord[];
  estimatedKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  status: string;
  eatenAt: string;
  notes: string;
};

type EstimateResponse = {
  per100?: Per100;
  source?: "food_table" | "model_estimate";
  food?: { id: string; name: string; portionGrams: number; portionLabel: string; dataSource: string; dataVersion: string };
  message?: string;
};

type AdjustmentResponse = {
  status?: "NONE" | "SUGGESTED" | "ACTIVE" | "APPLIED";
  suggestion?: DynamicPlanAdjustment;
  adjustment?: DynamicPlanAdjustment;
  reason?: string;
  message?: string;
};

type SignedAdjustment = {
  suggestion: DynamicPlanAdjustment;
  signature: string;
};

type AdjustmentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AdjustmentChatResponse = {
  reply?: string;
  suggestion?: DynamicPlanAdjustment;
  signature?: string;
  applied?: boolean;
  message?: string;
};

const mealTypeLabel: Record<string, string> = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  DINNER: "晚餐",
  SNACK: "加餐",
  OTHER: "其他",
};

const confidenceLabel: Record<AnalysisItem["confidence"], string> = {
  high: "较确定",
  medium: "可能",
  low: "不确定",
};

function sourceMeta(item: AnalysisItem) {
  if (item.dataSource === "food_table") return { label: item.matchedName ? `食物参考库 · ${item.matchedName}` : "食物参考库", tone: "table" };
  if (item.dataSource === "model_estimate") return { label: "AI 估算", tone: "model" };
  if (item.dataSource === "manual") return { label: "手动填写", tone: "manual" };
  return { label: "来源待核对", tone: "unknown" };
}

function recordSourceMeta(items: MealRecord["items"]) {
  const sources = new Set(items.map((item) => item.dataSource).filter(Boolean));
  if (sources.size !== 1) return sources.size > 1 ? { label: "营养来源混合", tone: "unknown" } : null;
  const [only] = sources;
  if (only === "food_table") return { label: "营养按食物参考库换算", tone: "table" };
  if (only === "model_estimate") return { label: "营养为 AI 估算", tone: "model" };
  if (only === "manual") return { label: "热量为手动填写", tone: "manual" };
  return null;
}

function SectionTitle({ title }: { title: string }) {
  return <div className="section-title"><h2>{title}</h2></div>;
}

function DynamicAdjustPrompt({ suggestion, applying, onClose, onApply }: {
  suggestion: DynamicPlanAdjustment;
  applying: boolean;
  onClose: () => void;
  onApply: (payload?: SignedAdjustment) => Promise<string | null>;
}) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const threadRef = React.useRef<HTMLDivElement>(null);
  const [current, setCurrent] = React.useState(suggestion);
  const [signature, setSignature] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<AdjustmentChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [chatting, setChatting] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const busy = applying || chatting;

  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !applying) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [applying, onClose]);

  React.useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, chatting]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setDraft("");
    setChatError(null);
    setApplyError(null);
    setChatting(true);
    try {
      const response = await fetch("/api/plans/adjust/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-12),
          ...(signature ? { current: { suggestion: current, signature } } : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as AdjustmentChatResponse | null;
      if (!response.ok) throw new Error(data?.message ?? "刚才没接上话，再发一次试试。");
      if (data?.reply) {
        const reply = data.reply;
        setMessages((previous) => [...previous, { role: "assistant", content: reply }]);
      }
      if (data?.suggestion && data.signature) {
        setCurrent(data.suggestion);
        setSignature(data.signature);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "刚才没接上话，再发一次试试。");
    } finally {
      setChatting(false);
    }
  }

  async function apply() {
    if (busy) return;
    setApplyError(null);
    const error = await onApply(signature ? { suggestion: current, signature } : undefined);
    if (error) setApplyError(error);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pp-adjust-overlay"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !applying) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="pp-adjust-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-adjust-title"
        tabIndex={-1}
      >
        <div className="pp-adjust-sheet">
          <div className="pp-adjust-inner">
            <header className="pp-adjust-head">
              <div>
                <h2 id="pp-adjust-title">{current.title}</h2>
                <p>{current.summary}</p>
              </div>
              <button type="button" className="pp-adjust-close" onClick={onClose} disabled={applying} aria-label="关闭调整建议">
                <X size={16} />
              </button>
            </header>

            <div className="pp-adjust-body">
              <div className="pp-adjust-evidence">
                <span>为什么建议调整</span>
                <ul>
                  {current.evidence.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>

              <div className="pp-adjust-section">
                <div className="pp-adjust-subhead">
                  <strong>今天剩下</strong>
                  <span>按七分饱，不跳过</span>
                </div>
                {current.remainingToday.length > 0 ? (
                  <ul className="pp-adjust-meals">
                    {current.remainingToday.map((meal) => (
                      <li key={`${meal.label}-${meal.time}`}>
                        <span className="pp-adjust-time">{meal.time}</span>
                        <div>
                          <strong>{meal.label} · {meal.title}</strong>
                          <p>{meal.change}{meal.kcalHint ? ` · ${meal.kcalHint}` : ""}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pp-adjust-empty">今天的计划餐次已经记录完，主要调整明天。</p>
                )}
              </div>

              <div className="pp-adjust-section">
                <div className="pp-adjust-subhead">
                  <strong>{current.nextDayLabel}</strong>
                  <span>正常节奏</span>
                </div>
                <ul className="pp-adjust-meals">
                  {current.nextDayMeals.map((meal) => (
                    <li key={`${meal.label}-${meal.time}`}>
                      <span className="pp-adjust-time">{meal.time}</span>
                      <div>
                        <strong>{meal.label} · {meal.title}</strong>
                        <p>{meal.change}{meal.kcalHint ? ` · ${meal.kcalHint}` : ""}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pp-adjust-chat">
                <div className="pp-adjust-chat-head">
                  <Sparkles size={13} aria-hidden="true" />
                  <span>和搭子说说</span>
                </div>
                {messages.length > 0 && (
                  <div className="pp-adjust-thread" ref={threadRef} role="log" aria-live="polite">
                    {messages.map((message, index) => (
                      <p key={index} className={`pp-adjust-msg is-${message.role}`}>{message.content}</p>
                    ))}
                    {chatting && <p className="pp-adjust-msg is-assistant is-typing">正在想…</p>}
                  </div>
                )}
                <form className="pp-adjust-composer" onSubmit={sendMessage}>
                  <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={600}
                    placeholder="比如：明晚换成鸡肉，或午餐主食少一点"
                    aria-label="告诉搭子你想怎么调整"
                    disabled={applying}
                  />
                  <button type="submit" className="pp-adjust-send" disabled={!draft.trim() || busy} aria-label="发送">
                    {chatting ? <Loader2 size={15} className="pp-spin" aria-hidden="true" /> : <ArrowUp size={16} aria-hidden="true" />}
                  </button>
                </form>
                {chatError && <p className="pp-adjust-chat-error" role="status">{chatError}</p>}
                <details className="pp-adjust-safety-note">
                  <summary><ShieldCheck size={12} aria-hidden="true" />安全边界</summary>
                  <p>{current.safetyNote}</p>
                </details>
              </div>
            </div>

            <footer className="pp-adjust-foot">
              {applyError && <p className="pp-adjust-apply-error" role="status">{applyError}</p>}
              <button type="button" className="pp-adjust-dismiss" onClick={onClose} disabled={applying}>先不用，保持原计划</button>
              <button type="button" className="pp-adjust-apply" onClick={() => void apply()} disabled={busy}>
                {applying ? <Loader2 size={15} className="pp-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                {applying ? "调整中…" : "调整今天和明天"}
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

async function prepareImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("请上传图片文件。");
  if (file.size > 30 * 1024 * 1024) throw new Error("原图超过 30MB，请选择较小的图片。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error("无法读取图片，请转为 JPG、PNG 或 WebP 后重试。"); });
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法处理图片，请更换浏览器重试。");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.74);
    if (data.length > 4 * 1024 * 1024 * 4 / 3) throw new Error("压缩后图片仍过大，请裁剪后重试。");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Per100 = { kcal: number; proteinG: number; carbsG: number; fatG: number };

function sumNutrition(items: AnalysisItem[]): Nutrition {
  return items.reduce(
    (total, item) => ({
      proteinG: total.proteinG + item.nutrition.proteinG,
      carbsG: total.carbsG + item.nutrition.carbsG,
      fatG: total.fatG + item.nutrition.fatG,
    }),
    { proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function formatNutrition(value: number) {
  return Number(value.toFixed(1));
}

function per100Of(item: AnalysisItem): Per100 {
  if (item.per100) return item.per100;
  const factor = item.grams > 0 ? 100 / item.grams : 0;
  return {
    kcal: Math.round(item.kcal * factor),
    proteinG: formatNutrition(item.nutrition.proteinG * factor),
    carbsG: formatNutrition(item.nutrition.carbsG * factor),
    fatG: formatNutrition(item.nutrition.fatG * factor),
  };
}

function applyGrams(item: AnalysisItem, grams: number): AnalysisItem {
  const per100 = per100Of(item);
  const ratio = grams / 100;
  return {
    ...item,
    per100,
    grams,
    kcal: Math.round(per100.kcal * ratio),
    nutrition: {
      proteinG: formatNutrition(per100.proteinG * ratio),
      carbsG: formatNutrition(per100.carbsG * ratio),
      fatG: formatNutrition(per100.fatG * ratio),
    },
  };
}

function isoFromLocal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function guessMealType() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "BREAKFAST";
  if (hour >= 10 && hour < 15) return "LUNCH";
  if (hour >= 15 && hour < 17) return "SNACK";
  if (hour >= 17 && hour < 21) return "DINNER";
  return "OTHER";
}

function mealDisplayTitle(meal: MealRecord) {
  const label = mealTypeLabel[meal.mealType] ?? "其他";
  return meal.title.includes(label) ? meal.title : `${label} · ${meal.title}`;
}

function SameDayRecords({ onMealConfirmed }: { onMealConfirmed?: () => void }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<{ title: string; kcal: number; mealType: string }>({ title: "", kcal: 0, mealType: "OTHER" });

  const mealsQuery = useQuery({
    queryKey: ["meals"],
    queryFn: async () => {
      const response = await fetch("/api/meals");
      if (!response.ok) throw new Error("未能载入今日记录。");
      return (await response.json()) as { meals: MealRecord[]; demo: boolean; notice?: string };
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["meals"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const update = useMutation({
    mutationFn: async ({ id, title, mealType, status, items, notes }: { id: string; title?: string; mealType?: string; status?: string; items?: Array<MealItemRecord & { amountGrams: number; calories: number }>; notes?: string }) => {
      const response = await fetch(`/api/meals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(title !== undefined ? { title } : {}), ...(mealType !== undefined ? { mealType } : {}), ...(status !== undefined ? { status } : {}), ...(items !== undefined ? { items } : {}), ...(notes !== undefined ? { notes } : {}) }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "更新失败，请重试。");
      }
      return response.json();
    },
    onSuccess: (data: { meal?: { status?: string } } | null, variables) => {
      setEditingId(null);
      invalidate();
      const status = variables.status ?? data?.meal?.status;
      if (status === "CONFIRMED") onMealConfirmed?.();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/meals/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("删除失败，请重试。");
      return response.json();
    },
    onSuccess: invalidate,
  });

  if (mealsQuery.isPending) return <div className="mt-4"><HamsterLoader size="compact" label="正在载入今日记录…" /></div>;
  if (mealsQuery.isError) return <p className="mt-4 text-sm text-red-800" role="alert">{(mealsQuery.error as Error).message}</p>;

  const meals = mealsQuery.data?.meals ?? [];
  const notice = mealsQuery.data?.notice ?? (mealsQuery.data?.demo ? "演示沙盒 · 数据仅存当前会话，请勿填写真实信息。" : null);

  return (
    <div className="mt-4">
      {notice && <p className="demo-inline" role="note">{notice}</p>}
      {meals.length === 0 && <p className="text-sm text-[#58685d]">今天还没有记录，拍一张照片或手动添加一餐吧。</p>}
      {meals.map((meal) => {
        const editing = editingId === meal.id;
        const recordSource = recordSourceMeta(meal.items);
        const matchedNames = meal.items.filter((item) => item.dataSource === "food_table" && item.matchedName).map((item) => item.matchedName);
        return (
          <div className="border-b border-[#e8ece5] py-3 last:border-b-0" key={meal.id}>
            {editing ? (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_110px_36px] items-center gap-2">
                  <label className="sr-only" htmlFor={`record-type-${meal.id}`}>餐次</label>
                  <select id={`record-type-${meal.id}`} className="rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-sm" value={draft.mealType} onChange={(event) => setDraft({ ...draft, mealType: event.target.value })} aria-label="餐次">
                    <option value="BREAKFAST">早餐</option><option value="LUNCH">午餐</option><option value="DINNER">晚餐</option><option value="SNACK">加餐</option><option value="OTHER">其他</option>
                  </select>
                  <label className="sr-only" htmlFor={`record-title-${meal.id}`}>记录名称</label>
                  <input id={`record-title-${meal.id}`} className="min-w-0 rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-sm" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-label="记录名称" />
                  <label className="sr-only" htmlFor={`record-kcal-${meal.id}`}>总热量</label>
                  <div className="flex items-center gap-1">
                    <input id={`record-kcal-${meal.id}`} className="w-full min-w-0 rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-right text-sm" type="number" min="0" max="3000" value={draft.kcal} onChange={(event) => setDraft({ ...draft, kcal: Math.max(0, Math.min(3000, Number(event.target.value) || 0)) })} aria-label="总热量" />
                    <span className="text-xs text-[#8a978d]">kcal</span>
                  </div>
                  <button type="button" className="rounded-md p-2.5 text-[#7b877e] hover:bg-[#f0f5ef]" aria-label="取消编辑" onClick={() => setEditingId(null)}><X size={15} /></button>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={update.isPending || !draft.title.trim()}
                    onClick={() => {
                      const items = meal.items.map((item) => ({
                        name: item.name,
                        amountGrams: item.amountGrams ?? 0,
                        calories: item.calories ?? 0,
                        ...(item.foodId ? { foodId: item.foodId } : {}),
                        ...(item.dataSource ? { dataSource: item.dataSource } : {}),
                        ...(item.matchedName ? { matchedName: item.matchedName } : {}),
                        ...(item.proteinG !== undefined && item.carbsG !== undefined && item.fatG !== undefined
                          ? { proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG }
                          : {}),
                      }));
                      const original = items.reduce((sum, item) => sum + item.calories, 0);
                      const scale = original > 0 ? draft.kcal / original : 1;
                      update.mutate({
                        id: meal.id,
                        title: draft.title.trim(),
                        mealType: draft.mealType,
                        notes: meal.notes,
                        items: items.map((item) => ({
                          ...item,
                          calories: Math.round(item.calories * scale),
                          ...(item.proteinG !== undefined && item.carbsG !== undefined && item.fatG !== undefined
                            ? {
                                proteinG: formatNutrition(item.proteinG * scale),
                                carbsG: formatNutrition(item.carbsG * scale),
                                fatG: formatNutrition(item.fatG * scale),
                              }
                            : {}),
                        })),
                      });
                    }}
                  >
                    {update.isPending ? "保存中…" : <><Check size={15} />保存</>}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>取消</Button>
                </div>
                {update.isError && <p className="mt-2 text-xs text-red-800" role="alert">{update.error.message}</p>}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-[#3c4a41]">{mealDisplayTitle(meal)}</span>
                  <span className="flex items-center gap-1 whitespace-nowrap text-sm text-[#58685d]">
                    {meal.status === "PENDING" && <span className="meal-pending">待确认</span>}
                    {meal.status === "PENDING" ? "约 " : ""}{meal.estimatedKcal ?? 0} kcal
                    <button type="button" className="rounded-md p-2.5 text-[#84908a] hover:bg-[#f0f5ef]" aria-label={`编辑${meal.title}`} onClick={() => { setEditingId(meal.id); setDraft({ title: meal.title, kcal: meal.estimatedKcal ?? 0, mealType: meal.mealType ?? "OTHER" }); }}><Pencil size={14} /></button>
                    <button type="button" className="rounded-md p-2.5 text-[#9b7068] hover:bg-[#f7eeeb]" aria-label={`删除${meal.title}`} onClick={() => remove.mutate(meal.id)}><Trash2 size={14} /></button>
                  </span>
                </div>
                {meal.status === "PENDING" && (
                  <div className="meal-pending-row">
                    <span>识别结果尚未计入今天的热量统计。</span>
                    <Button disabled={update.isPending} onClick={() => update.mutate({ id: meal.id, status: "CONFIRMED" })}>
                      {update.isPending ? "确认中…" : <><Check size={14} />确认记录</>}
                    </Button>
                  </div>
                )}
                <p className="mt-1 text-xs text-[#84908a]">
                  {new Date(meal.eatenAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  {meal.items.length > 0 ? ` · ${meal.items.map((item) => `${item.name}${item.amountGrams ? ` ${item.amountGrams}g` : ""}`).join(" · ")}` : ""}
                </p>
                {meal.proteinG !== null && meal.carbsG !== null && meal.fatG !== null && (
                  <p className="mt-1 text-xs text-[#84908a]">
                    蛋白质 {formatNutrition(meal.proteinG)} g · 碳水 {formatNutrition(meal.carbsG)} g · 脂肪 {formatNutrition(meal.fatG)} g
                  </p>
                )}
                {recordSource && (
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#84908a]">
                    <span className={`food-source-badge is-${recordSource.tone}`}>{recordSource.label}</span>
                    {matchedNames.length > 0 && <span>{matchedNames.join("、")}</span>}
                  </p>
                )}
                {remove.isError && <p className="mt-1 text-xs text-red-800" role="alert">{remove.error.message}</p>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ManualEntry({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [mealType, setMealType] = React.useState("OTHER");
  const [eatenAt, setEatenAt] = React.useState(() => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); });
  const [grams, setGrams] = React.useState("");
  const [kcal, setKcal] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");
  const [estimateSource, setEstimateSource] = React.useState<{ source: "food_table" | "model_estimate"; foodId?: string; foodName?: string } | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const macrosFilled = protein.trim() !== "" && carbs.trim() !== "" && fat.trim() !== "";
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name.trim(),
          mealType,
          eatenAt: isoFromLocal(eatenAt),
          items: [{
            name: name.trim(),
            amountGrams: Number(grams) || 0,
            calories: Number(kcal) || 0,
            ...(macrosFilled
              ? { proteinG: Math.max(0, Number(protein) || 0), carbsG: Math.max(0, Number(carbs) || 0), fatG: Math.max(0, Number(fat) || 0) }
              : {}),
            ...(estimateSource
              ? { dataSource: estimateSource.source, ...(estimateSource.foodId ? { foodId: estimateSource.foodId, matchedName: estimateSource.foodName } : {}) }
              : { dataSource: "manual" }),
          }],
          notes: "手动添加",
          status: "CONFIRMED",
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.message ?? (data?.error === "AUTH_REQUIRED" ? "请登录后再记录。" : data?.error === "DATABASE_UNAVAILABLE" ? "数据服务暂时不可用，请稍后重试；如果多次失败，请刷新页面。" : "记录失败，请重试。"));
      }
      return data;
    },
    onSuccess: () => {
      setName(""); setGrams(""); setKcal(""); setProtein(""); setCarbs(""); setFat(""); setEstimateSource(null);
      onSaved();
    },
  });

  const estimateCalories = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/meals/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await response.json().catch(() => null)) as EstimateResponse | null;
      if (!response.ok || !data?.per100) throw new Error(data?.message ?? "热量估算失败，请重试。");
      return {
        per100: data.per100,
        source: data.source ?? "model_estimate" as const,
        foodId: data.food?.id,
        foodName: data.food?.name,
      };
    },
    onSuccess: (data) => {
      const g = Number(grams) || 100;
      setKcal(String(Math.round(data.per100.kcal * g / 100)));
      setProtein(String(formatNutrition(data.per100.proteinG * g / 100)));
      setCarbs(String(formatNutrition(data.per100.carbsG * g / 100)));
      setFat(String(formatNutrition(data.per100.fatG * g / 100)));
      setEstimateSource({ source: data.source, foodId: data.foodId, foodName: data.foodName });
    },
  });

  const valid = name.trim().length > 0 && (Number(grams) > 0 || Number(kcal) > 0);

  return (
    <section className="surface meal-card manual-entry">
      <SectionTitle title="手动添加一餐" />
      {!open ? (
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => setOpen(true)}><Plus size={15} />手动添加饮食记录</Button>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-mealtype">餐次</label>
              <select id="manual-mealtype" className="mt-1 w-full rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-sm" value={mealType} onChange={(event) => setMealType(event.target.value)}>
                <option value="BREAKFAST">早餐</option>
                <option value="LUNCH">午餐</option>
                <option value="DINNER">晚餐</option>
                <option value="SNACK">加餐 / 零食</option>
                <option value="OTHER">其他</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-name">食物或餐食名称</label>
              <input id="manual-name" className="mt-1 w-full rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-sm" value={name} onChange={(event) => { setName(event.target.value); setEstimateSource(null); }} placeholder="例如：清炒时蔬" maxLength={80} />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-mealtime">用餐时间</label>
              <input id="manual-mealtime" className="mt-1 w-full rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-sm" type="datetime-local" value={eatenAt} onChange={(event) => setEatenAt(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-grams">份量 (g)</label>
              <input id="manual-grams" className="mt-1 w-full rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-right text-sm" type="number" min="0" max="3000" value={grams} onChange={(event) => setGrams(event.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-kcal">热量 (kcal)</label>
              <div className="mt-1 flex items-center gap-2">
                <input id="manual-kcal" className="w-full min-w-0 rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-right text-sm" type="number" min="0" max="5000" value={kcal} onChange={(event) => setKcal(event.target.value)} placeholder="0" />
                <Button type="button" variant="secondary" className="whitespace-nowrap" disabled={estimateCalories.isPending || !name.trim()} onClick={() => estimateCalories.mutate()}>
                  {estimateCalories.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}AI 估算
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-protein">蛋白质 (g)</label>
              <input id="manual-protein" className="mt-1 w-full rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-right text-sm" type="number" min="0" max="1000" value={protein} onChange={(event) => setProtein(event.target.value)} placeholder="可选" />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-carbs">碳水 (g)</label>
              <input id="manual-carbs" className="mt-1 w-full rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-right text-sm" type="number" min="0" max="1500" value={carbs} onChange={(event) => setCarbs(event.target.value)} placeholder="可选" />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-fat">脂肪 (g)</label>
              <input id="manual-fat" className="mt-1 w-full rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-right text-sm" type="number" min="0" max="500" value={fat} onChange={(event) => setFat(event.target.value)} placeholder="可选" />
            </div>
          </div>
          <p className="mt-2 text-xs text-[#84908a]">份量和热量至少填一项；填好名称和份量后可点「AI 估算」自动填入热量与三大营养素，也可手动填写。三项营养素都留空时，只统计热量。</p>
          {estimateSource && (
            <p className={`food-source-note ${estimateSource.source === "food_table" ? "is-table" : "is-model"}`}>
              {estimateSource.source === "food_table"
                ? `已按食物参考库「${estimateSource.foodName}」的每 100g 数据换算。`
                : "食物参考库未收录这一项，已使用 AI 估算，数值仅供参照。"}
            </p>
          )}
          {estimateCalories.isError && <p className="mt-2 text-xs text-red-800" role="alert">{estimateCalories.error.message}</p>}
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" disabled={!valid || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "正在保存…" : <><Check size={15} />保存记录</>}</Button>
            <Button variant="secondary" onClick={() => { setOpen(false); setName(""); setGrams(""); setKcal(""); setProtein(""); setCarbs(""); setFat(""); setEstimateSource(null); }}>收起</Button>
          </div>
          {create.isError && <p className="mt-2 text-sm text-red-800" role="alert">{create.error.message}</p>}
        </>
      )}
    </section>
  );
}

export function MealRecorder() {
  const note = useHealthStore((s) => s.mealNote);
  const setNote = useHealthStore((s) => s.setMealNote);
  const confirmed = useHealthStore((s) => s.confirmed);
  const confirm = useHealthStore((s) => s.confirmMeal);
  const queryClient = useQueryClient();

  const [preview, setPreview] = React.useState<string | null>(null);
  const [filmKey, setFilmKey] = React.useState(0);
  const [analysis, setAnalysis] = React.useState<Analysis | null>(null);
  const [mealType, setMealType] = React.useState(guessMealType);
  const [eatenAt, setEatenAt] = React.useState(() => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); });
  const [error, setError] = React.useState<string | null>(null);
  const [preparing, setPreparing] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const cameraInput = React.useRef<HTMLInputElement>(null);
  const processing = React.useRef(false);
  const adjustRequest = React.useRef(0);
  const foodLayoutRef = React.useRef<HTMLDivElement>(null);
  const foodMainRef = React.useRef<HTMLDivElement>(null);
  const [adjustSuggestion, setAdjustSuggestion] = React.useState<DynamicPlanAdjustment | null>(null);
  const [adjustApplying, setAdjustApplying] = React.useState(false);
  const [adjustNotice, setAdjustNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    const layout = foodLayoutRef.current;
    const main = foodMainRef.current;
    if (!layout || !main) return;
    const media = window.matchMedia("(min-width: 801px)");
    const sync = () => {
      if (!media.matches) {
        layout.style.removeProperty("--food-main-height");
        return;
      }
      const height = Math.round(main.getBoundingClientRect().height);
      if (height > 0) layout.style.setProperty("--food-main-height", `${height}px`);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(main);
    media.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      layout.style.removeProperty("--food-main-height");
    };
  }, []);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["meals"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const checkAdjustment = React.useCallback(async () => {
    const requestId = ++adjustRequest.current;
    try {
      const response = await fetch("/api/plans/adjust/evaluate", { method: "POST" });
      if (!response.ok) return;
      const data = (await response.json()) as AdjustmentResponse;
      if (requestId !== adjustRequest.current) return;
      if (data.status === "SUGGESTED" && data.suggestion) {
        setAdjustSuggestion(data.suggestion);
        setAdjustNotice(null);
      }
    } catch {
      // 动态调整检查失败不打断记录流程。
    }
  }, []);

  const applyAdjustment = React.useCallback(async (payload?: SignedAdjustment): Promise<string | null> => {
    if (adjustApplying) return null;
    setAdjustApplying(true);
    setAdjustNotice(null);
    try {
      const response = await fetch("/api/plans/adjust/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const data = (await response.json().catch(() => null)) as AdjustmentResponse | null;
      if (!response.ok) return data?.message ?? "调整没有保存成功，请稍后重试。";
      setAdjustSuggestion(null);
      if (data?.status === "APPLIED") {
        setAdjustNotice("已调整今天剩下的餐次和明天。计划页可以看到这次调整，随时能恢复正式计划。");
        window.dispatchEvent(new CustomEvent("plan-adjustment-changed"));
      } else {
        setAdjustNotice(data?.reason ?? "记录已变化，暂不需要调整。");
      }
      return null;
    } catch {
      return "网络不太稳，调整没有保存成功，请稍后重试。";
    } finally {
      setAdjustApplying(false);
    }
  }, [adjustApplying]);

  const analyze = useMutation({
    mutationFn: async (payload: { image: string; note: string }) => {
      const response = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { analysis?: Analysis; message?: string; error?: string } | null;
      if (!response.ok || !data?.analysis) throw new Error(data?.message ?? "识别失败，请重试。");
      return data.analysis;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      useHealthStore.getState().resetMealConfirmation();
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "识别失败，请重试。"),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!analysis) throw new Error("还没有可保存的识别结果。");
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: analysis.dish || "一餐记录",
          mealType,
          eatenAt: isoFromLocal(eatenAt),
          items: analysis.items.map((item) => ({
            name: item.name,
            amountGrams: item.grams,
            calories: item.kcal,
            proteinG: item.nutrition.proteinG,
            carbsG: item.nutrition.carbsG,
            fatG: item.nutrition.fatG,
            ...(item.dataSource ? { dataSource: item.dataSource } : {}),
            ...(item.foodId ? { foodId: item.foodId } : {}),
            ...(item.matchedName ? { matchedName: item.matchedName } : {}),
          })),
          notes: note,
          status: "CONFIRMED",
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(
          data?.message ?? (data?.error === "AUTH_REQUIRED"
            ? "请登录后再确认餐食。"
            : data?.error === "DATABASE_UNAVAILABLE"
              ? "数据服务暂时不可用，请稍后重试；如果多次失败，请刷新页面。"
              : "餐食没有保存成功，请稍后重试。"),
        );
      }
      return data;
    },
    onSuccess: () => {
      confirm();
      invalidateAll();
      void checkAdjustment();
    },
  });

  async function handleFile(file?: File) {
    if (!file || processing.current || analyze.isPending || save.isPending) return;
    processing.current = true;
    setPreparing(true);
    setError(null);
    setAnalysis(null);
    try {
      const dataUrl = await prepareImage(file);
      setPreview(dataUrl);
      setFilmKey((value) => value + 1);
      analyze.mutate({ image: dataUrl, note });
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理图片失败，请重试。");
    } finally {
      setPreparing(false);
      processing.current = false;
    }
  }

  function clearPhoto() {
    setPreview(null);
    setAnalysis(null);
    setError(null);
    useHealthStore.getState().resetMealConfirmation();
    save.reset();
    if (fileInput.current) fileInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void handleFile(file);
    }
  }

  function updateItem(index: number, patch: Partial<AnalysisItem>) {
    setAnalysis((current) => {
      if (!current) return current;
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (patch.grams !== undefined) {
          return applyGrams({ ...item, ...patch, grams: item.grams }, patch.grams);
        }
        return { ...item, ...patch };
      });
      return {
        ...current,
        items,
        totalKcal: items.reduce((total, item) => total + item.kcal, 0),
        nutrition: sumNutrition(items),
      };
    });
    useHealthStore.getState().resetMealConfirmation();
    save.reset();
  }

  const estimate = useMutation({
    mutationFn: async ({ index, name }: { index: number; name: string }) => {
      const response = await fetch("/api/meals/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json().catch(() => null)) as EstimateResponse | null;
      if (!response.ok || !data?.per100) throw new Error(data?.message ?? "营养估算失败，请重试。");
      return {
        index,
        name,
        per100: data.per100,
        source: data.source ?? "model_estimate" as const,
        foodId: data.food?.id,
        foodName: data.food?.name,
      };
    },
    onSuccess: ({ index, name, per100, source, foodId, foodName }) => {
      setAnalysis((current) => {
        if (!current) return current;
        const items = current.items.map((item, itemIndex) => itemIndex === index
          ? applyGrams({ ...item, name, per100, estimatedName: name, dataSource: source, foodId, matchedName: foodName, matchScore: undefined }, item.grams)
          : item);
        return { ...current, items, totalKcal: items.reduce((total, item) => total + item.kcal, 0), nutrition: sumNutrition(items) };
      });
      useHealthStore.getState().resetMealConfirmation();
      save.reset();
    },
  });

  function addItem() {
    const blank: AnalysisItem = {
      name: "新食物",
      grams: 100,
      kcal: 0,
      confidence: "low",
      nutrition: { proteinG: 0, carbsG: 0, fatG: 0 },
      dataSource: "manual",
    };
    setAnalysis((current) => current ? {
      ...current,
      items: [...current.items, blank],
      totalKcal: current.totalKcal + blank.kcal,
      nutrition: sumNutrition([...current.items, blank]),
    } : current);
    useHealthStore.getState().resetMealConfirmation();
  }

  function removeItem(index: number) {
    setAnalysis((current) => {
      if (!current) return current;
      const items = current.items.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, items, totalKcal: items.reduce((total, item) => total + item.kcal, 0), nutrition: sumNutrition(items) };
    });
    useHealthStore.getState().resetMealConfirmation();
    save.reset();
  }

  const cameraBusy = preparing || analyze.isPending || save.isPending;

  return (
    <>
    <div className="food-layout" ref={foodLayoutRef}>
      <div className="food-main" ref={foodMainRef}>
        {adjustNotice && <p className="pp-adjust-notice" role="status">{adjustNotice}</p>}
        <section className="surface meal-card food-upload">
          <SectionTitle title="拍照记录" />
          <div
            className={`meal-cam-stage ${dragging ? "is-dragging" : ""} ${preview ? "has-film" : ""}`}
            role="group"
            aria-label="餐食照片取景区，可拖入或粘贴照片"
            tabIndex={0}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onPaste={handlePaste}
          >
            <div className="meal-cam">
              <button
                type="button"
                className="meal-cam-body"
                onClick={() => fileInput.current?.click()}
                disabled={cameraBusy}
                aria-label="点击相机，选择餐食照片"
              >
                <span className="meal-cam-stripe" aria-hidden="true" />
                <span className="meal-cam-viewfinder" aria-hidden="true" />
                <span className="meal-cam-flash" aria-hidden="true" />
                <span className={`meal-cam-led ${cameraBusy ? "is-busy" : preview ? "is-ready" : ""}`} aria-hidden="true" />
                <span className="meal-cam-lens" aria-hidden="true">
                  <span className="meal-cam-blades">
                    {Array.from({ length: 8 }, (_, index) => (
                      <i key={index} style={{ "--blade-i": index } as React.CSSProperties} />
                    ))}
                  </span>
                  <span className="meal-cam-text">拍</span>
                  <span className="meal-cam-glass" />
                  <span className="meal-cam-focus" />
                  <span className="meal-cam-ring" />
                </span>
                <span className="meal-cam-brand" aria-hidden="true">智养 · 35mm</span>
                <span className="meal-cam-lip" aria-hidden="true" />
              </button>
              <span className="meal-cam-caption" aria-hidden="true">选照片</span>
            </div>

            <div className="meal-cam-side">
              {preview ? (
                <>
                  <figure className="meal-cam-film" key={filmKey}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="已选择的餐食照片预览" />
                    {(preparing || analyze.isPending) && <span className="meal-cam-scan" aria-hidden="true" />}
                    <figcaption aria-live="polite">
                      {preparing ? "正在处理照片…" : analyze.isPending ? "正在识别这一餐…" : "底片已显影"}
                      <small>35mm</small>
                    </figcaption>
                  </figure>
                  <div className="meal-cam-actions">
                    <button type="button" className="meal-cam-action" disabled={cameraBusy} onClick={() => cameraInput.current?.click()}>
                      <Camera size={14} />重新拍摄
                    </button>
                    <button type="button" className="meal-cam-action" disabled={cameraBusy} onClick={() => fileInput.current?.click()}>
                      从相册更换
                    </button>
                    <button type="button" className="meal-cam-remove" disabled={cameraBusy} onClick={clearPhoto}>
                      <X size={13} />移除
                    </button>
                  </div>
                  <span className="meal-cam-hint">支持 JPG / PNG / WebP</span>
                </>
              ) : (
                <>
                  <strong className="meal-cam-title">镜头就是快门</strong>
                  <p className="meal-cam-copy">拍照、拖入或粘贴截图都可以。</p>
                  <div className="meal-cam-actions">
                    <button type="button" className="meal-cam-action is-primary" disabled={cameraBusy} onClick={() => cameraInput.current?.click()}>
                      <Camera size={14} />打开相机拍摄
                    </button>
                    <button type="button" className="meal-cam-action" disabled={cameraBusy} onClick={() => fileInput.current?.click()}>
                      从相册选择
                    </button>
                  </div>
                  <span className="meal-cam-hint">支持 JPG / PNG / WebP · 单张不超过 30MB</span>
                </>
              )}
            </div>
          </div>
          <input ref={fileInput} className="sr-only" type="file" accept="image/*" aria-label="选择餐食照片" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} />
          <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" aria-label="拍摄餐食照片" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} />
          {(preparing || analyze.isPending) && <div className="mt-3"><HamsterLoader size="compact" label={preparing ? "正在压缩照片…" : "正在识别与分析…"} /></div>}
          <label className="mt-4 block text-sm font-medium" htmlFor="meal-note">餐食补充说明（可选）</label>
          <textarea id="meal-note" className="meal-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：米饭只有半碗，鸡胸肉是煎的，少油…" />
          {preview && (
            <Button className="mt-3 w-full" variant="secondary" disabled={preparing || analyze.isPending} onClick={() => analyze.mutate({ image: preview, note })}>
              {preparing || analyze.isPending ? <><Loader2 size={16} className="animate-spin" />正在识别…</> : <><Sparkles size={16} />重新识别这张照片</>}
            </Button>
          )}
        </section>
        <ManualEntry onSaved={() => { invalidateAll(); void checkAdjustment(); }} />
        <section className="surface meal-timeline">
          <SectionTitle title="今日记录" />
          <SameDayRecords onMealConfirmed={checkAdjustment} />
        </section>
      </div>

      <div className="right-stack">
        <section className="surface food-result">
          <SectionTitle title="AI 的营养分析" />
          {analyze.isPending && <div className="mt-4"><HamsterLoader size="compact" label="正在分析照片中的食物与份量…" /></div>}
          {error && <p className="mt-4 text-sm text-red-800" role="alert">{error}</p>}
          {!analyze.isPending && !analysis && !error && <p className="mt-4 text-sm text-[#58685d]">上传一张照片后，这里会显示识别出的食物、份量和估算营养。</p>}
          {analysis && (
            <>
              <label className="mt-4 block text-sm font-medium" htmlFor="dish-title">餐食名称</label>
              <input
                id="dish-title"
                className="meal-note h-11 resize-none"
                value={analysis.dish}
                onChange={(event) => {
                  setAnalysis({ ...analysis, dish: event.target.value });
                  useHealthStore.getState().resetMealConfirmation();
                  save.reset();
                }}
              />
              <div className="meal-meta-row">
                <label htmlFor="dish-mealtype">
                  <span>餐次</span>
                  <select id="dish-mealtype" value={mealType} onChange={(event) => setMealType(event.target.value)}>
                    <option value="BREAKFAST">早餐</option>
                    <option value="LUNCH">午餐</option>
                    <option value="DINNER">晚餐</option>
                    <option value="SNACK">加餐</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label htmlFor="dish-eatenat">
                  <span>用餐时间</span>
                  <input id="dish-eatenat" type="datetime-local" value={eatenAt} onChange={(event) => setEatenAt(event.target.value)} />
                </label>
              </div>
              {analysis.items.length === 0 ? (
                <p className="mt-2 text-sm text-[#58685d]">没有识别出明确的食物，请换一张更清晰、光线更好的照片，或手动补充食物。</p>
              ) : (
                <div className="mt-2">
                  {analysis.items.map((item, index) => {
                    const per100 = per100Of(item);
                    const source = sourceMeta(item);
                    const nameChanged = item.estimatedName !== undefined && item.estimatedName !== item.name.trim();
                    const estimating = estimate.isPending && estimate.variables?.index === index;
                    return (
                      <div className="border-b border-[#e8ece5] py-3" key={index}>
                        <div className="grid grid-cols-[minmax(0,1fr)_90px_64px_36px] items-center gap-2">
                          <label className="sr-only" htmlFor={`food-name-${index}`}>食物名称</label>
                          <input id={`food-name-${index}`} className="min-w-0 rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-sm" value={item.name} onChange={(event) => updateItem(index, { name: event.target.value, estimatedName: undefined, dataSource: undefined, foodId: undefined, matchedName: undefined, matchScore: undefined })} aria-label={`第 ${index + 1} 项食物名称`} />
                          <label className="sr-only" htmlFor={`food-grams-${index}`}>克数</label>
                          <div className="flex items-center gap-1"><input id={`food-grams-${index}`} className="w-full min-w-0 rounded-md border border-[#e7ece5] bg-white px-2 py-2 text-right text-sm" type="number" min="0" max="3000" step="1" value={item.grams} onChange={(event) => updateItem(index, { grams: Math.max(0, Math.min(3000, Number(event.target.value) || 0)) })} aria-label={`${item.name}克数`} /><span className="text-xs text-[#8a978d]">g</span></div>
                          <span className="text-right text-xs text-[#58685d]">{item.kcal} kcal</span>
                          <button type="button" className="rounded-md p-2.5 text-[#9b7068] hover:bg-[#f7eeeb]" aria-label={`删除${item.name}`} onClick={() => removeItem(index)}><Trash2 size={15} /></button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#84908a]">
                          <span className={`food-source-badge is-${source.tone}`}>{source.label}</span>
                          <span>{confidenceLabel[item.confidence]} · 每 100g 约 {per100.kcal} kcal（蛋白 {per100.proteinG} / 碳水 {per100.carbsG} / 脂肪 {per100.fatG} g）</span>
                          <button type="button" className="link-button text-xs" disabled={estimating || !item.name.trim()} onClick={() => estimate.mutate({ index, name: item.name.trim() })}>
                            {estimating ? "估算中…" : nameChanged ? "按新名称重新估算" : "重新估算营养"}
                          </button>
                        </div>
                        {estimate.isError && estimate.variables?.index === index && <p className="mt-1 text-xs text-red-800" role="alert">{estimate.error.message}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              <Button type="button" variant="ghost" className="mt-2 w-full" onClick={addItem}><Plus size={15} />添加食物</Button>
              <div className="mt-3 flex items-center justify-between border-t border-[#e8ece5] pt-4 text-sm"><span>估算总热量</span><strong className="text-base">{analysis.totalKcal} kcal</strong></div>
              <div className="food-ingredient"><span>蛋白质 / 碳水 / 脂肪</span><span>{formatNutrition(analysis.nutrition.proteinG)} / {formatNutrition(analysis.nutrition.carbsG)} / {formatNutrition(analysis.nutrition.fatG)} g</span></div>
              {analysis.foodDataVersion && analysis.nutritionSummary && (
                <p className={`food-source-note ${analysis.nutritionSummary.foodTableItems > 0 ? "is-table" : "is-model"}`}>
                  来源：{analysis.nutritionSummary.foodTableItems} 项按食物参考库换算，{analysis.nutritionSummary.modelEstimateItems} 项为 AI 估算 · 食物库 {analysis.foodDataVersion}
                </p>
              )}
              {analysis.uncertainty && <p className="range-note mt-3">误差说明：{analysis.uncertainty}</p>}
              <Button className="mt-4 w-full" disabled={confirmed || save.isPending || analysis.items.length === 0 || analysis.items.some((item) => !item.name.trim())} onClick={() => save.mutate()}>
                {save.isPending ? "正在保存…" : confirmed ? <><Check size={16} />已确认并记录</> : "确认并记录"}
              </Button>
              {save.isError && <p className="mt-3 text-sm text-red-800" role="alert">{save.error.message}</p>}
            </>
          )}
        </section>
        <section className="info-panel">
          <h3>估算说明</h3>
          <p>识别与热量为估算；命中食物库时按每 100g 换算。确认前不计入统计。</p>
        </section>
      </div>
    </div>
    {adjustSuggestion && (
      <DynamicAdjustPrompt
        suggestion={adjustSuggestion}
        applying={adjustApplying}
        onClose={() => setAdjustSuggestion(null)}
        onApply={(payload) => applyAdjustment(payload)}
      />
    )}
    </>
  );
}
