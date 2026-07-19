import { getStringEnv, type RuntimeEnv } from "./config";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DEFAULT_EMAIL_FROM = "Zilobase <hello@zilobase.com>";

export async function sendEmail(env: RuntimeEnv, email: EmailMessage) {
  const apiKey = getStringEnv(env, "RESEND_API_KEY");

  if (!apiKey) {
    await sendConsoleEmail(email);
    return;
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getStringEnv(env, "EMAIL_FROM") ?? DEFAULT_EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Resend email failed with status ${response.status}: ${responseText}`,
    );
  }
}

async function sendConsoleEmail({ to, subject, text }: EmailMessage) {
  console.info("\n--- Zilobase local email ---");
  console.info(`To: ${to}`);
  console.info(`Subject: ${subject}`);
  console.info(text);
  console.info("--- end email ---\n");
}
