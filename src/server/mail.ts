import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoi de courriel par SMTP (A14). Sans SMTP_HOST, le message est écrit dans le journal
 * de l'application : le fonctionnement n'est pas bloqué en développement.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.info(`[courriel non envoyé — SMTP non configuré] À : ${message.to} | Objet : ${message.subject}\n${message.text}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? "RessourcesPéda <no-reply@localhost>",
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
