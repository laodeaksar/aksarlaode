import { env } from "@repo/env/email-worker";

import {
  BaseProvider,
  type SendMailOptions,
  type SendResult,
} from "./base.provider";

export class MailChannelsProvider extends BaseProvider {
  readonly name = "MailChannels";

  async send(options: SendMailOptions): Promise<SendResult> {
    const recipients = Array.isArray(options.to)
      ? options.to.map((email) => ({ email }))
      : [{ email: options.to }];

    try {
      const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: recipients }],
          from: {
            email: options.from ?? env.MAIL_FROM_ADDRESS,
            name: env.MAIL_FROM_NAME,
          },
          reply_to: options.replyTo ? { email: options.replyTo } : undefined,
          subject: options.subject,
          content: [{ type: "text/html", value: options.html }],
        }),
      });

      // 202 = accepted
      if (res.status === 202) return { success: true };

      const body = await res.text();

      // 4xx = fatal (bad input, invalid email) — don't retry
      if (res.status >= 400 && res.status < 500) {
        return { success: false, error: body, retryable: false };
      }

      // 5xx = transient — retry
      return { success: false, error: body, retryable: true };
    } catch (e) {
      // Network error — retry
      return { success: false, error: String(e), retryable: true };
    }
  }
}
