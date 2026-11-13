import "./load-env.mjs";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, embed } from "ai";

if (!process.env.OPENAI_API_KEY) {
  console.log("CHAT_FAIL 缺少 OPENAI_API_KEY");
  process.exit(1);
}

const baseURL = process.env.OPENAI_BASE_URL?.trim();
const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY, ...(baseURL ? { baseURL } : {}) });

try {
  const { text } = await generateText({
    model: provider(process.env.OPENAI_MODEL || "gpt-4.1-mini"),
    prompt: "只回复两个字：可用",
    maxOutputTokens: 16,
  });
  console.log("CHAT_OK", JSON.stringify(text.trim()));
} catch (error) {
  console.log("CHAT_FAIL", error.message);
  process.exitCode = 1;
}

if (process.env.EMBEDDING_API_KEY && process.env.EMBEDDING_BASE_URL) {
  try {
    const model = createOpenAI({ apiKey: process.env.EMBEDDING_API_KEY, baseURL: process.env.EMBEDDING_BASE_URL.trim() }).embedding(process.env.EMBEDDING_MODEL || "text-embedding-3-small");
    const { embedding } = await embed({ model, value: "健康饮食" });
    console.log("EMBED_OK dims:", embedding.length);
  } catch (error) {
    console.log("EMBED_FAIL", error.message);
    process.exitCode = 1;
  }
} else {
  console.log("EMBED_SKIPPED 未配置 EMBEDDING_API_KEY/EMBEDDING_BASE_URL");
}
