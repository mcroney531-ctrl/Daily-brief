import type { ProjdashItem, ProjdashSlice } from "../mcp/projdash.js";
import type { QuicksumPick } from "../mcp/quicksum.js";
import type { LinkhoardLink, PoolSlice } from "../linkhoard.js";
import type { MenuSlice } from "../food.js";
import { getTodaysChores, getChoreNudgeText, DAILY_MAINTENANCE } from "../chores.js";

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
    ? `<a href="${escapeHtml(item.url)}" style="color:#1a1a1a; text-decoration:underline; font-weight:600;">${title}</a>`
    : `<span style="font-weight:600; color:#1a1a1a;">${title}</span>`;
  const meta = [item.hub, item.category].filter(Boolean).join(" / ");

  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #e5e5e5;">
        <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.4;">${titleHtml}</div>
        ${meta ? `<div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.03em; text-transform:uppercase; color:#808080; margin-top:3px;">${escapeHtml(meta)}</div>` : ""}
      </td>
    </tr>`;
}

function projdashSubsection(eyebrow: string, items: ProjdashItem[]): string {
  if (items.length === 0) return "";
  return `
    <div style="margin-top:18px;">
      <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#1a1a1a; font-weight:700; margin-bottom:4px;">${escapeHtml(eyebrow)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${items.map(projdashItemRow).join("")}
      </table>
    </div>`;
}

function quicksumCard(pick: QuicksumPick): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f2f2f2; border-radius:12px; margin-top:12px;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; font-weight:700; color:#1a1a1a; line-height:1.35;">${escapeHtml(pick.title)}</div>
          <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.03em; text-transform:uppercase; color:#808080; margin-top:4px;">${escapeHtml(pick.author)}</div>
          ${pick.hook ? `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#333333; line-height:1.5; margin-top:8px;">${escapeHtml(pick.hook)}</div>` : ""}
        </td>
      </tr>
    </table>`;
}

// The week's menu, as decided in Your Dietitian chat. Leads the brief, so it
// gets the full-width card treatment rather than a one-line callout.
function menuBody(menu: MenuSlice): string {
  if (menu.categories.length === 0) {
    return `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#808080;">Nothing planned yet this week.</div>`;
  }

  const groups = menu.categories
    .map(
      (group) => `
    <div style="margin-top:14px;">
      <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#1a1a1a; font-weight:700; margin-bottom:6px;">${escapeHtml(group.category)}</div>
      ${group.items
        .map(
          (item) =>
            `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; color:#1a1a1a; line-height:1.45; padding:3px 0;">${escapeHtml(item)}</div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  // Without this the list just quietly shrinks as the week gets handled,
  // which reads as things going missing rather than progress.
  const covered = menu.coveredCount
    ? `<div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:10px; letter-spacing:0.05em; color:#999999; margin-top:16px;">${menu.coveredCount} already covered</div>`
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
        `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a; line-height:1.6;">Don't forget to check out <strong>${escapeHtml(poolLinkTitle(link))}</strong>.</div>`
    )
    .join("");
  return `
          <tr>
            <td style="background:#ffffff; padding:12px 22px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background:#ececec; border-radius:12px; padding:14px 16px;">
                    ${lines}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// A handful of fixed dot positions layered under the linear gradient —
// static (no JS/animation available in email), but reads as a starfield.
// Colors sampled directly from LinkHoard's own app header.
const GALAXY_BACKGROUND = [
  "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.55) 1px, transparent 1.6px)",
  "radial-gradient(circle at 75% 15%, rgba(255,255,255,0.45) 1px, transparent 1.6px)",
  "radial-gradient(circle at 40% 10%, rgba(255,255,255,0.35) 1px, transparent 1.6px)",
  "radial-gradient(circle at 90% 55%, rgba(255,255,255,0.4) 1px, transparent 1.6px)",
  "radial-gradient(circle at 25% 70%, rgba(255,255,255,0.3) 1px, transparent 1.6px)",
  "radial-gradient(circle at 60% 85%, rgba(255,255,255,0.45) 1px, transparent 1.6px)",
  "radial-gradient(circle at 85% 90%, rgba(255,255,255,0.3) 1px, transparent 1.6px)",
  "linear-gradient(135deg, #150f3d 0%, #1c2f6b 45%, #2e3aa0 75%, #3d3fae 100%)",
].join(",");

// The one random pick gets LinkHoard's own header treatment (deep-space
// gradient + icon) lifted wholesale — a deliberate break from the rest of
// the brief's neutral palette, since this is the one section pulling
// straight from that app rather than being about the day itself.
function poolGalaxyCard(pick: LinkhoardLink, iconSrc: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:16px;">
    <tr>
      <td style="background:#ffffff; border-radius:18px; padding:4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="background-image:${GALAXY_BACKGROUND}; border-radius:15px; padding:20px 20px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:14px;">
                <tr>
                  <td style="padding-right:8px; vertical-align:middle;">
                    <img src="${escapeHtml(iconSrc)}" width="22" height="22" alt="" style="display:block; border-radius:6px; box-shadow:0 0 0 1px rgba(255,255,255,0.2);">
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.65);">From the Pool</div>
                  </td>
                </tr>
              </table>
              <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-bottom:5px;">You might be interested in</div>
              <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:15px; font-weight:700; line-height:1.35; margin-bottom:8px;">
                <a href="${escapeHtml(pick.url)}" style="color:#ffffff; text-decoration:underline; text-decoration-color:rgba(255,255,255,0.5);">${escapeHtml(poolLinkTitle(pick))}</a>
              </div>
              ${pick.description ? `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:rgba(255,255,255,0.82); line-height:1.5;">${escapeHtml(pick.description)}</div>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function sectionCard(eyebrow: string, innerHtml: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:16px;">
    <tr>
      <td style="background:#ffffff; border:1px solid #e2e2e2; border-radius:16px; padding:20px;">
        <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#808080; margin-bottom:8px;">${escapeHtml(eyebrow)}</div>
        ${innerHtml}
      </td>
    </tr>
  </table>`;
}

// The day's zone name plus its specific task list, matching the Weekly
// Reset grid: "One zone per day, same tasks, same day, every week."
function choreTaskList(tasks: string[]): string {
  return tasks
    .map(
      (task) =>
        `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:13px; color:#1a1a1a; line-height:1.6;">– ${escapeHtml(task)}</div>`
    )
    .join("");
}

