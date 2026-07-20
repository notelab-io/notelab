import assert from "node:assert/strict";
import test from "node:test";

import { sendEmail } from "./email";

const message = {
  subject: "Welcome",
  text: "Thanks for signing up.",
  to: "user@example.com",
};

test("prints email locally when SMTP is not configured", async (context) => {
  const info = context.mock.method(console, "info", () => undefined);

  await sendEmail({}, message);

  assert.equal(info.mock.callCount(), 5);
  assert.equal(info.mock.calls[1]?.arguments[0], "To: user@example.com");
});

test("validates SMTP configuration before connecting", async () => {
  await assert.rejects(
    sendEmail({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "invalid" }, message),
    /SMTP_PORT must be an integer/,
  );
  await assert.rejects(
    sendEmail({ SMTP_HOST: "smtp.example.com", SMTP_USER: "user" }, message),
    /SMTP_USER and SMTP_PASSWORD must be configured together/,
  );
  await assert.rejects(
    sendEmail({ SMTP_HOST: "smtp.example.com", SMTP_SECURE: "maybe" }, message),
    /SMTP_SECURE must be either true or false/,
  );
});
