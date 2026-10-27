import nodemailer from 'nodemailer';
import type { Config } from '../config.js';
import type { GiftDto } from './gifts.js';

export interface OutboundMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(mail: OutboundMail): Promise<void>;
}

export function createMailer(config: Config): Mailer | null {
  if (!config.smtp) return null;
  const smtp = config.smtp;
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return {
    async send(mail) {
      const fromName = smtp.fromName.replace(/"/g, '');
      await transport.sendMail({
        from: `"${fromName}" <${smtp.fromEmail}>`,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    },
  };
}

export function safeSmtpError(error: unknown, pass: string | undefined): string {
  const message = error instanceof Error ? error.message : 'envoi impossible';
  const hidden = pass && pass.length > 0 ? message.split(pass).join('***') : message;
  return hidden.slice(0, 300);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function giftMail(gift: GiftDto): OutboundMail {
  const message = gift.message?.trim() ? escapeHtml(gift.message.trim()) : 'Un bouquet t’attend.';
  const from = escapeHtml(gift.fromName);
  const url = escapeHtml(gift.shareUrl);
  const subject = `${gift.fromName} t’offre un bouquet`;
  const text = [gift.message?.trim() || 'Un bouquet t’attend.', '', `Ouvre le cadeau : ${gift.shareUrl}`, '', `De la part de ${gift.fromName}`].join('\n');
  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#100c14;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#100c14;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1b1422;border:1px solid #3a2a40;border-radius:28px;">
            <tr>
              <td align="center" style="padding:40px 32px 34px;font-family:Georgia,'Times New Roman',serif;color:#f6efe8;">
                <p style="margin:0;font-size:34px;line-height:1;color:#e56b8a;">✿</p>
                <p style="margin:16px 0 0;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#cbb8ac;">FlowerGift</p>
                <h1 style="margin:16px 0 0;font-size:30px;line-height:1.25;font-weight:normal;">${from} t’offre un bouquet</h1>
                <p style="margin:24px 0 0;font-size:18px;line-height:1.55;color:#f6efe8;">${message.replaceAll('\n', '<br>')}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px auto 0;">
                  <tr>
                    <td bgcolor="#e56b8a" style="border-radius:999px;">
                      <a href="${url}" style="display:inline-block;padding:15px 30px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1;color:#2a1020;text-decoration:none;border-radius:999px;">Ouvrir le cadeau</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:26px 0 0;font-size:13px;line-height:1.5;color:#cbb8ac;">De la part de ${from}.<br>Toute personne qui a le lien peut voir le cadeau.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { to: gift.recipientEmail ?? '', subject, html, text };
}
