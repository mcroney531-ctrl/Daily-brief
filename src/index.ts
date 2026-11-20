import { config } from "./config.js";
import { getThisWeekSnapshot, shouldSendThisWeekOnly } from "./thisWeek.js";
import { closeQuicksumClient } from "./mcp/quicksum.js";
import { buildBrief } from "./brief.js";
import { renderBriefHtml, renderBriefText, renderThisWeekOnlyHtml, renderThisWeekOnlyText } from "./email/render.js";
import { sendBriefEmail } from "./email/send.js";

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
  if (thisWeek?.active && !shouldSendThisWeekOnly(thisWeek)) {
    console.log("This Week override is active but DAILY_BRIEF_FORCE_FULL=true — sending the full brief for this run");
  }
  if (thisWeek && shouldSendThisWeekOnly(thisWeek)) {
    const html = renderThisWeekOnlyHtml(date, thisWeek.text);
    const text = renderThisWeekOnlyText(date, thisWeek.text);
    await sendBriefEmail(subject, html, text);
    console.log("This Week (experimental) sent");
    return;
  }

  try {
    const brief = await buildBrief(date);
    const html = renderBriefHtml(brief);
    const text = renderBriefText(brief);
    await sendBriefEmail(subject, html, text);
    console.log("Daily briefing sent");
  } finally {
    await closeQuicksumClient();
  }
}

main().catch((err) => {
  console.error("Failed to send daily briefing:", err);
  process.exitCode = 1;
});
