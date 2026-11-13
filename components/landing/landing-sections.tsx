"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";
import type { Page } from "@/stores/health-store";
import GlimmerVale from "@/components/originkit/ui/hero-59/glimmer-vale";
import SphereGallery3D from "./sphere-gallery-3d";

type LandingSectionsProps = {
  onEnter: (page: Page) => void;
};

const modules = [
  { id: "module-food", page: "food", index: "01", label: "餐食记录" },
  { id: "module-plans", page: "plans", index: "02", label: "饮食计划" },
  { id: "module-exercise", page: "exercise", index: "03", label: "运动计划" },
  { id: "module-coach", page: "coach", index: "04", label: "AI 健康助手" },
  { id: "module-review", page: "review", index: "05", label: "每周复盘" },
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

function useReveal() {
  const reduce = useReducedMotion();
  return React.useCallback(
    (delay = 0) => ({
      initial: { opacity: 0, y: 26 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: false, amount: 0.3 } as const,
      transition: { duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay, ease },
    }),
    [reduce],
  );
}

function useParallax() {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 561px)");
    const sync = () => setEnabled(query.matches && !reduce);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [reduce]);

  return enabled;
}

function ModuleSection({
  meta,
  title,
  desc,
  points,
  cta,
  reverse,
  onEnter,
  children,
}: {
  meta: (typeof modules)[number];
  title: React.ReactNode;
  desc: string;
  points: React.ReactNode[];
  cta: string;
  reverse?: boolean;
  onEnter: LandingSectionsProps["onEnter"];
  children: React.ReactNode;
}) {
  const reveal = useReveal();
  const parallax = useParallax();
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const ghostY = useTransform(scrollYProgress, [0, 1], [-80, 80]);
  const copyY = useTransform(scrollYProgress, [0, 1], [-10, 10]);
  const mediaY = useTransform(scrollYProgress, [0, 1], [36, -36]);

  return (
    <section
      ref={sectionRef}
      className={`module-section${reverse ? " is-reverse" : ""}`}
      id={meta.id}
      aria-labelledby={`${meta.id}-title`}
    >
      <motion.div
        className="module-ghost"
        aria-hidden="true"
        style={parallax ? { y: ghostY } : undefined}
      >
        {meta.index}
      </motion.div>
      <div className="module-shell">
        <motion.div className="module-copy" style={parallax ? { y: copyY } : undefined}>
          <motion.p className="module-eyebrow" {...reveal(0)}>
            <span>{meta.index}</span>
            {meta.label}
          </motion.p>
          <motion.h2 className="module-title" id={`${meta.id}-title`} {...reveal(0.06)}>
            {title}
          </motion.h2>
          <motion.p className="module-desc" {...reveal(0.12)}>
            {desc}
          </motion.p>
          <motion.ul className="module-points" {...reveal(0.18)}>
            {points.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </motion.ul>
          <motion.div {...reveal(0.24)} className="module-action">
            <button type="button" className="module-cta" onClick={() => onEnter(meta.page)}>
              {cta}
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </motion.div>
        </motion.div>
        <motion.div className="module-media" style={parallax ? { y: mediaY } : undefined}>
          <motion.div className="module-media__inner" {...reveal(0.1)}>
            {children}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

const WEEK_PHOTOS = [
  "/images/landing/week/week-coast.webp",
  "/images/landing/week/week-salad-face.webp",
  "/images/landing/week/week-morning-run.webp",
  "/images/landing/week/week-hoop.webp",
  "/images/landing/week/week-lake.webp",
  "/images/landing/week/week-snow-run.webp",
  "/images/landing/week/week-salad-splash.webp",
  "/images/landing/week/week-sprint.webp",
  "/images/landing/week/week-forest.webp",
  "/images/landing/week/week-band-training.webp",
  "/images/landing/week/week-skate.webp",
  "/images/landing/week/week-wall-run.webp",
  "/images/landing/week/week-longboard.webp",
  "/images/landing/week/week-mushrooms.webp",
  "/images/landing/week/week-road-runner.webp",
  "/images/landing/week/week-sunset.webp",
  "/images/landing/week/week-leg-press.webp",
  "/images/landing/week/week-avenue-run.webp",
  "/images/landing/week/week-forest-glow.webp",
  "/images/landing/week/week-forest-rays.webp",
  "/images/landing/week/week-leaves-rays.webp",
  "/images/landing/week/week-heart-produce.webp",
  "/images/landing/week/week-produce-choice.webp",
  "/images/landing/week/week-swim.webp",
  "/images/landing/week/week-run-legs.webp",
  "/images/landing/week/week-boxer.webp",
  "/images/landing/week/week-cyclist.webp",
  "/images/landing/week/week-run-overhead.webp",
].map((image) => ({ image }));

function WeeklySphere() {
  return (
    <div className="ls-orb">
      <SphereGallery3D
        images={WEEK_PHOTOS}
        branches={WEEK_PHOTOS.length}
        background="transparent"
        scale={72}
        size={34}
        scatter={3}
        speed={9}
        direction="counterclockwise"
        hover={150}
        rounded={12}
        core={{ coreSize: 17, coreColor: "#8ea87f59", lineColor: "#4a684c59" }}
        style={{
          position: "absolute",
          inset: 0,
          width: "calc(100% + var(--orb-pad-x) * 2)",
          height: "calc(100% + var(--orb-pad-y) * 2)",
          margin: "auto",
        }}
      />
    </div>
  );
}

const FINAL_SCENE = {
  speed: 100,
  density: 60,
  sparkle: 60,
  background: "#f6f3e8",
  skyTop: "#f3f0e2",
  skyHorizon: "#f9f7ea",
  style: { minWidth: 0, minHeight: 0 },
  advanced: {
    loopSec: 9,
    waveHeight: 30,
    waveLength: 82,
    crestBright: 100,
    slopeBright: 98,
    pointSize: 95,
    twinkleSharp: 7,
    prismShare: 15,
    crestColor: "#f8f6e8",
    slopeColor: "#bcd1a7",
    slopeDeep: "#93b17f",
    hillShadow: "#5f7d52",
    glowColor: "#eef4e1",
    glowStrength: 55,
    hotspotX: 50,
    hotspotStrength: 60,
    skyMid: "#e6ecd4",
    horizonGlow: "#fdfbf0",
    horizonGlowStrength: 40,
    petalColor: "#fdfcf2",
    petalTip: "#e4ecd6",
    flowerCore: "#d6bd8a",
    flowerSize: 72,
    flowerBlur: 50,
    fringe: 15,
    sway: 35,
    midCount: 0,
    bokehCount: 0,
    grassCount: 340,
    glintCount: 0,
    grain: 10,
    vignette: 0,
    hover: 0,
    seed: 4,
  },
};

function FinalScene() {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [awake, setAwake] = React.useState(false);

  React.useEffect(() => {
    const node = hostRef.current;
    if (!node || awake) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setAwake(true);
          io.disconnect();
        }
      },
      { rootMargin: "480px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [awake]);

  return (
    <div className="landing-final__scene" ref={hostRef} aria-hidden="true">
      {awake ? <GlimmerVale {...FINAL_SCENE} /> : null}
    </div>
  );
}

type MochiMood = "awake" | "happy" | "dozing";

const MOCHI_BODY =
  "M94 40L266 40C317.2 40 330 52.8 330 104L330 280C330 331.2 317.2 344 266 344L94 344C42.8 344 30 331.2 30 280L30 104C30 52.8 42.8 40 94 40Z";

export function MochiFigure() {
  const reduce = useReducedMotion();
  const hostRef = React.useRef<HTMLDivElement>(null);
  const happyTimer = React.useRef<number | undefined>(undefined);
  const hopTimer = React.useRef<number | undefined>(undefined);
  const [mood, setMood] = React.useState<MochiMood>("awake");
  const [hopping, setHopping] = React.useState(false);
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gid = (name: string) => `mochi-${uid}-${name}`;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || reduce) return;

    let frame = 0;
    let lastActivity = performance.now();
    let lastGlance = 0;

    const applyGaze = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        host.style.setProperty("--mx", x.toFixed(3));
        host.style.setProperty("--my", y.toFixed(3));
      });
    };

    const look = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0) return;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      if (distance < 2) {
        applyGaze(0, 0);
      } else {
        const strength = Math.min(1, distance / 160);
        applyGaze((dx / distance) * strength, (dy / distance) * strength);
      }
      lastActivity = performance.now();
      setMood((current) => (current === "dozing" ? "awake" : current));
    };

    const restGaze = () => {
      applyGaze(0, 0);
    };

    const idle = window.setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      const quiet = now - lastActivity;
      if (quiet > 9000) {
        setMood((current) => (current === "awake" ? "dozing" : current));
        return;
      }
      if (quiet > 2400 && now - lastGlance > 2600) {
        lastGlance = now;
        const angle = Math.random() * Math.PI * 2;
        applyGaze(Math.cos(angle) * 0.85, Math.sin(angle) * 0.55);
      }
    }, 600);

    let lastY = window.scrollY;
    let lastT = performance.now();
    let hopCooldown = 0;
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dy = y - lastY;
      const dt = Math.max(8, now - lastT);
      lastY = y;
      lastT = now;
      if (dy > -18 || dy / dt > -1.1 || now < hopCooldown) return;
      hopCooldown = now + 1100;
      lastActivity = now;
      setMood((current) => (current === "dozing" ? "awake" : current));
      setHopping(true);
      window.clearTimeout(hopTimer.current);
      hopTimer.current = window.setTimeout(() => setHopping(false), 780);
    };

    window.addEventListener("pointermove", look, { passive: true });
    window.addEventListener("blur", restGaze);
    document.addEventListener("pointerleave", restGaze);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(idle);
      window.clearTimeout(happyTimer.current);
      window.clearTimeout(hopTimer.current);
      window.removeEventListener("pointermove", look);
      window.removeEventListener("blur", restGaze);
      document.removeEventListener("pointerleave", restGaze);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduce]);

  const tap = () => {
    if (reduce) return;
    setMood("happy");
    window.clearTimeout(happyTimer.current);
    happyTimer.current = window.setTimeout(() => setMood("awake"), 820);
  };

  return (
    <div
      className={`mochi is-${mood}${hopping ? " is-hop" : ""}`}
      ref={hostRef}
      role="img"
      aria-label="健康搭子的形象：一枚淡奶绿色软方块，眼睛会跟着指针转动"
      onPointerDown={tap}
    >
      <svg className="mochi__body" viewBox="0 0 360 400" aria-hidden="true">
        <defs>
          <radialGradient id={gid("fill")} cx="0.36" cy="0.18" r="0.96">
            <stop offset="0" stopColor="#FFFEF8" />
            <stop offset="0.25" stopColor="#FCFCF1" />
            <stop offset="0.45" stopColor="#F5F8E6" />
            <stop offset="0.65" stopColor="#EAF1D7" />
            <stop offset="0.82" stopColor="#DDE7C4" />
            <stop offset="0.92" stopColor="#D2DEB7" />
            <stop offset="1" stopColor="#C6D2AA" />
          </radialGradient>
          <radialGradient id={gid("glow")}>
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#FBFDEF" stopOpacity="0.22" />
            <stop offset="1" stopColor="#FBFDEF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gid("specular")}>
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={gid("rim")} x1="0.18" y1="0.02" x2="0.8" y2="1">
            <stop offset="0" stopColor="#6F7B66" stopOpacity="0" />
            <stop offset="0.38" stopColor="#6F7B66" stopOpacity="0.06" />
            <stop offset="0.66" stopColor="#616E58" stopOpacity="0.26" />
            <stop offset="1" stopColor="#53604E" stopOpacity="0.44" />
          </linearGradient>
          <linearGradient id={gid("rim-light")} x1="0.12" y1="0" x2="0.72" y2="0.9">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0.28" />
            <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={gid("side")} x1="0.55" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5D6A55" stopOpacity="0" />
            <stop offset="0.6" stopColor="#5D6A55" stopOpacity="0.04" />
            <stop offset="1" stopColor="#53604E" stopOpacity="0.22" />
          </linearGradient>
          <radialGradient id={gid("left-shade")}>
            <stop offset="0" stopColor="#6F7B66" stopOpacity="0.2" />
            <stop offset="1" stopColor="#6F7B66" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gid("bottom-shade")}>
            <stop offset="0" stopColor="#5D6A55" stopOpacity="0.32" />
            <stop offset="1" stopColor="#5D6A55" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gid("shadow")}>
            <stop offset="0" stopColor="#3E5647" stopOpacity="0.26" />
            <stop offset="0.6" stopColor="#3E5647" stopOpacity="0.12" />
            <stop offset="1" stopColor="#3E5647" stopOpacity="0" />
          </radialGradient>
          <filter id={gid("rim-blur")} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id={gid("light-blur")} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <clipPath id={gid("clip")}>
            <path d={MOCHI_BODY} />
          </clipPath>
        </defs>
        <ellipse className="mochi__shadow" cx="180" cy="368" rx="128" ry="17" fill={`url(#${gid("shadow")})`} />
        <g className="mochi__figure">
          <path d={MOCHI_BODY} fill={`url(#${gid("fill")})`} />
          <g clipPath={`url(#${gid("clip")})`}>
            <g className="mochi__sheen">
              <ellipse cx="146" cy="90" rx="92" ry="70" fill={`url(#${gid("glow")})`} />
              <ellipse cx="196" cy="62" rx="84" ry="28" fill={`url(#${gid("specular")})`} />
            </g>
            <path
              d={MOCHI_BODY}
              fill="none"
              stroke={`url(#${gid("rim")})`}
              strokeWidth="54"
              filter={`url(#${gid("rim-blur")})`}
            />
            <rect x="30" y="40" width="300" height="304" fill={`url(#${gid("side")})`} />
            <ellipse cx="22" cy="210" rx="54" ry="172" fill={`url(#${gid("left-shade")})`} />
            <ellipse cx="180" cy="352" rx="172" ry="66" fill={`url(#${gid("bottom-shade")})`} />
            <path
              d={MOCHI_BODY}
              fill="none"
              stroke={`url(#${gid("rim-light")})`}
              strokeWidth="22"
              filter={`url(#${gid("light-blur")})`}
            />
          </g>
          <g className="mochi__eyes">
            <g className="mochi__lid-state">
              <g className="mochi__eye">
                <rect className="mochi__eye-shape" x="120" y="153" width="24" height="42" rx="12" />
                <circle className="mochi__glint" cx="125.8" cy="165" r="3.6" />
              </g>
              <path className="mochi__happy" d="M112 182Q132 158 152 182" />
            </g>
            <g className="mochi__lid-state">
              <g className="mochi__eye">
                <rect className="mochi__eye-shape" x="216" y="153" width="24" height="42" rx="12" />
                <circle className="mochi__glint" cx="221.8" cy="165" r="3.6" />
              </g>
              <path className="mochi__happy" d="M208 182Q228 158 248 182" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

