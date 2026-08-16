import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpServerConfig {
  command?: string;
  url?: string;
}

export async function connectMcpClient(
  clientName: string,
  serverConfig: McpServerConfig
): Promise<Client> {
  const client = new Client({ name: `daily-brief-${clientName}`, version: "1.0.0" });

  if (serverConfig.url) {
    const transport = new StreamableHTTPClientTransport(new URL(serverConfig.url));
    await client.connect(transport);
    return client;
  }

  if (serverConfig.command) {
    const [command, ...args] = serverConfig.command.split(" ");
    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);
    return client;
  }

  throw new Error(
    `No connection configured for "${clientName}" MCP server. Set either its *_MCP_URL or *_MCP_COMMAND env var.`
  );
}

// Small helper: MCP tool results come back as content blocks; most of these
// tools return a single JSON text block. Parse it defensively.
export function parseToolResultJson<T>(result: { content: Array<{ type: string; text?: string }> }): T {
  const textBlock = result.content.find((block) => block.type === "text" && block.text);
  if (!textBlock?.text) {
    throw new Error("Expected a text content block with JSON in MCP tool result");
  }
  return JSON.parse(textBlock.text) as T;
}
