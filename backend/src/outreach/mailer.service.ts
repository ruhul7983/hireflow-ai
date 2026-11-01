// src/outreach/mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const UNSUBSCRIBE_FOOTER =
  '\n\n--\nNot interested? Reply "unsubscribe" and we won\'t contact you again.';

type Mailbox = { transporter: Transporter; from: string };

export type OutgoingEmail = {
  to: string;
  senderName: string;
  subject: string;
  body: string;
  inReplyTo?: string;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private mailbox: Promise<Mailbox> | null = null;

  constructor(private readonly configService: ConfigService) {}

  // Without SMTP settings, mail goes to a throwaway Ethereal inbox. It is really
  // sent and can be opened from a preview link, but never reaches the candidate.
  private async connect(): Promise<Mailbox> {
    const host = this.configService.get<string>('SMTP_HOST');

    if (host) {
      const user = this.configService.get<string>('SMTP_USER');
      const port = Number(this.configService.get('SMTP_PORT') ?? 587);

      return {
        from: this.configService.get<string>('SMTP_FROM') ?? user ?? '',
        transporter: nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: user
            ? { user, pass: this.configService.get<string>('SMTP_PASS') }
            : undefined,
        }),
      };
    }

    const account = await nodemailer.createTestAccount();
    this.logger.warn('SMTP_HOST is not set, so email goes to an Ethereal test inbox');

    return {
      from: account.user,
      transporter: nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
    };
  }

  private getMailbox() {
    this.mailbox ??= this.connect().catch((error: Error) => {
      // Lets the next attempt reconnect instead of reusing the failure
      this.mailbox = null;
      throw error;
    });
    return this.mailbox;
  }

  async send({ to, senderName, subject, body, inReplyTo }: OutgoingEmail) {
    const { transporter, from } = await this.getMailbox();

    const info = await transporter.sendMail({
      from: { name: senderName, address: from },
      to,
      subject,
      text: `${body}${UNSUBSCRIBE_FOOTER}`,
      inReplyTo,
      references: inReplyTo,
    });

    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null,
    };
  }
}
