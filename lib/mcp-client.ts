import { Client, InMemoryTransport, type Tool } from "@modelcontextprotocol/client";
import { dynamicTool, jsonSchema, type ToolSet } from "ai";
import { createHealthMcpServer } from "./mcp-server";
import type { KnowledgePassage } from "./rag";

const REQUIRED_TOOLS = [
  "search_wellness_knowledge",
  "calculate_nutrition",
  "safety_check",
  "get_weather_forecast",
] as const;

type HealthMcpConnection = {
  client: Client;
  tools: Tool[];
};

let connection: HealthMcpConnection | null = null;
let connecting: Promise<HealthMcpConnection | null> | null = null;

async function connectHealthMcp(): Promise<HealthMcpConnection> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createHealthMcpServer();
  await server.connect(serverTransport);

  const client = new Client({ name: "zhiyang-assistant", version: "1.0.0" });
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  return { client, tools };
}

async function getConnection(): Promise<HealthMcpConnection | null> {
  if (connection) return connection;
  if (!connecting) {
    connecting = connectHealthMcp()
      .then((value) => {
        connection = value;
        return value;
      })
      .catch((error) => {
        console.warn("[mcp] client connect failed:", error instanceof Error ? error.message : "unknown");
        return null;
      })
      .finally(() => {
        connecting = null;
      });
  }
  return connecting;
}

function passageFromMcp(value: unknown): KnowledgePassage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.index !== "number" || typeof record.title !== "string" || typeof record.source !== "string" || typeof record.content !== "string") {
    return null;
  }
  return {
    id: `mcp-${record.index}-${record.title}`,
    index: record.index,
    title: record.title,
    source: record.source,
    content: record.content,
    similarity: typeof record.similarity === "number" ? record.similarity : 0,
    vectorScore: null,
    keywordScore: null,
    matchedTerms: [],
  };
}

function knowledgeFromResult(toolName: string, result: unknown): KnowledgePassage[] {
  if (toolName !== "search_wellness_knowledge" || !result || typeof result !== "object") return [];
  const passages = (result as { passages?: unknown }).passages;
  if (!Array.isArray(passages)) return [];
  return passages.map(passageFromMcp).filter((passage): passage is KnowledgePassage => passage !== null);
}

function textFromContent(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (block && typeof block === "object" && "text" in block && typeof block.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

export async function createMcpHealthTools(options: { onKnowledge?: (passages: KnowledgePassage[]) => void } = {}): Promise<ToolSet | null> {
  const initial = await getConnection();
  if (!initial) return null;

  const definitions = new Map(initial.tools.map((tool) => [tool.name, tool]));
  if (!REQUIRED_TOOLS.every((name) => definitions.has(name))) {
    console.warn("[mcp] expected tools missing, falling back to local tools");
    return null;
  }

  const tools: ToolSet = {};
  for (const name of REQUIRED_TOOLS) {
    const definition = definitions.get(name);
    if (!definition) continue;
    tools[name] = dynamicTool({
      description: definition.description ?? definition.title ?? name,
      inputSchema: jsonSchema(definition.inputSchema as unknown as Parameters<typeof jsonSchema>[0]),
      execute: async (input) => {
        const call = async (client: Client) => client.callTool({
          name,
          arguments: (input ?? {}) as Record<string, unknown>,
        });

        let result;
        try {
          result = await call(initial.client);
        } catch {
          connection = null;
          const refreshed = await getConnection();
          if (!refreshed) return { error: "MCP 工具服务暂时不可用。" };
          result = await call(refreshed.client);
        }

        if (result.isError) {
          return { error: textFromContent(result.content) || "工具调用失败。" };
        }

        const structured = result.structuredContent;
        const payload = structured ?? textFromContent(result.content);
        const passages = knowledgeFromResult(name, structured);
        if (passages.length) options.onKnowledge?.(passages);
        return payload;
      },
    });
  }
  return tools;
}
