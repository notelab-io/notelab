import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, magicLink, organization } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendConsoleEmail } from "./email";
import { clientOrigins, primaryClientOrigin } from "./config";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: clientOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendConsoleEmail({
          to: email,
          subject: `Your Notelab ${type} code`,
          text: `Use this one-time code for ${type}: ${otp}`,
        });
      },
    }),
    magicLink({
      async sendMagicLink({ email, url }) {
        await sendConsoleEmail({
          to: email,
          subject: "Your Notelab magic link",
          text: `Open this link to sign in to Notelab:\n\n${url}`,
        });
      },
    }),
    organization({
      teams: {
        enabled: true,
      },
      async sendInvitationEmail(data) {
        const inviteLink = `${primaryClientOrigin}/accept-invitation?id=${data.id}`;

        await sendConsoleEmail({
          to: data.email,
          subject: `Invitation to join ${data.organization.name} on Notelab`,
          text: [
            `${data.inviter.user.name} (${data.inviter.user.email}) invited you to ${data.organization.name}.`,
            "",
            `Accept the invitation: ${inviteLink}`,
          ].join("\n"),
        });
      },
    }),
  ],
});

export type Auth = typeof auth;
