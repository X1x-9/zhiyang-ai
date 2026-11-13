"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Activity, ArrowUp, ChevronRight, Coffee, Droplets, Heart, Moon, NotebookPen, Pause, Play, Salad, Sparkles, Sun, Utensils, Wind, X } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduce ? 0 : 0.58, delay: reduce ? 0 : delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 130, damping: 25, restDelta: 0.001 });
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />;
}

export function HamsterLoader({ label, size = "md" }: { label: string; size?: "md" | "compact" | "mini" }) {
  const modifier = size === "md" ? "" : ` hamster-loader--${size}`;
  return (
    <div className={`hamster-loader${modifier}`} role="status" aria-live="polite">
      <div className="wheel-and-hamster" aria-hidden="true">
        <div className="wheel" />
        <div className="hamster">
          <div className="hamster__body">
            <div className="hamster__head">
              <div className="hamster__ear" />
              <div className="hamster__eye" />
              <div className="hamster__nose" />
            </div>
            <div className="hamster__limb hamster__limb--fr" />
            <div className="hamster__limb hamster__limb--fl" />
            <div className="hamster__limb hamster__limb--br" />
            <div className="hamster__limb hamster__limb--bl" />
            <div className="hamster__tail" />
          </div>
        </div>
        <div className="spoke" />
      </div>
      <p>{label}</p>
    </div>
  );
}

export function GrowingLoader({ label }: { label: string }) {
  return <HamsterLoader label={label} />;
}

const tips = [
  { tag: "饮食", title: "先看颜色，再看份量", body: "一餐里有几种颜色，通常更容易吃得丰富；份量以自己舒服为准。", icon: Utensils, theme: "sage" },
  { tag: "活动", title: "把久坐切成小段", body: "坐一阵子就起身接杯水、走两分钟，比一次性猛练更容易坚持。", icon: Activity, theme: "apricot" },
  { tag: "节奏", title: "给饱腹感一点时间", body: "吃到不饿、还没撑的时候停一停，身体会慢慢告诉你“够了”。", icon: Heart, theme: "rose" },
  { tag: "饮水", title: "让水杯留在视线里", body: "看不见就容易忘记。把水放在手边，每次经过喝一小口。", icon: Droplets, theme: "sky" },
  { tag: "休息", title: "睡前留十分钟空白", body: "关掉屏幕，做一点安静的收尾，让今天慢慢结束。", icon: Moon, theme: "lilac" },
  { tag: "早餐", title: "给早餐留十分钟", body: "哪怕只是酸奶加水果，坐下来吃完，也比边走边解决更从容。", icon: Coffee, theme: "apricot" },
  { tag: "日照", title: "白天出门走一走", body: "自然光帮身体分辨白天和夜晚；午饭后绕一小圈就很好。", icon: Sun, theme: "rose" },
  { tag: "放松", title: "慢慢呼吸三次", body: "把呼气放长一点，肩膀松下来。不是任务，只是给自己一个缓冲。", icon: Wind, theme: "sky" },
  { tag: "记录", title: "记录是为了看见", body: "不用追求满格，也不用每天完美。记录只是帮你了解自己的节奏。", icon: NotebookPen, theme: "lilac" },
  { tag: "蔬菜", title: "这周多试一种蔬菜", body: "不用大改菜单，在常吃的菜里加一样新的，就算一次小尝试。", icon: Salad, theme: "sky" },
] as const;

