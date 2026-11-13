import { createOpenAI, openai } from "@ai-sdk/openai";
import { tool } from "ai";
import { z } from "zod";
import { assessHealthSafety } from "./ai-safety";
import { searchKnowledge, type KnowledgePassage } from "./rag";
import { getWeatherForecast as fetchWeatherForecast } from "./weather";

type HealthToolOptions = {
  onKnowledge?: (passages: KnowledgePassage[]) => void;
};

function createHealthToolSet({ onKnowledge }: HealthToolOptions = {}) {
  return {
    calculateNutrition: tool({
      description: "根据用户确认的食材、克数和每100克热量计算单餐营养估算。结果必须表述为估算，不是医疗建议。",
      inputSchema: z.object({ items: z.array(z.object({ name: z.string().min(1).max(80), amountGrams: z.number().min(0).max(3000), kcalPer100g: z.number().min(0).max(900) })).min(1).max(30) }),
      execute: async ({ items }) => {
        const kcal = items.reduce((sum, item) => sum + item.amountGrams * item.kcalPer100g / 100, 0);
        return { estimatedKcal: Math.round(kcal), rangeKcal: [Math.round(kcal * 0.85), Math.round(kcal * 1.2)], note: "视觉份量和烹饪用油可能造成较大误差，请用户确认。" };
      },
    }),
    searchWellnessKnowledge: tool({
      description: "检索审核过的通用健康知识；不得用于诊断或生成个体医疗处方。回答涉及健康知识时优先调用。",
      inputSchema: z.object({ query: z.string().trim().min(2).max(240) }),
      execute: async ({ query }) => {
        const result = await searchKnowledge(query);
        if (result.status === "OK" && result.passages.length) onKnowledge?.(result.passages);
        return result;
      },
    }),
    safetyCheck: tool({
      description: "检查健康问题是否涉及诊断、治疗、急症、饮食失调、自伤或特殊人群；高风险时转介专业人士。",
      inputSchema: z.object({ question: z.string().trim().min(1).max(2000) }),
      execute: async ({ question }) => {
        const assessment = assessHealthSafety(question);
        const risk = assessment.level === "emergency" ? "EMERGENCY" : assessment.level === "caution" ? "REFER" : "ROUTINE";
        const guidance = assessment.level === "emergency"
          ? "不作诊断或处方建议。请立即联系当地急救服务或前往急诊；如有自伤风险，联系急救与心理援助热线，并避免独处。"
          : assessment.level === "caution"
            ? "只提供一般生活方式信息，不作诊断、处方或剂量建议；建议咨询医生或注册营养师。"
            : "仅提供一般生活方式信息；避免承诺疗效。";
        return { risk, reasons: assessment.reasons, guidance };
      },
    }),
    getWeatherForecast: tool({
      description: "获取城市实时天气预报（默认今天，可查未来 1–3 天），用于回答天气与户外活动适宜性；实时数据不可用时会明确失败，不得编造天气。",
      inputSchema: z.object({ city: z.string().trim().min(2).max(60), days: z.number().int().min(1).max(3).optional() }),
      execute: async ({ city, days }) => {
        const result = await fetchWeatherForecast(city, days ?? 1);
        if (!result.ok) return { status: "UNAVAILABLE", message: result.note };
        return result;
      },
    }),
  };
}

export const healthTools = createHealthToolSet();

export function createHealthTools(options: HealthToolOptions = {}) {
  return createHealthToolSet(options);
}

export function getProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  return baseURL ? createOpenAI({ apiKey, baseURL }) : openai;
}

export function getModel() {
  const provider = getProvider();
  return provider(process.env.OPENAI_MODEL || "gpt-4.1-mini");
}

// Vision can use its own provider so it can be swapped independently of the
// chat model. Falls back to the chat provider when no dedicated config exists.
export function getVisionProvider() {
  const apiKey = process.env.VISION_API_KEY?.trim();
  const baseURL = process.env.VISION_BASE_URL?.trim();
  if (apiKey && baseURL) return createOpenAI({ apiKey, baseURL });
  return getProvider();
}

export function getVisionModel() {
  return getVisionProvider()(process.env.VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini");
}

export function isVisionConfigured() {
  return Boolean(process.env.VISION_API_KEY ? process.env.VISION_API_KEY : process.env.OPENAI_API_KEY);
}

export function isEmbeddingConfigured() {
  return Boolean(process.env.EMBEDDING_API_KEY && process.env.EMBEDDING_BASE_URL);
}

// Chat provider (e.g. DeepSeek) may not expose embeddings, so embeddings use
// their own credentials/base URL and never fall back to the chat provider.
export function getEmbeddingModel() {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const baseURL = process.env.EMBEDDING_BASE_URL?.trim();
  if (!apiKey || !baseURL) throw new Error("EMBEDDING_API_KEY / EMBEDDING_BASE_URL is not configured.");
  return createOpenAI({ apiKey, baseURL }).embedding(process.env.EMBEDDING_MODEL || "text-embedding-3-small");
}
