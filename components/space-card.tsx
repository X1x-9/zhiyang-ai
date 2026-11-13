"use client";

import * as React from "react";
import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";
import type { Page } from "@/stores/health-store";
import {
  goalText,
  rhythmText,
  spaceCompleteness,
  type SpaceProfile,
} from "@/lib/space";

type SpaceShortcut = {
  id: Page;
  label: string;
  icon: LucideIcon;
};

type SpaceCardProps = {
  profile: SpaceProfile;
  saved: boolean;
  demo: boolean;
  active: boolean;
  shortcuts: readonly SpaceShortcut[];
  onOpen: () => void;
  onNavigate: (page: Page) => void;
};

export function SpaceCard({ profile, saved, demo, active, shortcuts, onOpen, onNavigate }: SpaceCardProps) {
  const [hubOpen, setHubOpen] = React.useState(false);
  const hubTriggerRef = React.useRef<HTMLButtonElement>(null);
  const hoverBlockedRef = React.useRef(false);
  const completeness = spaceCompleteness(profile);
  const name = profile.name.trim();
  const initial = name.slice(0, 1) || "你";
  const source = saved ? (demo ? "已保存到演示沙盒" : "已保存到账户") : demo ? "演示资料 · 未保存" : "尚未填写";
  const missing = completeness.missing;
  const missingText = missing.length === 0
    ? "资料已齐，计划会跟着你的修改更新。"
    : `还差 ${missing.slice(0, 3).join("、")}${missing.length > 3 ? ` 等 ${missing.length} 项` : ""}`;
  const progress = Math.round((completeness.filled / completeness.total) * 100);

  return (
    <div className="space-dock">
      <div
        className={`space-card${hubOpen ? " is-hub-open" : ""}`}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHubOpen(false);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHubOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !hubOpen) return;
          event.stopPropagation();
          hoverBlockedRef.current = true;
          setHubOpen(false);
          hubTriggerRef.current?.focus();
        }}
      >
        <button
          type="button"
          className="space-card-bar"
          onClick={onOpen}
          aria-current={active ? "page" : undefined}
          aria-label={`进入我的空间。${name || "尚未填写称呼"}，资料已填 ${completeness.filled} / ${completeness.total} 项，${source}`}
        >
          <span className="space-card-avatar" aria-hidden="true">{initial}</span>
          <span className="space-card-name">
            <strong>{name || "你的空间"}</strong>
            <small>{goalText(profile.goal)} · 资料 {completeness.filled}/{completeness.total}</small>
          </span>
          <ChevronRight size={15} className="space-card-chev" aria-hidden="true" />
        </button>

        <div className="space-card-panel">
          <div className="space-card-face">
            <button
              type="button"
              ref={hubTriggerRef}
              className="space-card-avatar space-card-avatar-lg space-card-avatar-btn"
              aria-expanded={hubOpen}
              aria-controls="space-hub-menu"
              aria-label={`打开模块快捷入口。${name || "尚未填写称呼"}`}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse" && !hoverBlockedRef.current) setHubOpen(true);
              }}
              onPointerLeave={() => {
                hoverBlockedRef.current = false;
              }}
              onClick={() => {
                if (hubOpen) {
                  hoverBlockedRef.current = true;
                  setHubOpen(false);
                } else {
                  setHubOpen(true);
                }
              }}
            >
              {initial}
            </button>
            <span>
              <strong>{name || "还没有称呼"}</strong>
              <small>{source}</small>
            </span>
          </div>
          <p className="space-card-goal">
            {rhythmText(profile)}
          </p>
          <div className="space-card-meter">
            <div><span>资料完整度</span><b>{completeness.filled}/{completeness.total}</b></div>
            <span
              className="space-card-track"
              role="progressbar"
              aria-label="资料完整度"
              aria-valuenow={completeness.filled}
              aria-valuemin={0}
              aria-valuemax={completeness.total}
            >
              <i style={{ width: `${progress}%` }} />
            </span>
          </div>
          <p className="space-card-missing">{missingText}</p>
          <button type="button" className="space-card-enter" tabIndex={hubOpen ? -1 : undefined} onClick={onOpen}>
            进入我的空间 <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>

        <div
          id="space-hub-menu"
          className={`space-hub${hubOpen ? " is-open" : ""}`}
          role="group"
          aria-label="模块快捷入口"
        >
          <div className="space-hub-wheel">
            <button
              type="button"
              className="space-hub-core"
              aria-label={`进入我的空间。${name || "尚未填写称呼"}`}
              onClick={() => {
                setHubOpen(false);
                onOpen();
              }}
            >
              <span aria-hidden="true">{initial}</span>
              <small aria-hidden="true">我的空间</small>
            </button>
            {shortcuts.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                type="button"
                className={`space-hub-item pos-${index}`}
                style={{ "--hub-i": index } as React.CSSProperties}
                aria-label={`前往${label}`}
                onClick={() => {
                  setHubOpen(false);
                  onNavigate(id);
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="space-hub-tip" aria-hidden="true">{label}</span>
              </button>
            ))}
          </div>
          <p className="space-hub-hint" aria-hidden="true">选择模块，前往对应页面</p>
        </div>
      </div>
    </div>
  );
}