export function HealthTipsCarousel() {
  const [paused, setPaused] = React.useState(false);
  const count = tips.length;
  const angle = 360 / count;

  return (
    <section className="tips-section" aria-labelledby="tips-title">
      <div className="tips-head">
        <div>
          <div className="tips-eyebrow"><Sparkles size={13} /> 轻提示</div>
          <h2 id="tips-title">今天，给自己一个小提醒</h2>
        </div>
        <div className="tips-controls">
          <button
            type="button"
            className={`tips-toggle ${paused ? "is-paused" : ""}`}
            aria-label={paused ? "继续自动旋转" : "暂停自动旋转"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
            {paused ? "继续旋转" : "暂停旋转"}
          </button>
        </div>
      </div>

      <div className="tips-stage">
        <div className={`tips-ring ${paused ? "is-paused" : ""}`}>
          {tips.map((tip, index) => {
            const Icon = tip.icon;
            return (
              <article
                className={`tip-3d theme-${tip.theme}`}
                key={tip.title}
                style={{ transform: `rotateY(${index * angle}deg) translateZ(var(--tip-radius))` }}
              >
                <div className="tip-face tip-face--front">
                  <div className="tip-top">
                    <span className="tip-icon"><Icon size={20} strokeWidth={2} /></span>
                    <span className="tip-tag">{tip.tag}</span>
                  </div>
                  <h3>{tip.title}</h3>
                  <p>{tip.body}</p>
                </div>
                <div className="tip-face tip-face--back" aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Mascot() {
  const body =
    "M17.09 4H46.91C55.78 4 58 6.22 58 15.09V45.6C58 54.47 55.78 56.69 46.91 56.69H17.09C8.22 56.69 6 54.47 6 45.6V15.09C6 6.22 8.22 4 17.09 4Z";

  return (
    <svg viewBox="0 0 64 64" className="mascot-svg" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="mascot-body" cx="0.34" cy="0.14" r="0.98">
          <stop offset="0" stopColor="#fffef8" />
          <stop offset="0.28" stopColor="#fbfbef" />
          <stop offset="0.52" stopColor="#f2f7e2" />
          <stop offset="0.74" stopColor="#e2ecd0" />
          <stop offset="0.9" stopColor="#d0dcb4" />
          <stop offset="1" stopColor="#c2d0a4" />
        </radialGradient>
        <radialGradient id="mascot-glow">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mascot-bottom">
          <stop offset="0" stopColor="#5d6a55" stopOpacity=".3" />
          <stop offset="1" stopColor="#5d6a55" stopOpacity="0" />
        </radialGradient>
        <clipPath id="mascot-clip">
          <path d={body} />
        </clipPath>
      </defs>
      <ellipse cx="32" cy="60.4" rx="13.5" ry="2" fill="#3e5647" opacity=".14" />
      <path d={body} fill="url(#mascot-body)" />
      <g clipPath="url(#mascot-clip)">
        <ellipse cx="23" cy="12" rx="16" ry="11" fill="url(#mascot-glow)" />
        <ellipse cx="32" cy="56" rx="28" ry="11" fill="url(#mascot-bottom)" />
      </g>
      <path d={body} fill="none" stroke="#a9bb99" strokeOpacity=".55" strokeWidth=".7" />
      <rect x="21.6" y="23.3" width="4.15" height="7.2" rx="2.08" fill="#1f2a22" />
      <rect x="38.24" y="23.3" width="4.15" height="7.2" rx="2.08" fill="#1f2a22" />
      <circle cx="22.62" cy="25.4" r=".66" fill="#fffdf6" />
      <circle cx="39.26" cy="25.4" r=".66" fill="#fffdf6" />
    </svg>
  );
}

function clampCompanionPosition(element: HTMLElement | null, x: number, y: number) {
  const width = element?.offsetWidth ?? 58;
  const height = element?.offsetHeight ?? 58;
  const margin = 8;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  return {
    x: Math.min(Math.max(x, margin), Math.max(margin, viewportWidth - width - margin)),
    y: Math.min(Math.max(y, margin), Math.max(margin, viewportHeight - height - margin)),
  };
}

type CompanionDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

export function FloatingCompanion({ hidden, onOpen }: { hidden: boolean; onOpen: () => void }) {
  const [introOpen, setIntroOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const introDone = React.useRef(false);
  const dragRef = React.useRef<CompanionDrag | null>(null);
  const suppressClick = React.useRef(false);
  const leaveTimer = React.useRef<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const positioned = pos !== null;

  React.useEffect(() => {
    if (hidden || introDone.current) return;
    const timer = window.setTimeout(() => {
      introDone.current = true;
      setIntroOpen(true);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [hidden]);

  React.useEffect(() => {
    if (!introOpen) return;
    const timer = window.setTimeout(() => setIntroOpen(false), 7000);
    return () => window.clearTimeout(timer);
  }, [introOpen]);

  React.useEffect(() => {
    if (!positioned) return;
    const handleResize = () => {
      setPos((current) => (current ? clampCompanionPosition(rootRef.current, current.x, current.y) : current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [positioned]);

  React.useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      document.body.classList.remove("companion-dragging");
    },
    [],
  );

  const clearLeave = () => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const dismiss = () => {
    introDone.current = true;
    setIntroOpen(false);
    setHovered(false);
    setDismissed(true);
  };

  const openCoach = () => {
    setIntroOpen(false);
    setHovered(false);
    onOpen();
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    openCoach();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    suppressClick.current = false;
    if (!pos) setPos({ x: rect.left, y: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
    clearLeave();
    setDismissed(false);
    setHovered(true);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      suppressClick.current = true;
      document.body.classList.add("companion-dragging");
    }
    setPos(clampCompanionPosition(rootRef.current, drag.originX + dx, drag.originY + dy));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    document.body.classList.remove("companion-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (hidden) return null;

  const showBubble = !dismissed && !dragging && (introOpen || hovered);
  const alignLeft = positioned && pos.x < 200;
  const below = positioned && pos.y < 150;
  const className = [
    "companion",
    dragging ? "is-dragging" : "",
    below ? "companion--below" : "",
    alignLeft ? "companion--align-left" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={className}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
      onPointerEnter={() => {
        clearLeave();
        setDismissed(false);
        setHovered(true);
      }}
      onPointerLeave={() => {
        clearLeave();
        leaveTimer.current = window.setTimeout(() => {
          leaveTimer.current = null;
          setDismissed(false);
          setHovered(false);
        }, 160);
      }}
      onFocus={() => {
        clearLeave();
        setDismissed(false);
        setHovered(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
      }}
    >
      {showBubble && (
        <div className="companion-bubble" role="status">
          <button type="button" className="companion-close" aria-label="收起健康搭子的提示" onClick={dismiss}>
            <X size={12} />
          </button>
          <strong>健康搭子在这儿</strong>
          <span>今天想先聊饮食，还是训练？</span>
          <button type="button" className="companion-cta" onClick={openCoach}>去聊聊 <ChevronRight size={12} /></button>
        </div>
      )}
      <button
        type="button"
        className="companion-button"
        aria-label="打开 AI 健康助手，可拖动调整位置"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Mascot />
      </button>
    </div>
  );
}

export function BackToTop() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className={`back-to-top ${visible ? "visible" : ""}`}
      aria-label="回到顶部"
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
    >
      <ArrowUp size={15} /><span>顶部</span>
    </button>
  );
}