function choreNudgeBody(zone: string, tasks: string[], dailyMaintenance: string[]): string {
  return `
    <div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a; line-height:1.5;">
      Don't forget, today you're cleaning the <strong>${escapeHtml(zone)}</strong>:
    </div>
    <div style="margin-top:6px;">${choreTaskList(tasks)}</div>
    <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#666666; margin-top:12px;">Daily Maintenance</div>
    <div style="margin-top:4px;">${choreTaskList(dailyMaintenance)}</div>`;
}

export interface RenderOptions {
  // "cid:linkhoard-icon" by default, matching the attachment send.ts wires
  // up — overridable so the local preview script (which never goes through
  // nodemailer) can pass a data URI instead, since a browser will render
  // that fine but Gmail strips inline data URIs from received mail.
  poolIconSrc?: string;
}

export function renderBriefHtml(data: BriefData, opts: RenderOptions = {}): string {
  const poolIconSrc = opts.poolIconSrc ?? "cid:linkhoard-icon";
  const { zone, tasks } = getTodaysChores(data.date);
  const { inProgress, openHighPriority, unassigned } = data.projdash;
  const projdashIsQuiet = inProgress.length === 0 && openHighPriority.length === 0 && unassigned.length === 0;

  const projdashBody = projdashIsQuiet
    ? `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#808080;">Nothing pulled from ProjDash today — clear board.</div>`
    : [
        projdashSubsection("In Progress", inProgress),
        projdashSubsection("Open · High Priority", openHighPriority),
        projdashSubsection("Triage / Unassigned", unassigned),
      ].join("");

  const quicksumBody = data.quicksumPicks.length
    ? data.quicksumPicks.map(quicksumCard).join("")
    : `<div style="font-family:'Lato',Helvetica,Arial,sans-serif; font-size:14px; color:#808080;">Reading queue is empty — add something to QuickSum.</div>`;

  const poolActiveHtml = poolActiveCallout(data.pool.active);
  const poolPickHtml = data.pool.pick ? poolGalaxyCard(data.pool.pick, poolIconSrc) : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily Briefing</title>
</head>
<body style="margin:0; padding:0; background:#f0f0f0; font-family:'Lato',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f0f0f0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; max-width:480px; width:100%;">

          <tr>
            <td style="background:#1a1a1a; border-radius:16px; padding:24px 22px;">
              <div style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#cccccc;">Daily Briefing</div>
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
                  <td style="background:#ececec; border-radius:12px; padding:14px 16px;">
                    ${choreNudgeBody(zone, tasks, DAILY_MAINTENANCE)}
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
            <td style="background:#f0f0f0; padding:0 22px 22px;">
              ${sectionCard("ProjDash", projdashBody)}
              ${poolPickHtml}
              ${sectionCard("QuickSum Picks", quicksumBody)}

              <div style="text-align:center; font-family:'DM Mono',SFMono-Regular,Consolas,monospace; font-size:10px; letter-spacing:0.05em; color:#999999; margin-top:20px;">
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
