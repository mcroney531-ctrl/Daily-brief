import type { ProjdashItem, ProjdashSlice } from "../mcp/projdash.js";
import type { QuicksumPick } from "../mcp/quicksum.js";
import { getTodaysZone, getChoreNudgeText } from "../chores.js";

export interface BriefData {
  date: Date;
  projdash: ProjdashSlice;
  quicksumPicks: QuicksumPick[];
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function projdashItemRow(item: ProjdashItem): string {
  const title = escapeHtml(item.title);
  const titleHtml = item.url
    ? `<a href="${escapeHtml(item.url)}" style="color:#1d4a30; text-decoration:none; font-weight:600;">${title}</a>`
    : `<span style="font-weight:600; color:#1d1d1d;">${title}</span>`;
  const meta = [item.hub, item.category].filter(Boolean).join(" / ");

  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #eef1ee;">
        <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.4;">${titleHtml}</div>
        ${meta ? `<div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.03em; text-transform:uppercase; color:#7c8a80; margin-top:3px;">${escapeHtml(meta)}</div>` : ""}
      </td>
    </tr>`;
}

function projdashSubsection(eyebrow: string, items: ProjdashItem[]): string {
  if (items.length === 0) return "";
  return `
    <div style="margin-top:18px;">
      <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#1d4a30; font-weight:700; margin-bottom:4px;">${escapeHtml(eyebrow)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${items.map(projdashItemRow).join("")}
      </table>
    </div>`;
}

function quicksumCard(pick: QuicksumPick): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f5f8f6; border-radius:12px; margin-top:12px;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; font-weight:700; color:#1d1d1d; line-height:1.35;">${escapeHtml(pick.title)}</div>
          <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.03em; text-transform:uppercase; color:#7c8a80; margin-top:4px;">${escapeHtml(pick.author)}</div>
          ${pick.hook ? `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#3c463f; line-height:1.5; margin-top:8px;">${escapeHtml(pick.hook)}</div>` : ""}
        </td>
      </tr>
    </table>`;
}

function sectionCard(eyebrow: string, innerHtml: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:16px;">
    <tr>
      <td style="background:#ffffff; border:1px solid #e7ece8; border-radius:16px; padding:20px;">
        <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#7c8a80; margin-bottom:8px;">${escapeHtml(eyebrow)}</div>
        ${innerHtml}
      </td>
    </tr>
  </table>`;
}

export function renderBriefHtml(data: BriefData): string {
  const zone = getTodaysZone(data.date);
  const { inProgress, openHighPriority, unassigned } = data.projdash;
  const projdashIsQuiet = inProgress.length === 0 && openHighPriority.length === 0 && unassigned.length === 0;

  const projdashBody = projdashIsQuiet
    ? `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#7c8a80;">Nothing pulled from ProjDash today — clear board.</div>`
    : [
        projdashSubsection("In Progress", inProgress),
        projdashSubsection("Open · High Priority", openHighPriority),
        projdashSubsection("Triage / Unassigned", unassigned),
      ].join("");

  const quicksumBody = data.quicksumPicks.length
    ? data.quicksumPicks.map(quicksumCard).join("")
    : `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#7c8a80;">Reading queue is empty — add something to QuickSum.</div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily Briefing</title>
</head>
<body style="margin:0; padding:0; background:#f2f4f2; font-family:'Lato',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f2f4f2;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; max-width:480px; width:100%;">

          <tr>
            <td style="background:#1d4a30; border-radius:16px 16px 0 0; padding:24px 22px;">
              <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#c9dcd0;">Daily Briefing</div>
              <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:20px; font-weight:700; color:#ffffff; margin-top:6px;">${escapeHtml(formatDate(data.date))}</div>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff; padding:16px 22px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background:#eef4f0; border-radius:12px; padding:14px 16px;">
                    <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#1d4a30; line-height:1.5;">
                      Don't forget, today you're cleaning the <strong>${escapeHtml(zone)}</strong>.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#f2f4f2; padding:0 22px 22px;">
              ${sectionCard("ProjDash", projdashBody)}
              ${sectionCard("QuickSum Picks", quicksumBody)}

              <div style="text-align:center; font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:10px; letter-spacing:0.05em; color:#9aa79f; margin-top:20px;">
                One glance, then get on with the day.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderBriefText(data: BriefData): string {
  const lines: string[] = [];
  lines.push(`Daily Briefing — ${formatDate(data.date)}`);
  lines.push("");
  lines.push(getChoreNudgeText(data.date));
  lines.push("");

  lines.push("ProjDash");
  const sections: Array<[string, ProjdashItem[]]> = [
    ["In Progress", data.projdash.inProgress],
    ["Open · High Priority", data.projdash.openHighPriority],
    ["Triage / Unassigned", data.projdash.unassigned],
  ];
  const anyProjdash = sections.some(([, items]) => items.length > 0);
  if (!anyProjdash) {
    lines.push("  Nothing pulled from ProjDash today — clear board.");
  } else {
    for (const [label, items] of sections) {
      if (items.length === 0) continue;
      lines.push(`  ${label}:`);
      for (const item of items) lines.push(`    - ${item.title}`);
    }
  }
  lines.push("");

  lines.push("QuickSum Picks");
  if (data.quicksumPicks.length === 0) {
    lines.push("  Reading queue is empty — add something to QuickSum.");
  } else {
    for (const pick of data.quicksumPicks) {
      lines.push(`  - ${pick.title} — ${pick.author}`);
      if (pick.hook) lines.push(`    ${pick.hook}`);
    }
  }

  return lines.join("\n");
}
