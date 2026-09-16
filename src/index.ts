import { config } from "./config.js";
import { getInFlightSlice } from "./inFlight.js";
import { getRandomQuicksumPicks, closeQuicksumClient } from "./mcp/quicksum.js";
import { getPoolSlice } from "./linkhoard.js";
import { getMenuSlice } from "./food.js";
import { renderBriefHtml, renderBriefText, type BriefData } from "./email/render.js";
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
  try {
    const brief = await buildBrief(date);
    const html = renderBriefHtml(brief);
    const text = renderBriefText(brief);
    const subject = `${config.email.subjectPrefix} — ${date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })}`;
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
