import nodemailer from "nodemailer";
import { config } from "../config.js";

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
  });
}
