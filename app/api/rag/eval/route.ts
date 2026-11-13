import fs from "node:fs/promises";
import path from "node:path";
import { embed } from "ai";
import { NextResponse } from "next/server";
import { getEmbeddingModel } from "@/lib/ai-tools";
import { sanitizeError } from "@/lib/ai-logger";
import { getKnowledgeStats, isRagConfigured, searchKnowledge, type RetrievalStrategy } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type EvalCase = { id: string; query: string; expectTitle?: string };
type EvalFile = { version?: number; description?: string; queries: EvalCase[] };
type CaseResult = {
  id: string;
  query: string;
  expectTitle?: string;
  strategies: Record<RetrievalStrategy, {
    status: string;
    latencyMs: number;
    top: { title: string; similarity: number }[];
  }>;
};

const STRATEGIES: RetrievalStrategy[] = ["hybrid", "vector", "keyword"];
const TOP_K = 5;

function isEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.RAG_EVAL_ENABLED === "true";
}

async function loadCases() {
  const file = path.join(process.cwd(), "content", "rag-eval.json");
  const raw = (await fs.readFile(file, "utf8")).replace(/^\uFEFF/, "");
  const data = JSON.parse(raw) as EvalFile;
  if (!Array.isArray(data.queries) || !data.queries.length) throw new Error("评测集为空。");
  for (const [index, item] of data.queries.entries()) {
    if (!item || typeof item.id !== "string" || typeof item.query !== "string" || !item.query.trim()) {
      throw new Error(`评测集第 ${index + 1} 条缺少 id 或 query。`);
    }
    if (item.expectTitle !== undefined && typeof item.expectTitle !== "string") {
      throw new Error(`评测集第 ${index + 1} 条的 expectTitle 无效。`);
    }
  }
  return data.queries;
}

function rate(value: number) {
  return Number(value.toFixed(4));
}

export async function GET() {
  if (!isEnabled()) return NextResponse.json({ error: "NOT_AVAILABLE" }, { status: 404 });
  try {
    const cases = await loadCases();
    const corpus = await getKnowledgeStats().catch(() => null);
    return NextResponse.json({
      dataset: {
        total: cases.length,
        positives: cases.filter((item) => item.expectTitle).length,
        negatives: cases.filter((item) => !item.expectTitle).length,
      },
      corpus,
      note: "POST 到本路由运行评测；仅开发环境或 RAG_EVAL_ENABLED=true 时可用。",
    });
  } catch (error) {
    return NextResponse.json({ error: "EVAL_LOAD_FAILED", message: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST() {
  if (!isEnabled()) return NextResponse.json({ error: "NOT_AVAILABLE" }, { status: 404 });
  if (!isRagConfigured()) return NextResponse.json({ error: "RAG_NOT_CONFIGURED", message: "数据库或向量服务未配置，无法运行评测。" }, { status: 503 });

  try {
    const cases = await loadCases();
    const corpus = await getKnowledgeStats();
    const positives = cases.filter((item): item is EvalCase & { expectTitle: string } => Boolean(item.expectTitle));
    const negatives = cases.filter((item) => !item.expectTitle);
    const missingTitles = [...new Set(positives.map((item) => item.expectTitle))].filter((title) => !corpus.titles.includes(title));
    if (missingTitles.length) {
      return NextResponse.json({ error: "EVAL_TITLES_MISSING", missingTitles }, { status: 500 });
    }

    const results: Record<string, CaseResult> = {};
    for (const item of cases) {
      const { embedding } = await embed({ model: getEmbeddingModel(), value: item.query });
      const strategies = {} as CaseResult["strategies"];
      for (const strategy of STRATEGIES) {
        const started = performance.now();
        const result = await searchKnowledge(item.query, TOP_K, {
          strategy,
          queryEmbedding: strategy === "keyword" ? undefined : embedding,
          fallbackToKeyword: false,
        });
        strategies[strategy] = {
          status: result.status,
          latencyMs: Math.round(performance.now() - started),
          top: result.passages.slice(0, TOP_K).map((passage) => ({ title: passage.title, similarity: passage.similarity })),
        };
      }
      results[item.id] = { id: item.id, query: item.query, expectTitle: item.expectTitle, strategies };
    }

    const metrics = Object.fromEntries(STRATEGIES.map((strategy) => {
      let hitAt3 = 0;
      let hitAt5 = 0;
      let reciprocalRank = 0;
      let negativePass = 0;
      let latencyTotal = 0;
      for (const item of cases) {
        const result = results[item.id].strategies[strategy];
        latencyTotal += result.latencyMs;
        if (!item.expectTitle) {
          if (result.status === "NO_MATCH") negativePass += 1;
          continue;
        }
        const rank = result.top.findIndex((entry) => entry.title === item.expectTitle) + 1;
        if (rank >= 1 && rank <= 3) hitAt3 += 1;
        if (rank >= 1 && rank <= 5) hitAt5 += 1;
        if (rank >= 1) reciprocalRank += 1 / rank;
      }
      return [strategy, {
        hitAt3: rate(hitAt3 / positives.length),
        hitAt5: rate(hitAt5 / positives.length),
        mrr: rate(reciprocalRank / positives.length),
        negativePassRate: rate(negativePass / Math.max(1, negatives.length)),
        avgLatencyMs: Math.round(latencyTotal / cases.length),
      }];
    })) as Record<RetrievalStrategy, {
      hitAt3: number;
      hitAt5: number;
      mrr: number;
      negativePassRate: number;
      avgLatencyMs: number;
    }>;

    const misses = positives.flatMap((item) => {
      const strategies = results[item.id].strategies;
      const rank = strategies.hybrid.top.findIndex((entry) => entry.title === item.expectTitle) + 1;
      if (rank >= 1 && rank <= 3) return [];
      return [{
        id: item.id,
        query: item.query,
        expectTitle: item.expectTitle,
        hybridRank: rank || null,
        hybridTop: strategies.hybrid.top.map((entry) => entry.title),
        vectorRank: strategies.vector.top.findIndex((entry) => entry.title === item.expectTitle) + 1 || null,
        keywordRank: strategies.keyword.top.findIndex((entry) => entry.title === item.expectTitle) + 1 || null,
      }];
    });

    const falsePositives = negatives.flatMap((item) => {
      const strategies = results[item.id].strategies;
      const offenders = STRATEGIES.filter((strategy) => strategies[strategy].status === "OK");
      if (!offenders.length) return [];
      return [{
        id: item.id,
        query: item.query,
        strategies: offenders,
        tops: Object.fromEntries(offenders.map((strategy) => [strategy, strategies[strategy].top.map((entry) => entry.title)])),
      }];
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
      corpus: { chunks: corpus.chunks, documents: corpus.documents },
      dataset: { total: cases.length, positives: positives.length, negatives: negatives.length },
      strategies: metrics,
      misses,
      falsePositives,
      cases: Object.values(results),
    });
  } catch (error) {
    const detail = sanitizeError(error);
    console.error("[rag-eval] failed:", detail);
    return NextResponse.json({ error: "EVAL_FAILED", message: "评测执行失败，请查看服务端日志。", detail }, { status: 500 });
  }
}
