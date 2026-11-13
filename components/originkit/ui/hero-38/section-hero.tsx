"use client";

import React from "react";
import Image from "next/image";
import ParticleSimulation from "@/components/originkit/ui/hero-38/particle-simulation";
import type { Page } from "@/stores/health-store";

type SectionHeroProps = {
  onEnter: (page: Page) => void;
};

const entryLinks = [
  { page: "food", label: "餐食记录" },
  { page: "plans", label: "饮食计划" },
  { page: "exercise", label: "运动计划" },
  { page: "coach", label: "健康搭子" },
  { page: "review", label: "每周复盘" },
] as const;

export function SectionHero({ onEnter }: SectionHeroProps) {
  const [posterVisible, setPosterVisible] = React.useState(true);
  const [introDone, setIntroDone] = React.useState(false);
  const posterTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), 1300);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(
    () => () => {
      if (posterTimer.current !== null) window.clearTimeout(posterTimer.current);
    },
    [],
  );

  const handleParticlesReady = React.useCallback(() => {
    if (posterTimer.current !== null) window.clearTimeout(posterTimer.current);
    posterTimer.current = window.setTimeout(() => setPosterVisible(false), 700);
  }, []);

  return (
    <div className={introDone ? "hero-38" : "hero-38 hero-38--intro"}>
      <section className="hero" aria-labelledby="hero38-title">
        <header className="nav">
          <button className="brand" type="button" onClick={() => onEnter("dashboard")} aria-label="进入智养 AI 今日概览">
            智养<span className="brand-ai">AI</span>
          </button>
          <nav className="nav-links" aria-label="核心功能">
            {entryLinks.map((item) => (
              <button key={item.page} type="button" onClick={() => onEnter(item.page)}>{item.label}</button>
            ))}
          </nav>
          <div className="nav-actions">
            <span className="hero-kicker">饮食 · 运动 · 复盘</span>
            <button className="download-btn" type="button" onClick={() => onEnter("profile")}>我的空间</button>
          </div>
        </header>
        <div className="ghost-word" aria-hidden="true">
          智养
        </div>
        <section
          className="visual"
          role="img"
          aria-label="苔藓覆盖的倒木盘成一个环，由细密粒子组成"
        >
          <Image
            className={posterVisible ? "visual__poster" : "visual__poster is-hidden"}
            src="/originkit/hero-38/tree.png"
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            preload
            unoptimized
            draggable={false}
          />
          <div className="visual__sim" id="visual-sim">
            <ParticleSimulation
              portraitImage="/originkit/hero-38/tree.png"
              background="transparent"
              density={50}
              dotSize={30}
              hover={{ reach: 30, lift: 51, damping: 58 }}
              style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
              onReady={handleParticlesReady}
            />
          </div>
        </section>
        <section className="bottom-layout">
          <div className="headline-block">
            <button className="dark-cta" type="button" onClick={() => onEnter("food")}>
              <span>从记录一餐开始</span>
              <span className="arrow">↗</span>
            </button>
            <h1 id="hero38-title">
              把身体的声音
              <br />
              放回生活里
            </h1>
          </div>
          <p className="intro">
            智养 AI 把餐食、计划、训练和每周复盘放在同一个空间里。
            从一餐开始，缺记录就保持空白，不猜、不补推。
          </p>
          <div className="stat-grid">
            <article className="stat-card">
              <button
                className="stat-card-button"
                type="button"
                onClick={() => onEnter("food")}
                aria-label="进入餐食记录"
              >
                <span className="stat-kicker">餐食记录</span>
                <span className="stat-number"><strong>一餐<span className="stat-unit">一拍</span></strong></span>
                <span className="stat-bottom">
                  <span className="stat-copy">拍照或手动记一餐，确认后计入统计。</span>
                  <span className="round-link" aria-hidden="true">↗</span>
                </span>
              </button>
            </article>
            <article className="stat-card">
              <button
                className="stat-card-button"
                type="button"
                onClick={() => onEnter("plans")}
                aria-label="进入饮食计划"
              >
                <span className="stat-kicker">饮食计划</span>
                <span className="stat-number"><strong>一天<span className="stat-unit">一安排</span></strong></span>
                <span className="stat-bottom">
                  <span className="stat-copy">按已有记录查看安排，不合适再调整。</span>
                  <span className="round-link" aria-hidden="true">↗</span>
                </span>
              </button>
            </article>
          </div>
        </section>
      </section>
    </div>
  );
}
