import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectMcpClient, parseToolResultJson } from "./client.js";
import { config } from "../config.js";

export interface QuicksumSummaryStub {
  id: string;
  title: string;
  author?: string;
  created?: string;
  [key: string]: unknown;
}

export interface QuicksumSummaryFull extends QuicksumSummaryStub {
  content?: string;
  summary?: string;
  hook?: string;
  description?: string;
}

export interface QuicksumPick {
  id: string;
  title: string;
  author: string;
  hook: string;
}

let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connectMcpClient("quicksum", config.quicksum);
  }
  return clientPromise;
}

export async function closeQuicksumClient(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
    clientPromise = null;
  }
}

async function getAllSummaries(): Promise<QuicksumSummaryStub[]> {
  const client = await getClient();
  const result = await client.callTool({ name: "get_summaries", arguments: {} });
  const parsed = parseToolResultJson<QuicksumSummaryStub[] | { summaries: QuicksumSummaryStub[] }>(
    result as { content: Array<{ type: string; text?: string }> }
  );
  return Array.isArray(parsed) ? parsed : parsed.summaries;
}

async function getSummaryById(id: string): Promise<QuicksumSummaryFull> {
  const client = await getClient();
  const result = await client.callTool({ name: "get_summary_by_id", arguments: { id } });
  return parseToolResultJson<QuicksumSummaryFull>(
    result as { content: Array<{ type: string; text?: string }> }
  );
}

// Strip a leading "**Label:**"-style markdown header (real content bodies
// consistently open with one, e.g. "**The thesis:** ...") plus any
// remaining bold/italic markers, so raw asterisks don't leak into the
// rendered HTML email.
function stripMarkdown(input: string): string {
  return input
    .replace(/^\s*\*\*[^*]+\*\*:?\s*/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

// One-sentence hook, not a full summary excerpt. The tool's response shape
// for "hook"-style copy isn't guaranteed, so prefer an explicit hook/
// description field and fall back to the first sentence of the content.
function extractHook(full: QuicksumSummaryFull): string {
  const explicit = full.hook ?? full.description;
  if (explicit) return stripMarkdown(explicit);

  const body = stripMarkdown(full.summary ?? full.content ?? "");
  const firstSentence = body.split(/(?<=[.!?])\s/)[0]?.trim();
  if (!firstSentence) return "";
  return firstSentence.length > 200 ? `${firstSentence.slice(0, 197)}...` : firstSentence;
}

// Fisher-Yates shuffle so selection is uniformly random, not "first N".
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Truly randomized per call (no caching, no "most recent"/progress bias).
export async function getRandomQuicksumPicks(count: number): Promise<QuicksumPick[]> {
  const stubs = await getAllSummaries();
  const picked = shuffle(stubs).slice(0, count);

  const full = await Promise.all(picked.map((stub) => getSummaryById(stub.id)));

  return full.map((item, i) => ({
    id: item.id,
    title: item.title ?? picked[i].title,
    author: item.author ?? picked[i].author ?? "Unknown",
    hook: extractHook(item),
  }));
}
