import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, magicLink, organization } from "better-auth/plugins";
import { db, type Database } from "./db";
import * as schema from "./db/schema";
import { sendConsoleEmail } from "./email";
import {
  getClientOrigins,
  getPrimaryClientOrigin,
  getRequiredStringEnv,
} from "./config";

type AuthEnv = Record<string, unknown>;
type AuthCacheEntry = {
  auth: Auth;
  database: Database;
};

const authCache = new WeakMap<object, AuthCacheEntry>();

export function createAuth(
  env: AuthEnv,
  request: Request,
  database: Database = db,
): Auth {
  const cached = typeof env === "object" && env ? authCache.get(env) : undefined;

  if (cached?.database === database) {
    return cached.auth;
  }

  const auth = createAuthInstance(env, request, database);

  if (typeof env === "object" && env) {
    authCache.set(env, { auth, database });
  }

  return auth;
}

function createAuthInstance(env: AuthEnv, request: Request, database: Database) {
  const requestUrl = new URL(request.url);

  return betterAuth({
    baseURL: getBaseURL(env),
    secret: getRequiredStringEnv(env, "BETTER_AUTH_SECRET"),
    trustedOrigins: getTrustedOrigins(env, requestUrl),
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    ...sharedAuthOptions(env),
  });
}

function sharedAuthOptions(env: AuthEnv) {
  return {
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
          const inviteLink = `${getPrimaryClientOrigin(env)}/accept-invitation?id=${data.id}`;

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
  };
}

function getBaseURL(env: AuthEnv) {
  const configuredUrl = getRequiredStringEnv(env, "BETTER_AUTH_URL");

  new URL(configuredUrl);

  return configuredUrl;
}

function getTrustedOrigins(env: AuthEnv, requestUrl: URL) {
  const configuredOrigins = getClientOrigins(env);

  return Array.from(new Set([requestUrl.origin, ...configuredOrigins]));
}

export type Auth = ReturnType<typeof createAuthInstance>;
