export type RuntimeEnv = Record<string, unknown>;

export function getClientOrigins(env: RuntimeEnv) {
  return getRequiredStringEnv(env, "CLIENT_URL")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getPrimaryClientOrigin(env: RuntimeEnv) {
  const [origin] = getClientOrigins(env);

  if (!origin) {
    throw new Error("CLIENT_URL must include at least one origin");
  }

  return origin;
}

export function getStringEnv(env: RuntimeEnv, key: string) {
  const value = env[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getRequiredStringEnv(env: RuntimeEnv, key: string) {
  const value = getStringEnv(env, key);

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}
