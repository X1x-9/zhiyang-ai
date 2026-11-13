"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { WeightTrendChart, WeightValue } from "@/components/weight-trend-chart";
import {
  chinaTodayDateKey,
  formatWeightChange,
  getWeightEntries,
  weightDateLabel,
  type WeightEntry,
} from "@/lib/dashboard";
import { useHealthStore } from "@/stores/health-store";

const RECENT_LIMIT = 14;

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function weekdayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
}

type EditState = { id: string; kg: string; note: string };

export function WeightReviewSection() {
  const queryClient = useQueryClient();
  const setPage = useHealthStore((state) => state.setPage);
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ["weight"], queryFn: getWeightEntries });
  const [editing, setEditing] = React.useState<EditState | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState("");

  const entries = data?.entries ?? [];
  const profilePoint = data?.profilePoint ?? null;
  const recent = entries.slice(0, RECENT_LIMIT);
  const latest: WeightEntry | undefined = recent[0];
  const previous: WeightEntry | undefined = recent[1];
  const change = latest && previous ? Math.round((latest.kg - previous.kg) * 10) / 10 : null;
  const chartPoints = [
    ...(profilePoint ? [profilePoint] : []),
    ...recent.slice().reverse().map((entry) => ({ label: weightDateLabel(entry.dateKey), kg: entry.kg })),
  ];
  const todayKey = chinaTodayDateKey();

  function refresh() {
    setActionError("");
    void queryClient.invalidateQueries({ queryKey: ["weight"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busyId) return;
    const kg = Number(editing.kg);
    if (!Number.isFinite(kg) || kg < 35 || kg > 200) {
      setActionError("体重需在 35–200 kg 之间。");
      return;
    }
    setBusyId(editing.id);
    try {
      const response = await fetch(`/api/weight/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kg, note: editing.note.trim() }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "体重记录没有更新成功，请稍后重试。");
      setEditing(null);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "体重记录没有更新成功，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/weight/${id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "体重记录没有删除成功，请稍后重试。");
      if (editing?.id === id) setEditing(null);
      setConfirmingId(null);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "体重记录没有删除成功，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  if (isPending) {
    return (
      <section className="surface weight-review" aria-labelledby="weight-review-title">
        <WeightReviewHead />
        <div className="weight-review-state">
          <Loader2 className="weight-spin" size={15} aria-hidden="true" />
          正在整理体重记录…
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="surface weight-review" aria-labelledby="weight-review-title">
        <WeightReviewHead />
        <div className="weight-review-state" role="alert">
          {error instanceof Error ? error.message : "暂时无法读取体重记录。"}
          <button className="link-button" onClick={() => void refetch()}>重试</button>
        </div>
      </section>
    );
  }

  if (entries.length === 0 && profilePoint) {
    return (
      <section className="surface weight-review" aria-labelledby="weight-review-title">
        <WeightReviewHead />
        <div className="weight-review-body weight-review-body--baseline">
          <div className="weight-review-main">
            <div className="weight-review-score">
              <div className="weight-review-score-main">
                <strong><WeightValue value={profilePoint.kg} /><span>kg</span></strong>
                <span className="weight-review-change">{formatWeightChange(null)}</span>
              </div>
              <small>来自资料填写</small>
            </div>
            <WeightTrendChart points={[profilePoint]} variant="panel" />
            <p className="chart-note">起点来自资料填写；记录第一笔后按日期累积。</p>
            {data.demo && <p className="chart-note">演示沙盒数据，仅存当前浏览器。</p>}
          </div>
          <div className="weight-review-history">
            <div className="weight-review-history-head">
              <strong>历史记录</strong>
              <span>共 0 笔</span>
            </div>
            <div className="weight-review-empty">
              <div>
                <strong>还没有体重记录</strong>
                <p>记下今天的体重，之后就能按日期看到变化。</p>
              </div>
              <button type="button" className="subtle-button" onClick={() => setPage("dashboard")}>去记录</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="surface weight-review" aria-labelledby="weight-review-title">
        <WeightReviewHead />
        <div className="weight-review-empty">
          <div>
            <strong>还没有体重记录</strong>
            <p>在今日概览的体重卡记下第一笔，趋势会从这里开始。</p>
          </div>
          <button type="button" className="subtle-button" onClick={() => setPage("dashboard")}>去记录</button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface weight-review" aria-labelledby="weight-review-title">
      <WeightReviewHead count={entries.length} />

      <div className="weight-review-body">
        <div className="weight-review-main">
          <div className="weight-review-score">
            <div className="weight-review-score-main">
              <strong><WeightValue value={latest.kg} /><span>kg</span></strong>
              <span className={`weight-review-change${change !== null && change > 0 ? " is-up" : ""}`}>
                {formatWeightChange(change)}
              </span>
            </div>
            <small>最近记录 {weightDateLabel(latest.dateKey)} {weekdayLabel(latest.dateKey)}</small>
          </div>

          <WeightTrendChart points={chartPoints} variant="panel" />
          {profilePoint && <p className="chart-note">资料体重作为趋势起点。</p>}
          {data.demo && <p className="chart-note">演示沙盒数据，仅存当前浏览器。</p>}
        </div>

        <div className="weight-review-history">
          <div className="weight-review-history-head">
            <strong>历史记录</strong>
            <span>{entries.length > RECENT_LIMIT ? `最近 ${RECENT_LIMIT} 笔` : `共 ${entries.length} 笔`}</span>
          </div>

          {actionError && <p className="weight-review-error" role="alert">{actionError}</p>}

          <ul className="weight-review-list">
            {recent.map((entry) => {
              const isEditing = editing?.id === entry.id;
              const isConfirming = confirmingId === entry.id;
              const busy = busyId === entry.id;
              return (
                <li key={entry.id} className={`weight-review-row${isEditing ? " is-editing" : ""}`}>
                  <div className="weight-review-date">
                    <strong>{weightDateLabel(entry.dateKey)}</strong>
                    <small>{entry.dateKey === todayKey ? "今天" : weekdayLabel(entry.dateKey)}</small>
                  </div>

                  {isEditing ? (
                    <form className="weight-review-edit" onSubmit={saveEdit}>
                      <label>
                        <span className="sr-only">体重（kg）</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={35}
                          max={200}
                          step="0.1"
                          value={editing.kg}
                          autoFocus
                          onChange={(event) => setEditing({ ...editing, kg: event.target.value })}
                        />
                      </label>
                      <label className="weight-review-edit-note">
                        <span className="sr-only">备注</span>
                        <input
                          type="text"
                          maxLength={100}
                          value={editing.note}
                          placeholder="备注"
                          onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                        />
                      </label>
                      <button type="submit" className="weight-review-icon is-save" disabled={busy} aria-label="保存修改">
                        {busy ? <Loader2 className="weight-spin" size={13} /> : <Check size={13} />}
                      </button>
                      <button
                        type="button"
                        className="weight-review-icon"
                        onClick={() => { setEditing(null); setActionError(""); }}
                        disabled={busy}
                        aria-label="取消修改"
                      >
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="weight-review-value">
                        <strong>{entry.kg.toFixed(1)} kg</strong>
                        {entry.note && <small>{entry.note}</small>}
                      </div>
                      <div className="weight-review-actions">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              className="weight-review-confirm"
                              onClick={() => void remove(entry.id)}
                              disabled={busy}
                            >
                              {busy ? "删除中…" : "确认删除"}
                            </button>
                            <button
                              type="button"
                              className="weight-review-plain"
                              onClick={() => setConfirmingId(null)}
                              disabled={busy}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="weight-review-icon"
                              aria-label={`编辑 ${weightDateLabel(entry.dateKey)} 的体重记录`}
                              onClick={() => {
                                setEditing({ id: entry.id, kg: entry.kg.toFixed(1), note: entry.note });
                                setConfirmingId(null);
                                setActionError("");
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="weight-review-icon"
                              aria-label={`删除 ${weightDateLabel(entry.dateKey)} 的体重记录`}
                              onClick={() => {
                                setConfirmingId(entry.id);
                                setEditing(null);
                                setActionError("");
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function WeightReviewHead({ count }: { count?: number }) {
  return (
    <header className="weight-review-head">
      <div>
        <span className="weight-review-tag">体重记录</span>
        <h2 id="weight-review-title">一笔一笔，看出自己的节奏。</h2>
      </div>
      {count !== undefined && <span className="goal-tag">{count} 笔</span>}
    </header>
  );
}
