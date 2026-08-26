# Daily Briefing

A daily consolidation email — not a to-do list, not a calendar. A handful of
things, pulled together each morning so there's one place to glance at before
the day starts:

1. **Chore nudge** — today's zone from the weekly Home Maintenance rotation (pure day-of-week lookup, no external call).
2. **ProjDash slice** — items in progress, open + high priority, and unassigned/triage, pulled live via the `projdash` MCP server. Currently paused — ProjDash's category structure is being actively rewired by hand, so this section is along for the ride but not being actively refined right now.
3. **From the Pool** — a "don't forget" nudge for anything you've marked active in LinkHoard, plus one random "you might be interested in" pick from everything else. See below for how the active/inactive split works.
4. **QuickSum picks** — two truly random saved summaries (title, author, one-sentence hook), pulled live via the `quicksum-remote` MCP server, to keep the reading queue alive.

No calendar, no weather, no full backlog dump — see "Explicitly ruled out" below.

## Setup

```bash
npm install
cp .env.example .env
# fill in .env — see the table below
```

### Environment variables

| Variable | Purpose |
|---|---|
| `PROJDASH_MCP_URL` / `PROJDASH_MCP_COMMAND` | How to reach the projdash MCP server. Set the URL for an HTTP/SSE server, or the command for a local stdio process. Set exactly one. |
| `QUICKSUM_MCP_URL` / `QUICKSUM_MCP_COMMAND` | Same, for quicksum-remote. |
| `LINKHOARD_API_URL` / `LINKHOARD_API_TOKEN` | LinkHoard's REST API (same one its PWA talks to) and its bearer token, for the "From the Pool" section. Left blank, that section is skipped rather than failing the send. |
| `DAILY_BRIEF_MAX_ITEMS_PER_SECTION` | Cap per ProjDash bucket, default 5. Keeps the email scannable, not a full backlog. |
| `DAILY_BRIEF_QUICKSUM_PICKS` | How many random QuickSum picks, default 2. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | Outbound mail credentials. |
| `EMAIL_FROM` / `EMAIL_TO` / `EMAIL_SUBJECT_PREFIX` | Addressing. |

## Usage

```bash
# Preview the template with mock data — no live MCP calls, no email sent.
npm run preview   # writes ./preview.html

# Build and send today's real briefing.
npm run send
```

## Scheduling

This is meant to arrive before the normal morning phone check. Wire `npm run send`
(or the built `dist/index.js`) into cron, e.g. for 6:30am local time — adjust to
taste:

```cron
30 6 * * * cd /path/to/Daily-brief && /usr/bin/node dist/index.js >> /var/log/daily-brief.log 2>&1
```

Run `npm run build` first so `dist/index.js` exists, or point cron at
`npx tsx src/index.ts` directly if `tsx` is available in that environment.

## How the ProjDash slice works

The three buckets are intentionally generic — `status: "in progress"`,
`status: "open"` filtered client-side to `priority: "high"`, and
`unassigned_only: true` — with no hardcoded category names. This is a known
open item: ProjDash's category structure is actively being rewired by hand,
so the pull mechanism only depends on `status`/`priority`/unassigned-ness,
which stay stable across that rewiring. An item already shown in an earlier
bucket (e.g. an in-progress item that's also high priority) is not repeated
in a later one, to keep the email non-redundant.

## How QuickSum selection works

Selection is a Fisher-Yates shuffle over all saved summaries, re-run on every
send — never cached, never "most recent," never progress-based. The point is
to surface the reading queue, not curate it. The one-sentence "hook" prefers
an explicit `hook`/`description` field from `get_summary_by_id`; if the tool
doesn't return one, it falls back to the first sentence of the full summary
content, with a leading markdown `**Label:**` header (real content bodies
consistently open with one) and any remaining bold/italic markers stripped
so raw asterisks don't leak into the rendered email.

## How the Pool section works

LinkHoard already has the right shape for "toss something in, get reminded
about it later": its `links` table, plus a reserved `pool-active` tag on the
`tags` array (mirroring the existing `deep-read` tag pattern in
linkhoard-pwa) for the handful of things you're actively committed to right
now, as opposed to everything else in the hoard.

- **Active** (`GET /api/links?tag=pool-active`): every tagged link, shown
  every send, no cap or rotation — these are "don't forget," not "you might
  enjoy," so hiding one on a given day would defeat the point.
- **Pick**: one random link from everything else, excluding `archived`
  links (already dealt with — resurfacing them as a discovery prompt would
  be noise, same reasoning as excluding done/tabled items from ProjDash's
  triage bucket).

If `LINKHOARD_API_URL` isn't set, the whole section is just skipped — this
is a deployment state (not configured yet), not a failure.

## Design

Mobile-first, single column, matching the existing project-plan/idea-board
aesthetic: Lato for body text, DM Mono for eyebrow labels, dark green
(`#1d4a30`) header with white text, rounded white cards on a light gray
background, generous padding. See `scripts/preview.ts` / `preview.html` to
check changes visually.

## Explicitly ruled out (see spec)

- Calendar/schedule integration
- Weather
- Full backlog display

## Deferred (not in v1, may revisit)

- Rotating RLOP entry (same rotation pattern as QuickSum picks)
- "Permission to skip" framing on the ProjDash section
- "Yesterday you made progress on X" look-back via `updated_at`
- A single "today's one thing" headline pulled out of the ProjDash slice
- Aging/overdue item surfacing
