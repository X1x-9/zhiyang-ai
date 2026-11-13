import { createMcpHandler } from "@modelcontextprotocol/server";
import { createHealthMcpServer } from "@/lib/mcp-server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const handler = createMcpHandler(() => createHealthMcpServer(), {
  legacy: "stateless",
  responseMode: "auto",
  onerror: (error) => console.warn("[mcp] request failed:", error.name),
});

function originAllowed(request: Request, origin: string) {
  const self = new URL(request.url).origin;
  if (origin === self) return true;
  const configured = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin);
}

async function handle(request: Request) {
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && origin && !originAllowed(request, origin)) {
    return new Response("Origin not allowed.", { status: 403 });
  }

  const limited = rateLimit(clientKey(request, "mcp"), 60, 60_000);
  if (!limited.ok) {
    return new Response("Too many requests.", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  return handler.fetch(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
