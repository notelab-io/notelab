export const port = Number(process.env.PORT ?? 3000);

export const clientOrigins = (process.env.CLIENT_URL ?? "http://localhost:1420")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const primaryClientOrigin = clientOrigins[0] ?? "http://localhost:1420";
