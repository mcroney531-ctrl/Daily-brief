import { config } from "./config.js";
import { getInFlightSlice } from "./inFlight.js";
import { getThisWeekSnapshot } from "./thisWeek.js";
import { getRandomQuicksumPicks, closeQuicksumClient } from "./mcp/quicksum.js";
import { getPoolSlice } from "./linkhoard.js";
import { getMenuSlice } from "./food.js";
import { renderBriefHtml, renderBriefText, renderThisWeekOnlyHtml, renderThisWeekOnlyText, type BriefData } from "./email/render.js";
import { sendBriefEmail } from "./email/send.js";

async function buildBrief(date: Date): Promise<BriefData> {
  const [quicksumPicks, pool, menu] = await Promise.all([
    getRandomQuicksumPicks(config.content.quicksumPickCount),
    getPoolSlice(),
    getMenuSlice(date),
  ]);
  return { date, inFlight: getInFlightSlice(), quicksumPicks, pool, menu };
}

async function main() {
  const date = new Date();
  const subject = `${config.email.subjectPrefix} — ${date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })}`;

  // Experimental override: when "This Week" is switched on, send just that
  // plain list instead of the normal brief — see thisWeek.ts. No live MCP
  // calls needed for this path, so it skips buildBrief entirely.
  const thisWeek = getThisWeekSnapshot();
  if (thisWeek?.active) {
    const html = renderThisWeekOnlyHtml(date, thisWeek.text);
    const text = renderThisWeekOnlyText(date, thisWeek.text);
    await sendBriefEmail(subject, html, text);
    console.log(`This Week (experimental) sent to ${config.email.to}`);
    return;
  }

  try {
    const brief = await buildBrief(date);
    const html = renderBriefHtml(brief);
    const text = renderBriefText(brief);
    await sendBriefEmail(subject, html, text);
    console.log(`Daily briefing sent to ${config.email.to}`);
  } finally {
    await closeQuicksumClient();
  }
}

main().catch((err) => {
  console.error("Failed to send daily briefing:", err);
  process.exitCode = 1;
});
