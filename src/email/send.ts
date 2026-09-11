import nodemailer from "nodemailer";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Referenced from render.ts via "cid:linkhoard-icon" — inline data URIs get
// stripped by Gmail on receipt, so the icon has to travel as a real
// attachment with a Content-ID instead.
const POOL_ICON_PATH = path.join(__dirname, "assets", "linkhoard-icon.png");

export async function sendBriefEmail(subject: string, html: string, text: string): Promise<void> {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (see .env.example)."
    );
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  await transporter.sendMail({
    from: config.email.from,
    to: config.email.to,
    subject,
    html,
    text,
    attachments: [{ filename: "linkhoard-icon.png", path: POOL_ICON_PATH, cid: "linkhoard-icon" }],
  });
}
