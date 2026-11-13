import fs from "node:fs/promises";

const endpoint = process.env.RAG_EVAL_URL || "http://localhost:3100/api/rag/eval";

function formatRate(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  let response;
  try {
    response = await fetch(endpoint, { method: "POST" });
  } catch {
    throw new Error(`无法连接 ${endpoint}，请先启动 dev 服务（端口 3100）。`);
  }
  const report = await response.json().catch(() => null);
  if (!response.ok || !report) {
    throw new Error(`评测失败（HTTP ${response.status}）：${report?.message ?? report?.error ?? "未知错误"}${report?.detail ? `\n${report.detail}` : ""}`);
  }

  await fs.mkdir(".rag-eval", { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(`.rag-eval/${stamp}.json`, json, "utf8");
  await fs.writeFile(".rag-eval/last-report.json", json, "utf8");

  console.log(`RAG 评测 · ${report.generatedAt}`);
  console.log(`语料 ${report.corpus.documents} 篇 / ${report.corpus.chunks} 个片段 · 向量模型 ${report.embeddingModel}`);
  console.log(`评测集 ${report.dataset.total} 条（正向 ${report.dataset.positives}，负向 ${report.dataset.negatives}）\n`);

  const header = ["策略", "Hit@3", "Hit@5", "MRR", "负向通过", "平均耗时"];
  const rows = Object.entries(report.strategies).map(([name, metrics]) => [
    name,
    formatRate(metrics.hitAt3),
    formatRate(metrics.hitAt5),
    metrics.mrr.toFixed(3),
    formatRate(metrics.negativePassRate),
    `${metrics.avgLatencyMs}ms`,
  ]);
  const widths = header.map((cell, index) => Math.max(cell.length, ...rows.map((row) => row[index].length)));
  const line = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join("  ");
  console.log(line(header));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(line(row));

  if (report.misses.length) {
    console.log(`\n未命中（hybrid 前 3）${report.misses.length} 条：`);
    for (const miss of report.misses) {
      console.log(`- ${miss.id} ${miss.query} → ${miss.expectTitle}（hybrid=${miss.hybridRank ?? "无"} vector=${miss.vectorRank ?? "无"} keyword=${miss.keywordRank ?? "无"}）`);
    }
  }
  if (report.falsePositives.length) {
    console.log(`\n负向误召回 ${report.falsePositives.length} 条：`);
    for (const item of report.falsePositives) {
      console.log(`- ${item.id} ${item.query} → ${item.strategies.join(" / ")}`);
    }
  }
  console.log("\n报告已写入 .rag-eval/last-report.json");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
