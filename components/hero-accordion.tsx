"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";

export type HeroAccordionItem = {
  image: string;
  alt?: string;
};

type HeroAccordionProps = {
  items: HeroAccordionItem[];
  defaultIndex?: number;
  expandRatio?: number;
  duration?: number;
  ease?: string;
  parallax?: number;
  tilt?: number;
  autoPlayMs?: number;
  reduced?: boolean;
  className?: string;
};

export default function HeroAccordion({
  items,
  defaultIndex = 2,
  expandRatio = 0.5,
  duration = 0.9,
  ease = "power3.out",
  parallax = 0.5,
  tilt = 8,
  autoPlayMs = 7000,
  reduced = false,
  className = "",
}: HeroAccordionProps) {
  const count = items.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const mediaRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const firstRunRef = useRef(true);
  const interactedRef = useRef(false);
  const [requested, setActive] = useState(() =>
    Math.min(Math.max(defaultIndex, 0), Math.max(count - 1, 0))
  );
  const active = Math.min(Math.max(requested, 0), Math.max(count - 1, 0));
  const [mediaSize, setMediaSize] = useState(320);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const rect = root.getBoundingClientRect();
      const gap = parseFloat(window.getComputedStyle(root).columnGap) || 0;
      const usable = Math.max(rect.width - gap * (count - 1), 120);
      const ratio = Math.min(Math.max(expandRatio, 0.2), 0.9);
      setMediaSize(Math.max(140, usable * ratio * 1.22));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [count, expandRatio]);

  const applyLayout = useCallback(() => {
    if (!panelRefs.current.length) return;

    const ratio = Math.min(Math.max(expandRatio, 0.2), 0.9);
    const grow = count > 1 ? (ratio * (count - 1)) / (1 - ratio) : 1;
    const animate = !firstRunRef.current;
    const durationValue = animate && !reduced ? duration : 0;

    timelineRef.current?.kill();
    const timeline = gsap.timeline();

    panelRefs.current.forEach((panel, index) => {
      if (!panel) return;
      const isActive = index === active;
      const media = mediaRefs.current[index];
      const drift = Math.max(-1.5, Math.min(1.5, active - index));
      const shift = drift * parallax * mediaSize * 0.06;

      timeline.to(
        panel,
        {
          flexGrow: isActive ? grow : 1,
          rotateY: isActive ? 0 : index < active ? tilt : -tilt,
          "--hag-gray": isActive ? 0 : 0.35,
          "--hag-dim": isActive ? 0 : 0.12,
          duration: durationValue,
          ease,
        },
        0
      );

      if (media) {
        timeline.to(
          media,
          {
            xPercent: -50,
            yPercent: -50,
            x: isActive ? 0 : shift,
            duration: durationValue,
            ease,
          },
          0
        );
      }
    });

    timelineRef.current = timeline;
    firstRunRef.current = false;
  }, [active, count, duration, ease, expandRatio, mediaSize, parallax, reduced, tilt]);

  useEffect(() => {
    applyLayout();
    return () => {
      timelineRef.current?.kill();
    };
  }, [applyLayout]);

  useEffect(() => {
    if (!autoPlayMs || reduced || count < 2) return;
    const timer = window.setInterval(() => {
      if (interactedRef.current || document.hidden) return;
      setActive((current) => (current + 1) % count);
    }, autoPlayMs);
    return () => window.clearInterval(timer);
  }, [autoPlayMs, reduced, count]);

  const handleEnter = (index: number) => {
    interactedRef.current = true;
    setActive(index);
  };

  return (
    <div
      ref={rootRef}
      className={`hag${className ? ` ${className}` : ""}`}
      style={{ "--hag-media-size": `${mediaSize}px` } as CSSProperties}
      aria-hidden="true"
    >
      {items.map((item, index) => (
        <div
          key={`${item.image}-${index}`}
          ref={(node) => {
            panelRefs.current[index] = node;
          }}
          className={`hag-panel${index === active ? " is-active" : ""}`}
          onPointerEnter={() => handleEnter(index)}
        >
          <span
            className="hag-media"
            ref={(node) => {
              mediaRefs.current[index] = node;
            }}
          >
            <img
              src={item.image}
              alt={item.alt ?? ""}
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          </span>
          <span className="hag-overlay" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
