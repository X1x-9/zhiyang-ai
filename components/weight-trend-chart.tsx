"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import * as echarts from "echarts/core";
import { EffectScatterChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { WeightPoint } from "@/lib/dashboard";

echarts.use([LineChart, EffectScatterChart, GridComponent, TooltipComponent, CanvasRenderer]);

type WeightTrendChartProps = {
  points: WeightPoint[];
  variant?: "card" | "panel";
};

function buildOption(points: WeightPoint[], animated: boolean) {
  const values = points.map((point) => point.kg);
  const lastIndex = points.length - 1;
  const last = points[lastIndex];
  const single = points.length === 1;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const flat = maxValue - minValue < 0.2;
  const yAxis = single || flat
    ? {
        type: "value",
        min: Math.round((minValue - 1) * 10) / 10,
        max: Math.round((maxValue + 1) * 10) / 10,
        interval: 0.5,
        axisLabel: { color: "#75857a", fontSize: 9, formatter: (value: number) => value.toFixed(1) },
        splitLine: { lineStyle: { color: "rgba(95, 111, 100, .12)", type: [2, 5] } },
      }
    : {
        type: "value",
        scale: true,
        splitNumber: 3,
        axisLabel: { color: "#75857a", fontSize: 9, formatter: (value: number) => value.toFixed(1) },
        splitLine: { lineStyle: { color: "rgba(95, 111, 100, .12)", type: [2, 5] } },
      };
  return {
    animation: animated,
    animationDuration: 900,
    animationEasing: "cubicOut" as const,
    textStyle: { fontFamily: "Raleway, 'Noto Sans SC', sans-serif" },
    grid: { left: 34, right: 12, top: 16, bottom: 22 },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "rgba(250, 248, 242, .96)",
      borderColor: "rgba(120, 149, 122, .4)",
      borderWidth: 1,
      padding: [7, 10],
      textStyle: { color: "#31463a", fontSize: 11 },
      axisPointer: { type: "line", lineStyle: { color: "rgba(120, 149, 122, .45)", type: "dashed" } },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params];
        const item = list[0] as { axisValue?: string; data?: number } | undefined;
        if (!item || typeof item.data !== "number") return "";
        return `${item.axisValue ?? ""} · ${item.data.toFixed(1)} kg`;
      },
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      boundaryGap: false,
      axisLine: { lineStyle: { color: "rgba(95, 111, 100, .18)" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#75857a",
        fontSize: 9,
        margin: 8,
        interval: points.length > 8 ? Math.ceil(points.length / 6) : 0,
      },
    },
    yAxis,
    series: [
      {
        type: "line",
        data: values,
        smooth: 0.4,
        symbol: "circle",
        symbolSize: single ? 7 : 5,
        showSymbol: points.length <= 10,
        lineStyle: {
          width: 2.4,
          color: "#78957a",
          shadowColor: "rgba(120, 149, 122, .25)",
          shadowBlur: 6,
          shadowOffsetY: 3,
        },
        itemStyle: { color: "#78957a", borderColor: "#fbfcf8", borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(120, 149, 122, .32)" },
            { offset: 1, color: "rgba(120, 149, 122, 0)" },
          ]),
        },
        emphasis: { scale: 1.4 },
        z: 2,
      },
      {
        type: "effectScatter",
        data: [[lastIndex, last.kg]],
        symbolSize: 7,
        rippleEffect: { scale: 2.8, brushType: "stroke" },
        itemStyle: { color: "#78957a", borderColor: "#fbfcf8", borderWidth: 2 },
        tooltip: { show: false },
        silent: true,
        z: 3,
        animationDelay: 600,
      },
    ],
  };
}

export function WeightTrendChart({ points, variant = "card" }: WeightTrendChartProps) {
  const reduce = useReducedMotion();
  const hostRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<ReturnType<typeof echarts.init> | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const chart = chartRef.current;
    if (!chart || points.length === 0) return;
    chart.setOption(buildOption(points, !reduce), true);
  }, [points, reduce]);

  const first = points[0];
  const last = points[points.length - 1];
  const summary = first && last
    ? `体重趋势图，共 ${points.length} 次记录，从 ${first.kg.toFixed(1)} 千克到 ${last.kg.toFixed(1)} 千克。`
    : "还没有体重记录。";

  return (
    <div className={`weight-trend weight-trend--${variant}`}>
      <div ref={hostRef} className="weight-trend-canvas" role="img" aria-label={summary} />
      <ul className="sr-only">
        {points.map((point, index) => (
          <li key={`${point.label}-${index}`}>{point.label}：{point.kg.toFixed(1)} 千克</li>
        ))}
      </ul>
    </div>
  );
}

export function WeightValue({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(value);
  const previous = React.useRef(value);

  React.useEffect(() => {
    if (reduce) {
      previous.current = value;
      return;
    }
    const from = previous.current;
    if (from === value) {
      const frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 700);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previous.current = value;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      previous.current = value;
    };
  }, [value, reduce]);

  return <>{reduce ? value.toFixed(1) : display.toFixed(1)}</>;
}
