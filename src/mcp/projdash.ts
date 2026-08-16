import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectMcpClient, parseToolResultJson } from "./client.js";
import { config } from "../config.js";

// Shape is intentionally loose: the projdash category structure is actively
// being rewired, so we only depend on fields that are stable across that
// rewiring (id, title, status, priority, category, url/link).
export interface ProjdashItem {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  category?: string | null;
  hub?: string | null;
  url?: string;
  updated_at?: string;
  parent_item_id?: string | null;
  [key: string]: unknown;
}

interface GetItemsArgs {
  category?: string;
  status?: string;
  top_level_only?: boolean;
  type?: "hub" | "item";
  unassigned_only?: boolean;
}

let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connectMcpClient("projdash", config.projdash);
  }
  return clientPromise;
}

async function getItems(args: GetItemsArgs): Promise<ProjdashItem[]> {
  const client = await getClient();
  const result = await client.callTool({ name: "get_items", arguments: { ...args } });
  // Tools may return either a bare array or { items: [...] }.
  const parsed = parseToolResultJson<ProjdashItem[] | { items: ProjdashItem[] }>(
    result as { content: Array<{ type: string; text?: string }> }
  );
  return Array.isArray(parsed) ? parsed : parsed.items;
}

// Only top-level items carry a category in ProjDash; nested items always
// show category: null regardless of whether they've been triaged, so hub
// names have to be resolved separately via parent_item_id.
async function getHubTitleById(): Promise<Map<string, string>> {
  const hubs = await getItems({ type: "hub" });
  return new Map(hubs.map((hub) => [hub.id, hub.title]));
}

function attachHubTitles(items: ProjdashItem[], hubTitleById: Map<string, string>): ProjdashItem[] {
  return items.map((item) =>
    item.parent_item_id && hubTitleById.has(item.parent_item_id)
      ? { ...item, hub: hubTitleById.get(item.parent_item_id) }
      : item
  );
}

function isHighPriority(item: ProjdashItem): boolean {
  return (item.priority ?? "").toLowerCase() === "high";
}

export async function closeProjdashClient(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
    clientPromise = null;
  }
}

export interface ProjdashSlice {
  inProgress: ProjdashItem[];
  openHighPriority: ProjdashItem[];
  unassigned: ProjdashItem[];
}

// Three generic, category-agnostic buckets. Items already shown in an
// earlier bucket are excluded from later ones so the same item doesn't
// appear twice in a short, scannable email.
//
// The unassigned/triage bucket is additionally scoped to top-level items
// (nested items structurally always have category: null, so they're not
// really "uncategorized") and to status "open" (old done/tabled items with
// no category are stale residue, not something that needs triaging today —
// showing them forever would turn this into the backlog-guilt machine the
// spec explicitly rules out).
export async function getProjdashSlice(maxPerSection: number): Promise<ProjdashSlice> {
  const [inProgressRaw, openRaw, unassignedRaw, hubTitleById] = await Promise.all([
    getItems({ status: "in progress", type: "item" }),
    getItems({ status: "open", type: "item" }),
    getItems({ unassigned_only: true, type: "item", top_level_only: true, status: "open" }),
    getHubTitleById(),
  ]);

  const shown = new Set<string>();

  const inProgress = attachHubTitles(inProgressRaw.slice(0, maxPerSection), hubTitleById);
  inProgress.forEach((item) => shown.add(item.id));

  const openHighPriority = attachHubTitles(
    openRaw.filter((item) => isHighPriority(item) && !shown.has(item.id)).slice(0, maxPerSection),
    hubTitleById
  );
  openHighPriority.forEach((item) => shown.add(item.id));

  const unassigned = unassignedRaw.filter((item) => !shown.has(item.id)).slice(0, maxPerSection);

  return { inProgress, openHighPriority, unassigned };
}
