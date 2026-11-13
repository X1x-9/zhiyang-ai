import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL(process.env.MCP_URL || "http://127.0.0.1:3100/api/mcp");
const client = new Client({ name: "zhiyang-smoke", version: "1.0.0" });

function textOf(result) {
  return (result.content || [])
    .map((block) => (block?.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

const calls = [
  ["search_wellness_knowledge", { query: "每天盐摄入建议", limit: 3 }],
  ["calculate_nutrition", { items: [{ name: "米饭", amountGrams: 150 }, { name: "鸡胸肉", amountGrams: 120 }] }],
  ["safety_check", { question: "最近总是失眠，白天很累怎么办" }],
  ["get_weather_forecast", { city: "北京", days: 2 }],
];

try {
  await client.connect(new StreamableHTTPClientTransport(url));
  const { tools } = await client.listTools();
  console.log(`connected ${url.toString()}`);
  console.log(`tools (${tools.length}): ${tools.map((tool) => tool.name).join(", ")}`);

  let failed = false;
  for (const [name, args] of calls) {
    const tool = tools.find((item) => item.name === name);
    if (!tool) {
      console.error(`FAIL ${name}: not registered`);
      failed = true;
      continue;
    }
    const result = await client.callTool({ name, arguments: args });
    const structured = result.structuredContent !== undefined;
    if (result.isError) {
      console.error(`FAIL ${name}: ${textOf(result).split("\n")[0]}`);
      failed = true;
      continue;
    }
    if (!structured) {
      console.error(`FAIL ${name}: missing structuredContent`);
      failed = true;
      continue;
    }
    const preview = textOf(result).split("\n").slice(0, 3).join(" | ");
    console.log(`PASS ${name}: ${preview.slice(0, 220)}`);
  }

  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(`FAIL connect: ${error instanceof Error ? error.message : "unknown"}`);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
