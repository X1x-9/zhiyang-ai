"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import { chinaTodayDateKey, getWeightEntries, weightDateLabel } from "@/lib/dashboard";

type RecordStatus = { kind: "idle" | "saving" | "ok" | "error"; text: string };

export function WeightRecordForm({ latestKg }: { latestKg: number | null }) {
  const queryClient = useQueryClient();
  const today = chinaTodayDateKey();
  const entriesQuery = useQuery({ queryKey: ["weight"], queryFn: getWeightEntries });
  const entries = entriesQuery.data?.entries ?? [];
  const [open, setOpen] = React.useState(false);
  const [dateKey, setDateKey] = React.useState(today);
  const [kg, setKg] = React.useState(latestKg !== null ? latestKg.toFixed(1) : "");
  const [note, setNote] = React.useState("");
  const [status, setStatus] = React.useState<RecordStatus>({ kind: "idle", text: "" });
  const kgTouched = React.useRef(false);

  React.useEffect(() => {
    if (!kgTouched.current && latestKg !== null && kg === "") setKg(latestKg.toFixed(1));
  }, [latestKg, kg]);

  const existing = entries.find((entry) => entry.dateKey === dateKey);
  const todayEntry = entries.find((entry) => entry.dateKey === today);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      if (next) {
        const todayRecord = entries.find((entry) => entry.dateKey === today);
        if (todayRecord && !note) setNote(todayRecord.note);
      }
      return next;
    });
  }

  function changeDate(next: string) {
    setDateKey(next);
    setStatus({ kind: "idle", text: "" });
    const record = entries.find((entry) => entry.dateKey === next);
    if (record) {
      setKg(record.kg.toFixed(1));
      setNote(record.note);
      kgTouched.current = true;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "saving") return;
    const value = Number(kg);
    if (!Number.isFinite(value) || value < 35 || value > 200) {
      setStatus({ kind: "error", text: "体重需在 35–200 kg 之间。" });
      return;
    }
    if (dateKey > today) {
      setStatus({ kind: "error", text: "体重不能记录在未来日期。" });
      return;
    }

    setStatus({ kind: "saving", text: "正在保存…" });
    try {
      const response = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey, kg: value, note: note.trim() }),
      });
      const result = (await response.json().catch(() => null)) as {
        entry?: { dateKey: string; kg: number };
        message?: string;
      } | null;
      if (!response.ok || !result?.entry) throw new Error(result?.message ?? "体重没有保存成功，请稍后重试。");
      void queryClient.invalidateQueries({ queryKey: ["weight"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      const dayLabel = result.entry.dateKey === today ? "今天" : weightDateLabel(result.entry.dateKey);
      setStatus({
        kind: "ok",
        text: `已${existing ? "更新" : "记录"}${dayLabel}的体重：${result.entry.kg.toFixed(1)} kg`,
      });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "体重没有保存成功，请稍后重试。" });
    }
  }

  return (
    <div className={`weight-record${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="weight-record-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="weight-record-form"
      >
        <span className="weight-record-toggle-icon" aria-hidden="true">
          {open ? <ChevronDown size={14} /> : <Plus size={14} />}
        </span>
        <span className="weight-record-toggle-text">
          {open ? "收起记录" : todayEntry ? "更新今天的体重" : "记录今天的体重"}
        </span>
        <span className="weight-record-toggle-meta">
          {todayEntry ? `今天已记 ${todayEntry.kg.toFixed(1)} kg` : latestKg !== null ? `最近 ${latestKg.toFixed(1)} kg` : "从第一笔开始"}
        </span>
      </button>

      {open && (
        <form id="weight-record-form" className="weight-record-form" onSubmit={submit}>
          <div className="weight-record-row">
            <label className="weight-field">
              <span>日期</span>
              <input type="date" value={dateKey} max={today} onChange={(event) => changeDate(event.target.value)} required />
            </label>
            <label className="weight-field">
              <span>体重 <small>kg</small></span>
              <input
                type="number"
                inputMode="decimal"
                min={35}
                max={200}
                step="0.1"
                value={kg}
                placeholder={latestKg !== null ? latestKg.toFixed(1) : "63.4"}
                onChange={(event) => {
                  kgTouched.current = true;
                  setKg(event.target.value);
                  setStatus((current) => current.kind === "error" ? { kind: "idle", text: "" } : current);
                }}
                required
              />
            </label>
          </div>
          <label className="weight-field">
            <span>备注 <small>选填</small></span>
            <input
              type="text"
              maxLength={100}
              value={note}
              placeholder="晨起空腹 / 晚饭后…"
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="weight-record-actions">
            <button type="submit" className="primary-button" disabled={status.kind === "saving"}>
              {status.kind === "saving" ? "正在保存…" : existing ? "更新这天" : "记下体重"}
            </button>
            {existing && <span className="weight-record-hint">这天已有记录，保存会覆盖。</span>}
          </div>
          {status.text && (
            <p className={`weight-record-status is-${status.kind}`} role="status">{status.text}</p>
          )}
        </form>
      )}
    </div>
  );
}
