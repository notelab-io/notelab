import type { Auth } from "./auth";

export type WorkersAiBinding = {
  run: (...args: unknown[]) => Promise<unknown>;
};

export type HyperdriveBinding = {
  connectionString: string;
};

type AuthSession = Auth["$Infer"]["Session"]["session"] & {
  activeOrganizationId?: string | null;
  activeTeamId?: string | null;
};

type ApiKeyContext = {
  id: string;
  organizationId: string;
  referenceId: string;
};

export type AppBindings = {
  Bindings: {
    AI?: WorkersAiBinding;
    HYPERDRIVE: HyperdriveBinding;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    CLIENT_URL: string;
    OAUTH_STATE_SECRET: string;
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_SECRET?: string;
    GITHUB_OAUTH_CLIENT_ID?: string;
    GITHUB_OAUTH_CLIENT_SECRET?: string;
    SLACK_OAUTH_CLIENT_ID?: string;
    SLACK_OAUTH_CLIENT_SECRET?: string;
    LINEAR_OAUTH_CLIENT_ID?: string;
    LINEAR_OAUTH_CLIENT_SECRET?: string;
  };
  Variables: {
    apiKey: ApiKeyContext | null;
    authMethod: "apiKey" | "session" | null;
    user: Auth["$Infer"]["Session"]["user"] | null;
    session: AuthSession | null;
  };
};
