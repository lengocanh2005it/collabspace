export type SendBasicEmailInput = {
  bcc?: string | string[];
  cc?: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  to: string | string[];
};

export type SendHtmlEmailInput = SendBasicEmailInput & {
  html: string;
  text?: string;
};

export type SendTextEmailInput = SendBasicEmailInput & {
  text: string;
};

export type SendEmailJobPayload = SendBasicEmailInput & {
  html?: string;
  text?: string;
};
