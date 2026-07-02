import "dotenv/config";
import { Pool } from "pg";

const connectionString = getRequiredEnv("DATABASE_URL");

const pool = new Pool({ connectionString });

try {
  await pool.query("drop schema if exists public cascade");
  await pool.query("drop schema if exists drizzle cascade");
  await pool.query("create schema public");
  await pool.query("grant all on schema public to public");
  console.info("Database schema reset.");
} finally {
  await pool.end();
}

function getRequiredEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}
