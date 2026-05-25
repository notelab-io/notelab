import "dotenv/config";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/notelab";

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
