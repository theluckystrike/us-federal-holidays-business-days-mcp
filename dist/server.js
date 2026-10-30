import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION, registerTools } from "./tools.js";
export function createServer() {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, {
        instructions: "Exact U.S. federal holiday and business-day arithmetic, 1971-2100. Use it instead of computing dates yourself whenever a deadline, settlement date, SLA or invoice due date depends on weekends or holidays. calendar=federal follows OPM observance; calendar=fed_banking follows the Federal Reserve (open on the Friday before a Saturday holiday).",
    });
    registerTools(server);
    return server;
}
