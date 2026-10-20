import "server-only";
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP is not configured. Set SMTP_* values in .env.local");
  }

  const port = Number(SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendLoginCodeEmail(to: string, code: string, name?: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const html = `
  <div style="background:#faf7f0;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a">
    <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:1px solid #e6dfd0;border-radius:12px;overflow:hidden">
      <div style="background:#0b1f3a;color:#faf7f0;padding:20px 24px;font-size:18px;font-weight:bold">Inventory System</div>
      <div style="padding:24px">
        <p style="margin:0 0 12px">${greeting}</p>
        <p style="margin:0 0 20px">Use this code to finish signing in:</p>
        <div style="font-size:32px;letter-spacing:10px;font-weight:bold;text-align:center;background:#f1ece1;border-radius:8px;padding:16px 0">${code}</div>
        <p style="margin:20px 0 0;font-size:13px;color:#5b6779">This code expires in 10 minutes. If you didn't try to sign in, change your password right away.</p>
      </div>
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: `${code} is your Inventory System sign-in code`,
    text: `Your sign-in code is ${code}. It expires in 10 minutes.`,
    html,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
