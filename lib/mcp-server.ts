import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { assessHealthSafety } from "./ai-safety";
import { FOOD_DATA_SOURCE, FOOD_DATA_VERSION, matchFood, scaleNutrition } from "./food-data";
import { searchKnowledge } from "./rag";
import { getWeatherForecast } from "./weather";

const searchPassageSchema = z.object({
  index: z.number(),
  title: z.string(),
  source: z.string(),
  content: z.string(),
  similarity: z.number(),
});

const searchOutputSchema = z.object({
  status: z.enum(["OK", "NO_MATCH", "NOT_CONFIGURED", "RETRIEVAL_FAILED"]),
  strategy: z.enum(["hybrid", "vector", "keyword"]),
  passages: z.array(searchPassageSchema),
  note: z.string(),
});

const nutritionItemSchema = z.object({
  name: z.string().min(1).max(80),
  amountGrams: z.number().min(1).max(3000),
  kcalPer100g: z.number().min(0).max(900).optional(),
  proteinPer100g: z.number().min(0).max(100).optional(),
  carbsPer100g: z.number().min(0).max(100).optional(),
  fatPer100g: z.number().min(0).max(100).optional(),
});

const nutritionOutputSchema = z.object({
  status: z.enum(["OK", "PARTIAL", "NO_MATCH"]),
  items: z.array(z.object({
    name: z.string(),
    amountGrams: z.number(),
    source: z.enum(["provided", "food-table"]),
    matchedName: z.string().nullable(),
    matchScore: z.number().nullable(),
    nutrition: z.object({
      kcal: z.number(),
      proteinG: z.number().nullable(),
      carbsG: z.number().nullable(),
      fatG: z.number().nullable(),
    }).nullable(),
  })),
  totals: z.object({
    kcal: z.number(),
    proteinG: z.number().nullable(),
    carbsG: z.number().nullable(),
    fatG: z.number().nullable(),
  }).nullable(),
  partialMacros: z.boolean(),
  rangeKcal: z.array(z.number()).nullable(),
  unresolved: z.array(z.string()),
  foodDataVersion: z.string(),
  foodDataSource: z.string(),
  note: z.string(),
});

const safetyOutputSchema = z.object({
  level: z.enum(["emergency", "caution", "routine"]),
  risk: z.enum(["EMERGENCY", "REFER", "ROUTINE"]),
  reasons: z.array(z.string()),
  guidance: z.string(),
});

