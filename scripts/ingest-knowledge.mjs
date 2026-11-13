import "./load-env.mjs";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const CONTENT_FILE = "content/knowledge.json";
const MAX_CHARS = 280;
const MIN_CHARS = 40;
const EMBED_BATCH = 10;
const prune = process.argv.includes("--prune");

function chunkParagraph(text) {
  const sentences = text.match(/[^。！？；!?;]+[。！？；!?;]?/g) ?? [text];
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length <= MAX_CHARS) {
      current += sentence;
      continue;
    }
    if (current.trim()) chunks.push(current.trim());
    if (sentence.length <= MAX_CHARS) {
      current = sentence;
      continue;
    }
    for (let index = 0; index < sentence.length; index += MAX_CHARS) {
      const part = sentence.slice(index, index + MAX_CHARS).trim();
      if (part) chunks.push(part);
    }
    current = "";
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function chunkDocument(content) {
  const raw = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => (paragraph.length <= MAX_CHARS ? [paragraph] : chunkParagraph(paragraph)));

  const merged = [];
  for (const chunk of raw) {
    const previous = merged.at(-1);
    if (previous && chunk.length < MIN_CHARS && previous.length + 1 + chunk.length <= MAX_CHARS) {
      merged[merged.length - 1] = `${previous}\n${chunk}`;
    } else {
      merged.push(chunk);
    }
  }
  return merged;
}

async function loadDocuments() {
  const text = (await fs.readFile(CONTENT_FILE, "utf8")).replace(/^\uFEFF/, "");
  const documents = JSON.parse(text);
  if (!Array.isArray(documents) || !documents.length) throw new Error(`${CONTENT_FILE} 中没有可导入的文档。`);

  return documents.map((doc, index) => {
    const label = `文档 ${index + 1}`;
    if (!doc.title?.trim()) throw new Error(`${label} 缺少 title。`);
    if (!doc.source?.trim()) throw new Error(`${label} 缺少 source。`);
    if (!doc.content?.trim()) throw new Error(`${label} 缺少 content。`);
    if (!doc.reviewedAt || Number.isNaN(Date.parse(doc.reviewedAt))) throw new Error(`${label} 缺少有效的 reviewedAt。`);
    let url;
    try {
      url = new URL(doc.url);
    } catch {
      throw new Error(`${label} 缺少有效的官方来源 url。`);
    }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${label} 的来源 url 必须是 http(s)。`);

    return {
      title: doc.title.trim(),
      source: `${doc.source.trim()} · ${url.toString()}`,
      content: doc.content.trim(),
      reviewedAt: new Date(doc.reviewedAt),
    };
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL，无法建立知识库。");
  const baseURL = process.env.EMBEDDING_BASE_URL?.trim();
  if (!process.env.EMBEDDING_API_KEY || !baseURL) throw new Error("缺少 EMBEDDING_API_KEY 或 EMBEDDING_BASE_URL，无法向量化知识。");

  const documents = await loadDocuments();
  const chunks = documents.flatMap((doc) =>
    chunkDocument(doc.content).map((content) => ({
      id: `kc_${crypto.createHash("sha256").update(`${doc.title}\n${doc.source}\n${content}`).digest("hex").slice(0, 24)}`,
      title: doc.title,
      source: doc.source,
      content,
      reviewedAt: doc.reviewedAt,
    })),
  );

  const provider = createOpenAI({ apiKey: process.env.EMBEDDING_API_KEY, baseURL });
  const model = provider.embedding(process.env.EMBEDDING_MODEL || "text-embedding-v4");
  const vectors = [];
  for (let index = 0; index < chunks.length; index += EMBED_BATCH) {
    const batch = chunks.slice(index, index + EMBED_BATCH);
    const { embeddings } = await embedMany({
      model,
      values: batch.map((chunk) => `${chunk.title}\n${chunk.content}`),
    });
    vectors.push(...embeddings);
  }
  if (vectors.length !== chunks.length) throw new Error("向量数量与知识片段数量不一致。");
  const dimensions = new Set(vectors.map((vector) => vector.length));
  if (dimensions.size !== 1) throw new Error("同一批知识返回了不同维度的向量。");
  const dimension = [...dimensions][0];

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      await prisma.knowledgeChunk.upsert({
        where: { id: chunk.id },
        create: {
          id: chunk.id,
          title: chunk.title,
          source: chunk.source,
          content: chunk.content,
          embedding: vectors[index],
          reviewedAt: chunk.reviewedAt,
        },
        update: {
          title: chunk.title,
          source: chunk.source,
          content: chunk.content,
          embedding: vectors[index],
          reviewedAt: chunk.reviewedAt,
        },
      });
    }

    let pruned = 0;
    if (prune) {
      const result = await prisma.knowledgeChunk.deleteMany({ where: { id: { notIn: chunks.map((chunk) => chunk.id) } } });
      pruned = result.count;
    }

    console.log(`已写入 ${chunks.length} 个知识片段（来自 ${documents.length} 篇文档，${dimension} 维）${prune ? `，清理旧片段 ${pruned} 个` : ""}。`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
