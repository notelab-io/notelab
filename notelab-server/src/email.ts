type ConsoleEmail = {
  to: string;
  subject: string;
  text: string;
};

export async function sendConsoleEmail({ to, subject, text }: ConsoleEmail) {
  console.info("\n--- Notelab local email ---");
  console.info(`To: ${to}`);
  console.info(`Subject: ${subject}`);
  console.info(text);
  console.info("--- end email ---\n");
}
