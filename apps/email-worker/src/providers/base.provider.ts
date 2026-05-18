export type SendMailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

export type SendResult =
  | { success: true }
  | { success: false; error: string; retryable: boolean };

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract send(options: SendMailOptions): Promise<SendResult>;
}
