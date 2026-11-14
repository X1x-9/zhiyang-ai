"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Info } from "lucide-react";
import { Reveal } from "@/components/experience";

const guideCards = [
  {
    id: "plate",
    index: "01",
    tone: "plate",
    image: "/images/meals/meal-cover.webp",
    alt: "四格餐盘里装着鸡胸肉、杂粮饭、西兰花、彩椒和水果",
    eyebrow: "一餐比例",
    title: "把餐盘分成三块",
    panelTitle: "用眼睛估比例",
    rows: [
      { lead: "½", tail: "蔬菜和水果" },
      { lead: "¼", tail: "鱼、肉、蛋、豆" },
      { lead: "¼", tail: "米饭或杂粮" },
    ],
    note: "不必每餐称重，先看大致比例。",
  },
  {
    id: "nutrition",
    index: "02",
    tone: "nutrition",
    image: "/images/meals/nutrition-cover.webp",
    alt: "四种核心营养插画：碳水化合物、蛋白质、膳食纤维、维生素与微量元素",
    eyebrow: "核心营养",
    title: "四种营养，一起工作",
    panelTitle: "不只看热量",
    rows: [
      { lead: "碳水", tail: "能量来源" },
      { lead: "蛋白质", tail: "修复机体" },
      { lead: "膳食纤维", tail: "保护肠道" },
      { lead: "维生素 / 微量元素", tail: "参与代谢" },
    ],
    note: "单一营养素不能替代整体搭配。",
  },
  {
    id: "structure",
    index: "03",
    tone: "structure",
    image: "/images/meals/pyramid-cover-crop.webp",
    alt: "健康膳食金字塔插画：谷薯类在底层，向上依次是蔬菜水果、鱼禽肉蛋、奶豆坚果，顶层为油盐",
    eyebrow: "膳食结构",
    title: "五层结构，从底层读起",
    panelTitle: "从下往上，一层一层搭",
    rows: [
      { lead: "01", tail: "谷薯类，作为基础" },
      { lead: "02", tail: "蔬菜和水果，占多数" },
      { lead: "03", tail: "鱼、禽、肉、蛋，适量" },
      { lead: "04", tail: "奶、豆和坚果，补充" },
      { lead: "05", tail: "油、盐，控制用量" },
    ],
    note: "份量随年龄与活动量调整。",
  },
] as const;

export function FoodGuide() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="pp-section pp-food-guide" aria-labelledby="pp-food-guide-title">
      <header className="pp-sec-head">
        <div className="pp-sec-eyebrow">吃得明白</div>
        <h2 id="pp-food-guide-title">先搭好结构，再看每一口。</h2>
      </header>

      <Reveal>
        <div className="pp-taste-deck">
          {guideCards.map((card) => {
            const open = openId === card.id;
            return (
              <div className={`pp-taste-slot tone-${card.tone}`} key={card.id}>
                <button
                  type="button"
                  className={`pp-taste-card ${open ? "is-open" : ""}`}
                  aria-expanded={open}
                  aria-controls={`pp-taste-panel-${card.id}`}
                  aria-label={`${card.eyebrow}：${card.title}，${open ? "收起" : "展开"}要点`}
                  onClick={(event) => {
                    if (event.detail > 0 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
                    setOpenId((current) => (current === card.id ? null : card.id));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && open) {
                      event.stopPropagation();
                      setOpenId(null);
                    }
                  }}
                >
                  <span className="pp-taste-media">
                    <Image src={card.image} alt={card.alt} fill sizes="(max-width: 1280px) 340px, 360px" />
                    <span className="pp-taste-index" aria-hidden="true">{card.index}</span>
                  </span>

                  <span className="pp-taste-caption" aria-hidden="true">
                    <span className="pp-taste-eyebrow">{card.eyebrow}</span>
                    <strong className="pp-taste-title">{card.title}</strong>
                    <span className="pp-taste-more pp-is-fine">
                      悬停看要点
                      <ArrowUpRight size={11} />
                    </span>
                    <span className="pp-taste-more pp-is-coarse">
                      轻点看要点
                      <ArrowUpRight size={11} />
                    </span>
                  </span>

                  <span className="pp-taste-panel" id={`pp-taste-panel-${card.id}`}>
                    <span className="pp-taste-panel-eyebrow">{card.eyebrow}</span>
                    <strong className="pp-taste-panel-title">{card.panelTitle}</strong>
                    <span className="pp-taste-rows">
                      {card.rows.map((row) => (
                        <span className="pp-taste-row" key={`${row.lead}-${row.tail}`}>
                          <b>{row.lead}</b>
                          <span>{row.tail}</span>
                        </span>
                      ))}
                    </span>
                    <span className="pp-taste-note">{card.note}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <p className="pp-taste-disclaimer">
          <Info size={12} aria-hidden="true" />
          参考《中国居民膳食指南（2022）》；封面为通用示意，不构成营养处方。
        </p>
      </Reveal>
    </section>
  );
}
