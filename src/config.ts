import "dotenv/config";

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name];
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  projdash: {
    // A projdash MCP server can be reached either as a local stdio process
    // or an already-running HTTP/SSE endpoint. Set exactly one.
    command: optionalEnv("PROJDASH_MCP_COMMAND"),
    url: optionalEnv("PROJDASH_MCP_URL"),
  },
  quicksum: {
    // "quicksum-remote" implies an HTTP endpoint, but stdio is supported too
    // in case it's proxied locally.
    command: optionalEnv("QUICKSUM_MCP_COMMAND"),
    url: optionalEnv("QUICKSUM_MCP_URL"),
  },
  content: {
    maxItemsPerSection: envInt("DAILY_BRIEF_MAX_ITEMS_PER_SECTION", 5),
    quicksumPickCount: envInt("DAILY_BRIEF_QUICKSUM_PICKS", 2),
  },
  smtp: {
    host: optionalEnv("SMTP_HOST"),
    port: envInt("SMTP_PORT", 587),
    user: optionalEnv("SMTP_USER"),
    pass: optionalEnv("SMTP_PASS"),
    secure: optionalEnv("SMTP_SECURE") === "true",
  },
  email: {
    from: env("EMAIL_FROM", "Daily Briefing <daily-briefing@localhost>"),
    to: env("EMAIL_TO", "tnewsome829@gmail.com"),
    subjectPrefix: optionalEnv("EMAIL_SUBJECT_PREFIX") ?? "Daily Briefing",
  },
};
