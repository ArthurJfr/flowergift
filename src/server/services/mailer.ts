import nodemailer from 'nodemailer';
import { RESOLUTIONS, createScene, renderFrame, toEmailHtml } from '../../engine/index.js';
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
  const resolution = RESOLUTIONS[0];
  if (!resolution) throw new Error('résolution manquante');
  const scene = createScene({
    bouquetId: gift.bouquetId,
    style: gift.style,
    wrap: gift.wrap,
    cols: resolution.cols,
    rows: resolution.rows,
    seed: 1,
    petals: false,
  });
  const preview = toEmailHtml(renderFrame(scene, 6, 6, 0), { style: gift.style, t: 6 });
  const message = gift.message?.trim() ? escapeHtml(gift.message.trim()) : 'Un bouquet t’attend.';
  const from = escapeHtml(gift.fromName);
  const url = escapeHtml(gift.shareUrl);
  const subject = `${gift.fromName} t’offre un bouquet`;
  const text = [gift.message?.trim() || 'Un bouquet t’attend.', '', `Ouvre le cadeau : ${gift.shareUrl}`, '', `De la part de ${gift.fromName}`].join('\n');
  const html = `<div style="font-family:Georgia,serif;color:#2a211c">
<p>${message.replaceAll('\n', '<br>')}</p>
<p><a href="${url}" style="display:inline-block;background:#b5526a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px">Ouvrir le cadeau</a></p>
${preview}
<p style="color:#6d5c52;font-size:13px">De la part de ${from}. Toute personne qui a le lien peut voir le cadeau.</p>
</div>`;
  return { to: gift.recipientEmail ?? '', subject, html, text };
}
