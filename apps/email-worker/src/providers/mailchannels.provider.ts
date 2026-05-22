// P0 FIX: Added AbortSignal.timeout(30_000) to the MailChannels fetch call.
// Previously, a hanging API response would hold a BullMQ concurrency slot
// indefinitely — all 5 slots could be exhausted, stalling the entire worker.
// Now the fetch aborts after 30 s and is treated as a retryable network error.
import { env } from "@repo/env/email-worker";

import {
  BaseProvider,
  type SendMailOptions,
  type SendResult,
} from "./base.provider";

const MAILCHANNELS_TIMEOUT_MS = 30_000;

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
        signal: AbortSignal.timeout(MAILCHANNELS_TIMEOUT_MS),
      });

      // 202 = accepted
      if (res.status === 202) return { success: true };

      const body = await res.text();

      // 4xx = fatal (bad input, invalid email) — don't retry
      if (res.status >= 400 && res.status < 500) {
        return { success: false, error: `MailChannels 4xx: ${res.status}`, retryable: false };
      }

      // 5xx = transient — retry
      return { success: false, error: `MailChannels 5xx: ${res.status}`, retryable: true };
    } catch (e) {
      const isTimeout =
        e instanceof DOMException && e.name === "TimeoutError";
      return {
        success: false,
        error: isTimeout ? "MailChannels request timed out" : String(e),
        retryable: true,
      };
    }
  }
}
