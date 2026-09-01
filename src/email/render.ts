import type { ProjdashItem, ProjdashSlice } from "../mcp/projdash.js";
import type { QuicksumPick } from "../mcp/quicksum.js";
import type { LinkhoardLink, PoolSlice } from "../linkhoard.js";
import type { MenuSlice } from "../food.js";
import { getTodaysChores, getChoreNudgeText } from "../chores.js";

export interface BriefData {
  date: Date;
  projdash: ProjdashSlice;
  quicksumPicks: QuicksumPick[];
  pool: PoolSlice;
  menu: MenuSlice;
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

// The week's menu, as decided in Your Dietitian chat. Leads the brief, so it
// gets the full-width card treatment rather than a one-line callout.
function menuBody(menu: MenuSlice): string {
  if (menu.categories.length === 0) {
    return `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#7c8a80;">Nothing planned yet this week.</div>`;
  }

  const groups = menu.categories
    .map(
      (group) => `
    <div style="margin-top:14px;">
      <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#1d4a30; font-weight:700; margin-bottom:6px;">${escapeHtml(group.category)}</div>
      ${group.items
        .map(
          (item) =>
            `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; color:#1d1d1d; line-height:1.45; padding:3px 0;">${escapeHtml(item)}</div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  // Without this the list just quietly shrinks as the week gets handled,
  // which reads as things going missing rather than progress.
  const covered = menu.coveredCount
    ? `<div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:10px; letter-spacing:0.05em; color:#9aa79f; margin-top:16px;">${menu.coveredCount} already covered</div>`
    : "";

  return `${groups}${covered}`;
}

function poolLinkTitle(link: LinkhoardLink): string {
  return link.title || link.url;
}

// Active pool items get the same visual weight/voice as the chore nudge —
// a commitment, not content to browse. One line per item in a single box.
function poolActiveCallout(active: LinkhoardLink[]): string {
  if (active.length === 0) return "";
  const lines = active
    .map(
      (link) =>
        `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#1d4a30; line-height:1.6;">Don't forget to check out <strong>${escapeHtml(poolLinkTitle(link))}</strong>.</div>`
    )
    .join("");
  return `
          <tr>
            <td style="background:#ffffff; padding:12px 22px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background:#eef4f0; border-radius:12px; padding:14px 16px;">
                    ${lines}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// The one random pick gets the softer, browsier QuickSum-card treatment —
// discovery, not obligation.
function poolPickCard(pick: LinkhoardLink): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f5f8f6; border-radius:12px;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:#9aa79f; margin-bottom:4px;">You might be interested in</div>
          <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; font-weight:700; color:#1d1d1d; line-height:1.35;"><a href="${escapeHtml(pick.url)}" style="color:#1d1d1d; text-decoration:none;">${escapeHtml(poolLinkTitle(pick))}</a></div>
          ${pick.description ? `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#3c463f; line-height:1.5; margin-top:8px;">${escapeHtml(pick.description)}</div>` : ""}
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

// The day's zone name plus its specific task list, matching the Weekly
// Reset grid: "One zone per day, same tasks, same day, every week."
function choreNudgeBody(zone: string, tasks: string[]): string {
  const taskLines = tasks
    .map(
      (task) =>
        `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:13px; color:#1d4a30; line-height:1.6;">– ${escapeHtml(task)}</div>`
    )
    .join("");
  return `
    <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#1d4a30; line-height:1.5;">
      Don't forget, today you're cleaning the <strong>${escapeHtml(zone)}</strong>:
    </div>
    <div style="margin-top:6px;">${taskLines}</div>`;
}

export function renderBriefHtml(data: BriefData): string {
  const { zone, tasks } = getTodaysChores(data.date);
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

  const poolActiveHtml = poolActiveCallout(data.pool.active);
  const poolPickHtml = data.pool.pick ? sectionCard("From the Pool", poolPickCard(data.pool.pick)) : "";

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
            <td style="background:#1d4a30; border-radius:16px; padding:24px 22px;">
              <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#c9dcd0;">Daily Briefing</div>
              <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:20px; font-weight:700; color:#ffffff; margin-top:6px;">${escapeHtml(formatDate(data.date))}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 22px;">
              ${sectionCard("This Week's Menu", menuBody(data.menu))}
            </td>
          </tr>

          <tr><td style="height:16px; line-height:16px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td style="background:#ffffff; border-radius:16px 16px 0 0; padding:16px 22px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background:#eef4f0; border-radius:12px; padding:14px 16px;">
                    ${choreNudgeBody(zone, tasks)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${poolActiveHtml}
          <!-- Closes the white "today" block so it ends on a rounded edge
               rather than a hard seam against the gray below. -->
          <tr><td style="background:#ffffff; border-radius:0 0 16px 16px; height:16px; line-height:16px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td style="background:#f2f4f2; padding:0 22px 22px;">
              ${sectionCard("ProjDash", projdashBody)}
              ${poolPickHtml}
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

  lines.push("This Week's Menu");
  if (data.menu.categories.length === 0) {
    lines.push("  Nothing planned yet this week.");
  } else {
    for (const group of data.menu.categories) {
      lines.push(`  ${group.category}:`);
      for (const item of group.items) lines.push(`    - ${item}`);
    }
    if (data.menu.coveredCount) lines.push(`  (${data.menu.coveredCount} already covered)`);
  }
  lines.push("");

  lines.push(getChoreNudgeText(data.date));
  for (const link of data.pool.active) {
    lines.push(`Don't forget to check out ${poolLinkTitle(link)}.`);
  }
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

  if (data.pool.pick) {
    lines.push("From the Pool");
    lines.push(`  You might be interested in: ${poolLinkTitle(data.pool.pick)}`);
    if (data.pool.pick.description) lines.push(`    ${data.pool.pick.description}`);
    lines.push("");
  }

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
