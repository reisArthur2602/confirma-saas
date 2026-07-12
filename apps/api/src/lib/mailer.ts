import { env } from "@confirma/env";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  await resend.emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
  });
}
