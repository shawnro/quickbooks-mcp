// Lambda entry point for QuickBooks MCP server (Streamable HTTP transport)
// Deployed behind API Gateway with MSAL authentication

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { setOutputMode } from "./utils/output.js";
import { toolDefinitions, executeTool } from "./tools/index.js";

// Set HTTP output mode at module load (before any handlers run)
setOutputMode("http");

// Filter out qbo_authenticate — not relevant for remote/Lambda usage
const remoteToolDefinitions = toolDefinitions.filter(
  (t) => t.name !== "qbo_authenticate"
);

// Create MCP server (reused across warm Lambda invocations)
function createServer(): Server {
  const server = new Server(
    { name: "quickbooks-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: remoteToolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return executeTool(name, args as Record<string, unknown>);
  });

  return server;
}

// API Gateway v2 (HTTP API) event shape
interface APIGatewayV2Event {
  requestContext: {
    http: { method: string; path: string };
    stage: string;
  };
  headers: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

interface APIGatewayV2Result {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

/**
 * Convert API Gateway v2 event to Web Standard Request
 */
function toWebRequest(event: APIGatewayV2Event): Request {
  const { method } = event.requestContext.http;

  // Reconstruct URL from headers
  const host = event.headers["host"] || "localhost";
  const path = event.requestContext.http.path;
  const url = `https://${host}${path}`;

  // Decode body
  let body: string | undefined;
  if (event.body) {
    body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body;
  }

  // Build headers (API Gateway v2 lowercases header names)
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value) headers.set(key, value);
  }

  return new Request(url, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });
}

/**
 * Convert Web Standard Response to API Gateway v2 result
 */
async function toGatewayResult(
  response: Response
): Promise<APIGatewayV2Result> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const body = await response.text();

  return {
    statusCode: response.status,
    headers,
    body,
    isBase64Encoded: false,
  };
}

/**
 * Lambda handler — creates a new transport per invocation, stateless mode.
 * The MCP server is created once at module level and reused across warm invocations.
 */
export async function handler(
  event: APIGatewayV2Event
): Promise<APIGatewayV2Result> {
  // Handle CORS preflight
  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
      },
      body: "",
      isBase64Encoded: false,
    };
  }

  // Create fresh server + transport per invocation
  // (server holds per-session state via transport, so reusing risks cross-invocation bleed)
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true, // JSON responses, not SSE streams
  });

  await server.connect(transport);

  try {
    const webRequest = toWebRequest(event);
    const webResponse = await transport.handleRequest(webRequest);
    return toGatewayResult(webResponse);
  } finally {
    // Close transport + server to prevent resource leaks between invocations
    await transport.close();
    await server.close();
  }
}
