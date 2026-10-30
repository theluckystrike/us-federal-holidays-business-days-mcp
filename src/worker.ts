import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";
import { MONEY_URL, OPM_URL, FED_URL } from "./core.js";

const REPO = "https://github.com/theluckystrike/us-federal-holidays-business-days-mcp";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id, authorization",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
};

function page(origin: string): string {
  const url = `${origin}/mcp`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>US Federal Holidays and Business Days MCP</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 16px;color:#1d1d1f;background:#fff}code,pre{background:#f3f3f3;border-radius:4px;padding:2px 5px;font-size:14px}pre{padding:10px;overflow-x:auto}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}a{color:#0b57d0}</style></head><body>
<h1>US Federal Holidays and Business Days MCP</h1>
<p>Exact U.S. federal holidays and business-day arithmetic for 1971-2100, so your assistant does not guess at observed dates. It knows the OPM rule (a Saturday holiday is observed Friday) and the Federal Reserve rule (banks stay open that Friday).</p>
<h2>Connect</h2>
<p>MCP endpoint, Streamable HTTP, no token needed:</p>
<pre>${url}</pre>
<p>Claude.ai custom connector or ChatGPT developer mode: paste the URL above.</p>
<p>Claude Code: <code>claude mcp add --transport http us-federal-holidays ${url}</code></p>
<p>Local stdio: <code>npx -y github:theluckystrike/us-federal-holidays-business-days-mcp</code></p>
<h2>Tools</h2>
<table><tr><th>Tool</th><th>What it does</th></tr>
<tr><td>list_federal_holidays</td><td>All holidays for a year with legal, OPM observed and Federal Reserve dates</td></tr>
<tr><td>is_business_day</td><td>Business day check on the federal or Fed banking calendar</td></tr>
<tr><td>add_business_days</td><td>Add or subtract N business days</td></tr>
<tr><td>count_business_days</td><td>Business days between two dates</td></tr>
<tr><td>invoice_due_date</td><td>Due date from net terms, rolled past weekends and holidays</td></tr></table>
<p>Sources: <a href="${OPM_URL}">OPM federal holidays</a>, <a href="${FED_URL}">Federal Reserve K.8</a>, 5 U.S.C. 6103. Code: <a href="${REPO}">GitHub</a>.</p>
<p>Part of the Zovo MCP collection: <a href="${MONEY_URL}">mcp.zovo.one</a>. The invoice and dunning servers in that bundle use these due dates.</p>
</body></html>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      if (request.method === "GET" || request.method === "DELETE") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. This stateless server accepts POST only." }, id: null }), {
          status: 405,
          headers: { "content-type": "application/json", allow: "POST, OPTIONS", ...CORS },
        });
      }
      const server = createServer();
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await server.connect(transport);
      const res = await transport.handleRequest(request);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(page(url.origin), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    if (url.pathname === "/health") return new Response("ok", { headers: CORS });
    return new Response("Not found. MCP endpoint is /mcp.", { status: 404 });
  },
};