export function LandingSections({ onEnter }: LandingSectionsProps) {
  const [active, setActive] = React.useState<string>("hero");
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const hero = document.querySelector(".landing-shell .hero-38");
    const targets = [hero, ...modules.map((item) => document.getElementById(item.id))].filter(
      (item): item is Element => item != null,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!current) return;
        setActive(current.target.classList.contains("hero-38") ? "hero" : current.target.id);
      },
      { rootMargin: "-42% 0px -42% 0px", threshold: [0, 0.25, 0.6, 1] },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    if (id === "hero") {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="landing-sections">
      <nav className="landing-rail" aria-label="首页分区导航">
        <button
          type="button"
          className={active === "hero" ? "is-active" : ""}
          onClick={() => scrollTo("hero")}
          aria-label="回到首屏"
        >
          <span className="rail-dot" aria-hidden="true" />
          <span className="rail-label">首页</span>
        </button>
        {modules.map((item) => (
          <button
            type="button"
            key={item.id}
            className={active === item.id ? "is-active" : ""}
            onClick={() => scrollTo(item.id)}
            aria-label={`跳到${item.label}`}
          >
            <span className="rail-dot" aria-hidden="true" />
            <span className="rail-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <p className="landing-scroll-hint" aria-hidden="true">
        <ArrowDown size={14} />
        向下浏览五个模块
      </p>

      <ModuleSection
        meta={modules[0]}
        title={<>先记下来，<br />再谈吃得好不好</>}
        desc="拍照或手动记录一餐，识别与份量估算只有在你确认之后，才会计入当天的营养统计。还没有记录的日子，就让它保持空白。"
        points={[
          "拍照识别后可以逐项修改，确认才入账",
          "每餐保留食物来源与估算依据",
          "缺记录不补推，统计只认真实记录",
        ]}
        cta="记录第一餐"
        onEnter={onEnter}
      >
        <div className="meal-collage">
          <figure className="media-frame meal-collage__main">
            <Image
              src="/images/landing/meal-arch.webp"
              alt="拱形壁龛里摆着沙拉、香草和橄榄油"
              fill
              sizes="(max-width: 960px) 82vw, 36vw"
            />
            <figcaption className="media-tag">确认后才计入</figcaption>
          </figure>
          <figure className="media-frame meal-collage__inset">
            <Image
              src="/images/landing/meal-bean.webp"
              alt="一碗豆类蔬菜沙拉，旁边是一杯柠檬水"
              fill
              sizes="(max-width: 960px) 46vw, 20vw"
            />
          </figure>
          <p className="media-credit">图片示意</p>
        </div>
      </ModuleSection>

      <ModuleSection
        meta={modules[1]}
        reverse
        title={<>计划跟着<br />你的记录走</>}
        desc="根据你保存的身体画像与已有餐食记录，生成每天的三餐安排；不合适就重新生成，上一版会保留下来，方便对比。"
        points={[
          "按画像与已有记录生成，不从模板照抄",
          "三餐结构与营养目标可以逐日回看",
          "重新生成保留上一版，方便比较",
        ]}
        cta="查看饮食计划"
        onEnter={onEnter}
      >
        <figure
          className="diet-stack"
          tabIndex={0}
          aria-label="饮食计划示意：记录手账、每周计划与营养餐盘"
        >
          <div className="diet-stack__stage">
            <div className="diet-stack__card diet-stack__card--journal">
              <Image
                src="/images/landing/diet-plan-journal.webp"
                alt="白衬衫的人在手账上写下每周饮食计划，桌边放着记录餐食的手机和餐盘"
                fill
                sizes="(max-width: 700px) 40vw, (max-width: 980px) 38vw, 300px"
              />
            </div>
            <div className="diet-stack__card diet-stack__card--plan">
              <Image
                src="/images/landing/diet-plan.webp"
                alt="奶油白桌面上的周计划手账与分格餐盘"
                fill
                sizes="(max-width: 700px) 40vw, (max-width: 980px) 38vw, 300px"
              />
            </div>
            <div className="diet-stack__card diet-stack__card--bowl">
              <Image
                src="/images/landing/diet-plan-bowl.webp"
                alt="一碗鹰嘴豆、牛油果与小份谷物沙拉，旁边是一杯柠檬水"
                fill
                sizes="(max-width: 700px) 40vw, (max-width: 980px) 38vw, 300px"
              />
            </div>
          </div>
          <p className="media-credit diet-stack__credit">图片示意</p>
        </figure>
      </ModuleSection>

      <ModuleSection
        meta={modules[2]}
        title={<>能坚持的安排，<br />才算安排</>}
        desc="结合你的日常活动与训练偏好安排运动，完成一格亮一格；状态不好时可以调整，不必硬撑。"
        points={[
          "按可用时间安排，不堆强度",
          "训练完成状态逐项勾选",
          "饮食与运动安排放在同一处",
        ]}
        cta="打开运动计划"
        onEnter={onEnter}
      >
        <figure className="exercise-stack" aria-label="运动计划示意：户外慢跑、室内拉伸与居家训练">
          <div className="exercise-stack__card exercise-stack__card--run">
            <Image
              src="/images/landing/exercise-run.webp"
              alt="清晨在公园小路上慢跑的男性"
              fill
              sizes="(max-width: 700px) 50vw, 400px"
            />
          </div>
          <div className="exercise-stack__card exercise-stack__card--stretch">
            <Image
              src="/images/landing/exercise-stretch.webp"
              alt="在瑜伽垫上做侧向拉伸的女性"
              fill
              sizes="(max-width: 700px) 50vw, 400px"
            />
          </div>
          <div className="exercise-stack__card exercise-stack__card--mat">
            <Image
              src="/images/landing/exercise-plan.webp"
              alt="浅木地板上的鼠尾草绿瑜伽垫、哑铃和跳绳"
              fill
              sizes="(max-width: 700px) 50vw, 400px"
            />
          </div>
        </figure>
      </ModuleSection>

      <ModuleSection
        meta={modules[3]}
        reverse
        title={<>有出处，<br />才敢给建议</>}
        desc="健康搭子会先检索已入库的膳食指南与研究文献，再结合你的记录回答；建议附上出处，不做诊断，也不替代医生。"
        points={[
          "先检索，再回答",
          "每条建议附上文献出处",
          "遇到就医问题会明确建议线下就诊",
        ]}
        cta="和健康搭子聊聊"
        onEnter={onEnter}
      >
        <div className="ls-coach-visual">
          <MochiFigure />
        </div>
      </ModuleSection>

      <ModuleSection
        meta={modules[4]}
        title={<>这一周，<br />值得再看一眼</>}
        desc="吃了什么、动了几天、哪天记了，都在这一页。"
        points={[
          <>
            <span className="review-point__label">复盘</span>
            <span className="review-point__rule" aria-hidden="true" />
            <span className="review-point__text">一目了然</span>
          </>,
          <>
            <span className="review-point__label">成果</span>
            <span className="review-point__rule" aria-hidden="true" />
            <span className="review-point__text">持续进步</span>
          </>,
          <>
            <span className="review-point__label">反馈</span>
            <span className="review-point__rule" aria-hidden="true" />
            <span className="review-point__text">满满成就感</span>
          </>,
        ]}
        cta="翻开这周"
        onEnter={onEnter}
      >
        <WeeklySphere />
      </ModuleSection>

      <section className="landing-final" aria-labelledby="landing-final-title">
        <FinalScene />
        <p className="landing-final__kicker">从今天开始</p>
        <h2 id="landing-final-title">先记一餐，<br />其余慢慢来。</h2>
        <div className="landing-final__actions">
          <button type="button" className="module-cta" onClick={() => onEnter("food")}>
            记录第一餐
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="landing-final__ghost" onClick={() => onEnter("dashboard")}>
            先看看今日概览
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__brand">
          <span>智养<span className="landing-footer__ai">AI</span></span>
          <p>把身体的声音，放回生活里。</p>
        </div>
        <p className="landing-footer__note">仅提供日常健康管理建议，不替代专业医疗意见。</p>
        <button
          type="button"
          className="landing-footer__top"
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
        >
          回到顶部
          <ArrowUp size={15} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}