const weatherOutputSchema = z.object({
  ok: z.boolean(),
  provider: z.enum(["open-meteo", "amap"]),
  city: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  days: z.array(z.object({
    date: z.string(),
    weather: z.string(),
    tempMaxC: z.number().nullable(),
    tempMinC: z.number().nullable(),
    precipitationProbability: z.number().nullable(),
    windText: z.string(),
    windSpeedMaxKmh: z.number().nullable(),
    outdoorHint: z.string(),
  })),
  fetchedAt: z.string(),
  note: z.string(),
});

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export function createHealthMcpServer() {
  const server = new McpServer({ name: "zhiyang-health", version: "1.0.0" });

  server.registerTool(
    "search_wellness_knowledge",
    {
      title: "检索健康知识库",
      description: "检索智养 AI 已审核的通用健康知识库，覆盖膳食指南、身体活动、睡眠与同行评审文献。用于回答饮食、运动、睡眠等健康知识；不用于疾病诊断或个体医疗处方。",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(240).describe("检索问题或关键词"),
        limit: z.number().int().min(1).max(8).optional().describe("返回片段数，默认 6"),
      }),
      outputSchema: searchOutputSchema,
    },
    async ({ query, limit }) => {
      const result = await searchKnowledge(query, limit ?? 6);
      const passages = result.passages.map((passage) => ({
        index: passage.index,
        title: passage.title,
        source: passage.source,
        content: passage.content,
        similarity: Number(passage.similarity.toFixed(4)),
      }));
      const structuredContent = {
        status: result.status,
        strategy: result.strategy,
        passages,
        note: result.note,
      };
      const text = passages.length
        ? `${result.note}\n${passages.map((passage) => `[${passage.index}] ${passage.title}（${passage.source}）\n${passage.content}`).join("\n\n")}`
        : result.note;
      return { content: [{ type: "text", text }], structuredContent };
    },
  );

  server.registerTool(
    "calculate_nutrition",
    {
      title: "计算营养估算",
      description: "计算一餐或一天的营养估算。优先按食材名称匹配内置食物成分库（每 100g 参考值）；匹配不到时可传入 kcalPer100g 等参考值。结果为估算，不是医疗建议。",
      inputSchema: z.object({
        items: z.array(nutritionItemSchema).min(1).max(30).describe("食材与克数；可选每 100g 营养参考值"),
      }),
      outputSchema: nutritionOutputSchema,
    },
    async ({ items }) => {
      const resolved = items.map((item) => {
        if (item.kcalPer100g !== undefined) {
          const ratio = item.amountGrams / 100;
          return {
            name: item.name,
            amountGrams: item.amountGrams,
            source: "provided" as const,
            matchedName: item.name,
            matchScore: null,
            nutrition: {
              kcal: Math.round(item.kcalPer100g * ratio),
              proteinG: item.proteinPer100g === undefined ? null : round1(item.proteinPer100g * ratio),
              carbsG: item.carbsPer100g === undefined ? null : round1(item.carbsPer100g * ratio),
              fatG: item.fatPer100g === undefined ? null : round1(item.fatPer100g * ratio),
            },
          };
        }

        const match = matchFood(item.name);
        if (!match) {
          return {
            name: item.name,
            amountGrams: item.amountGrams,
            source: "food-table" as const,
            matchedName: null,
            matchScore: null,
            nutrition: null,
          };
        }
        const nutrition = scaleNutrition(match.food.per100, item.amountGrams);
        return {
          name: item.name,
          amountGrams: item.amountGrams,
          source: "food-table" as const,
          matchedName: match.food.name,
          matchScore: match.score,
          nutrition: {
            kcal: nutrition.kcal,
            proteinG: nutrition.proteinG,
            carbsG: nutrition.carbsG,
            fatG: nutrition.fatG,
          },
        };
      });

      const resolvedItems = resolved.filter((item) => item.nutrition !== null);
      const unresolved = resolved.filter((item) => item.nutrition === null).map((item) => item.name);
      const status = resolvedItems.length === 0 ? "NO_MATCH" : unresolved.length ? "PARTIAL" : "OK";
      const macroTotals = (field: "proteinG" | "carbsG" | "fatG") => {
        const values = resolvedItems
          .map((item) => item.nutrition?.[field])
          .filter((value): value is number => typeof value === "number");
        return values.length ? round1(values.reduce((sum, value) => sum + value, 0)) : null;
      };
      const partialMacros = resolvedItems.some((item) => item.nutrition && (
        item.nutrition.proteinG === null || item.nutrition.carbsG === null || item.nutrition.fatG === null
      ));
      const totals = resolvedItems.length
        ? {
          kcal: resolvedItems.reduce((sum, item) => sum + (item.nutrition?.kcal ?? 0), 0),
          proteinG: macroTotals("proteinG"),
          carbsG: macroTotals("carbsG"),
          fatG: macroTotals("fatG"),
        }
        : null;
      const rangeKcal = totals
        ? [Math.round(totals.kcal * 0.85), Math.round(totals.kcal * 1.2)]
        : null;
      const note = "热量与营养为估算值；食物库按名称匹配，烹饪方式、用油和实际份量都会带来误差，不能替代医疗营养处方。";

      const structuredContent = {
        status,
        items: resolved,
        totals,
        partialMacros,
        rangeKcal,
        unresolved,
        foodDataVersion: FOOD_DATA_VERSION,
        foodDataSource: FOOD_DATA_SOURCE,
        note,
      };

      const lines: string[] = [];
      if (totals && rangeKcal) {
        lines.push(`估算总热量 ${totals.kcal} kcal（参考区间 ${rangeKcal[0]}–${rangeKcal[1]} kcal）。`);
        const macroParts = [
          totals.proteinG === null ? null : `蛋白质 ${totals.proteinG} g`,
          totals.carbsG === null ? null : `碳水 ${totals.carbsG} g`,
          totals.fatG === null ? null : `脂肪 ${totals.fatG} g`,
        ].filter(Boolean);
        if (macroParts.length) lines.push(`${macroParts.join(" · ")}${partialMacros ? "（部分项目缺少宏量营养数据）" : ""}。`);
      } else {
        lines.push("没有匹配到可用食物，也没有提供每 100g 热量参考值，无法给出热量估算。");
      }
      const matchedCount = resolvedItems.length;
      lines.push(`已匹配 ${matchedCount}/${items.length} 项。`);
      if (unresolved.length) lines.push(`未匹配：${unresolved.join("、")}。可补充每 100g 热量后重试。`);
      lines.push(note);

      return { content: [{ type: "text", text: lines.join("\n") }], structuredContent };
    },
  );

  server.registerTool(
    "safety_check",
    {
      title: "健康安全核对",
      description: "检查健康问题是否涉及急症、自伤、疾病诊断或治疗、饮食失调、孕期等特殊人群。高风险时应按 guidance 转介专业帮助。",
      inputSchema: z.object({
        question: z.string().trim().min(1).max(2000).describe("用户原始健康问题"),
      }),
      outputSchema: safetyOutputSchema,
    },
    async ({ question }) => {
      const assessment = assessHealthSafety(question);
      const risk = assessment.level === "emergency" ? "EMERGENCY" : assessment.level === "caution" ? "REFER" : "ROUTINE";
      const guidance = assessment.level === "emergency"
        ? "不作诊断或处方建议。请立即联系当地急救服务或前往急诊；如有自伤风险，联系急救与心理援助热线，并避免独处。"
        : assessment.level === "caution"
          ? "只提供一般生活方式信息，不作诊断、处方或剂量建议；建议咨询医生或注册营养师。"
          : "仅提供一般生活方式信息；避免承诺疗效。";
      const structuredContent = { level: assessment.level, risk, reasons: assessment.reasons, guidance };
      return {
        content: [{ type: "text", text: `风险等级：${risk}\n原因：${assessment.reasons.join("；") || "未命中高风险规则"}\n要求：${guidance}` }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "get_weather_forecast",
    {
      title: "查询城市天气",
      description: "获取城市实时天气预报（默认今天，可查未来 1–3 天），用于回答天气与户外活动适宜性。实时数据不可用时会明确失败，不得编造天气。",
      inputSchema: z.object({
        city: z.string().trim().min(2).max(60).describe("中国城市名，如「北京」「杭州」"),
        days: z.number().int().min(1).max(3).optional().describe("预报天数，默认 1"),
      }),
      outputSchema: weatherOutputSchema,
    },
    async ({ city, days }) => {
      const result = await getWeatherForecast(city, days ?? 1);
      if (!result.ok) return errorResult(result.note);
      const text = [
        `${result.city ?? city}${result.region ? `（${result.region}）` : ""} · ${result.provider}`,
        ...result.days.map((day) => `${day.date}：${day.weather}，${day.tempMinC ?? "?"}–${day.tempMaxC ?? "?"}°C${day.precipitationProbability === null ? "" : `，降水概率 ${day.precipitationProbability}%`}，${day.windText}。${day.outdoorHint}。`),
        result.note,
      ].join("\n");
      return { content: [{ type: "text", text }], structuredContent: result };
    },
  );

  return server;
}
