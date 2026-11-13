import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type AiLogOutcome = "ok" | "blocked" | "error";

export type AiUsageSnapshot = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type AiStepSnapshot = {
  stepNumber: number;
  finishReason: string;
  usage?: AiUsageSnapshot;
  latencyMs?: number | null;
  toolCalls?: ReadonlyArray<{ toolCallId?: string; toolName?: string }>;
  toolResults?: ReadonlyArray<{ toolCallId?: string; toolName?: string }>;
};

type AiLogEntry = {
  ts: string;
  requestId: string;
  route: string;
  model: string;
  actor: string | null;
  outcome: AiLogOutcome;
  reason: string | null;
  latencyMs: number;
  safety: { level: string; reasons: string[] };
  request: { messages: number; latestUserChars: number; reaction: string | null };
  steps: AiStepSnapshot[];
  toolSequence: string[];
  usage: AiUsageSnapshot;
  finishReason: string | null;
  textChars: number | null;
  error: string | null;
  notes: string[];
};

type AiLoggerContext = {
  route: string;
  model: string;
  actorId?: string | null;
  safety: { level: string; reasons: string[] };
  messageCount: number;
  latestUserChars: number;
  reaction?: string | null;
};

type FinishInput = {
  outcome: AiLogOutcome;
  reason?: string;
  usage?: AiUsageSnapshot;
  finishReason?: string | null;
  textChars?: number;
  error?: unknown;
  notes?: string[];
};

function hashActor(actorId?: string | null) {
  if (!actorId) return null;
  return createHash("sha256").update(actorId).digest("hex").slice(0, 12);
}

export function sanitizeError(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "unknown";
  return `${name}: ${message}`
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(/\b(?:sk|ms|ak|api)[-_][a-z0-9._-]{8,}/gi, "[redacted-key]")
    .replace(/((?:api[_-]?key|token|secret|authorization|password)\s*[=:]\s*)[^\s,;}]+/gi, "$1[redacted]")
    .slice(0, 300);
}

function pickUsage(usage: AiUsageSnapshot): AiUsageSnapshot {
  return {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
  };
}

function mergeUsage(steps: AiStepSnapshot[], fallback?: AiUsageSnapshot): AiUsageSnapshot {
  if (fallback && (fallback.totalTokens != null || fallback.inputTokens != null || fallback.outputTokens != null)) {
    return fallback;
  }
  const sum = (field: keyof AiUsageSnapshot) => {
    const values = steps.map((step) => step.usage?.[field]).filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  return { inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), totalTokens: sum("totalTokens") };
}

export function createAiCallLogger(context: AiLoggerContext) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const steps: AiStepSnapshot[] = [];
  const toolSequence: string[] = [];
  let settled = false;

  function recordStep(step: AiStepSnapshot) {
    const toolCalls = (step.toolCalls ?? []).map(({ toolCallId, toolName }) => ({ toolCallId, toolName }));
    const toolResults = (step.toolResults ?? []).map(({ toolCallId, toolName }) => ({ toolCallId, toolName }));
    steps.push({
      stepNumber: step.stepNumber,
      finishReason: step.finishReason,
      usage: step.usage ? pickUsage(step.usage) : undefined,
      latencyMs: step.latencyMs ?? null,
      toolCalls,
      toolResults,
    });
    for (const call of toolCalls) {
      if (call.toolName) toolSequence.push(call.toolName);
    }
  }

  function finish(input: FinishInput) {
    if (settled) return;
    settled = true;
    const entry: AiLogEntry = {
      ts: new Date().toISOString(),
      requestId,
      route: context.route,
      model: context.model,
      actor: hashActor(context.actorId),
      outcome: input.outcome,
      reason: input.reason ?? null,
      latencyMs: Date.now() - startedAt,
      safety: context.safety,
      request: {
        messages: context.messageCount,
        latestUserChars: context.latestUserChars,
        reaction: context.reaction ?? null,
      },
      steps,
      toolSequence,
      usage: pickUsage(mergeUsage(steps, input.usage)),
      finishReason: input.finishReason ?? null,
      textChars: input.textChars ?? null,
      error: input.error === undefined ? null : sanitizeError(input.error),
      notes: input.notes ?? [],
    };
    const summary = [
      `[ai] ${entry.outcome}`,
      entry.route,
      `req=${entry.requestId}`,
      `model=${entry.model}`,
      `safety=${entry.safety.level}`,
      `latency=${entry.latencyMs}ms`,
      `steps=${entry.steps.length}`,
      `tools=${entry.toolSequence.join(">") || "-"}`,
      `tokens=${entry.usage.totalTokens ?? "?"}`,
      entry.reason ? `reason=${entry.reason}` : "",
    ].filter(Boolean).join(" ");
    console.info(summary);
    void persist(entry);
  }

  return { id: requestId, recordStep, finish };
}

async function persist(entry: AiLogEntry) {
  const directory = process.env.AI_LOG_DIR?.trim() || ".ai-logs";
  try {
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `ai-${entry.ts.slice(0, 10)}.jsonl`);
    await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.warn("[ai] log write failed:", sanitizeError(error));
  }
}
