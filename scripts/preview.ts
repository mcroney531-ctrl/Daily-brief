import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { renderBriefHtml, type BriefData } from "../src/email/render.js";
import type { ProjdashItem } from "../src/mcp/projdash.js";

const mockItem = (overrides: Partial<ProjdashItem>): ProjdashItem => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  title: "Untitled",
  ...overrides,
});

const mockData: BriefData = {
  date: new Date(),
  projdash: {
    inProgress: [
      mockItem({ title: "Rework onboarding flow copy", hub: "Momentum", category: "Product" }),
      mockItem({ title: "Fix flaky CI on release branch", hub: "Momentum" }),
    ],
    openHighPriority: [
      mockItem({ title: "Renew domain before expiry", category: "Ops", url: "https://example.com" }),
    ],
    unassigned: [
      mockItem({ title: "Look into new analytics tool someone mentioned" }),
      mockItem({ title: "Follow up on contractor invoice" }),
    ],
  },
  quicksumPicks: [
    {
      id: "1",
      title: "The Every",
      author: "Dave Eggers",
      hook: "A near-future satire about a tech monopoly that swallows privacy whole, one convenience at a time.",
    },
    {
      id: "2",
      title: "Atomic Habits",
      author: "James Clear",
      hook: "Small, consistent changes compound into identity-level transformation over time.",
    },
  ],
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "preview.html");
writeFileSync(outPath, renderBriefHtml(mockData), "utf-8");
console.log(`Preview written to ${outPath}`);
