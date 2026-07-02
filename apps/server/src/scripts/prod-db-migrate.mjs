import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const tempDir = path.join(projectRoot, ".wrangler", "prod-db-migrator");
const workerName = "notelab-prod-db-migrator";
const action = process.argv[2] ?? "migrate";
const resetConfirmed = process.argv.includes("--confirm-production-reset");

if (!["status", "migrate", "reset"].includes(action)) {
  console.error("Usage: node src/scripts/prod-db-migrate.mjs <status|migrate|reset>");
  process.exit(1);
}

if (action === "reset" && !resetConfirmed) {
  console.error(
    "Refusing to reset production DB without --confirm-production-reset.",
  );
  process.exit(1);
}

if (action === "reset") {
  console.warn("Resetting production DB: this drops public and drizzle schemas.");
}

const wranglerConfig = readJsonc(path.join(projectRoot, "wrangler.jsonc"));
const hyperdrive = wranglerConfig.hyperdrive?.find(
  (binding) => binding.binding === "HYPERDRIVE",
);

if (!hyperdrive?.id) {
  throw new Error("Could not find HYPERDRIVE binding id in wrangler.jsonc");
}

const migrations = readMigrations();
const token = crypto.randomBytes(32).toString("hex");

fs.mkdirSync(tempDir, { recursive: true });
fs.writeFileSync(path.join(tempDir, "migrator.mjs"), buildWorker(migrations));
fs.writeFileSync(
  path.join(tempDir, "wrangler.jsonc"),
  JSON.stringify(
    {
      name: workerName,
      main: "migrator.mjs",
      compatibility_date:
        wranglerConfig.compatibility_date ??
        new Date().toISOString().slice(0, 10),
      compatibility_flags: wranglerConfig.compatibility_flags ?? [
        "nodejs_compat",
      ],
      workers_dev: true,
      hyperdrive: [
        {
          binding: "HYPERDRIVE",
          id: hyperdrive.id,
        },
      ],
      vars: {
        MIGRATION_TOKEN: token,
      },
    },
    null,
    2,
  ),
);

let deployedUrl;

try {
  const deployOutput = runWrangler([
    "deploy",
    "--config",
    path.join(tempDir, "wrangler.jsonc"),
  ]);
  deployedUrl = findWorkersDevUrl(deployOutput);

  if (!deployedUrl) {
    throw new Error("Could not find workers.dev URL in wrangler deploy output");
  }

  const result = await invokeMigrator(deployedUrl, action, token);
  printResult(action, result);
} finally {
  runWrangler(["delete", workerName, "--force"], { allowFailure: true });
}

function readJsonc(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(
    /(^|\s)\/\/.*$/gm,
    "$1",
  );

  return JSON.parse(withoutLineComments);
}

function readMigrations() {
  const journalPath = path.join(projectRoot, "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));

  return journal.entries.map((entry) => {
    const query = fs.readFileSync(
      path.join(projectRoot, "drizzle", `${entry.tag}.sql`),
      "utf8",
    );

    return {
      tag: entry.tag,
      folderMillis: entry.when,
      hash: crypto.createHash("sha256").update(query).digest("hex"),
      sql: query.split("--> statement-breakpoint"),
    };
  });
}

function runWrangler(args, options = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (result.status !== 0 && !options.allowFailure) {
    process.stdout.write(output);
    throw new Error(`wrangler ${args.join(" ")} failed`);
  }

  return output;
}

function findWorkersDevUrl(output) {
  return output.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0] ?? null;
}

async function invokeMigrator(baseUrl, action, token) {
  const method = action === "status" ? "GET" : "POST";
  const pathName = action === "status" ? "status" : action;
  const response = await fetch(`${baseUrl}/${pathName}`, {
    method,
    headers: {
      "x-migration-token": token,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Production DB ${action} failed (${response.status}): ${JSON.stringify(data)}`,
    );
  }

  return data;
}

function printResult(action, result) {
  if (action === "status") {
    console.log(JSON.stringify(summarizeStatus(result), null, 2));
    return;
  }

  console.log(
    JSON.stringify(
      {
        action,
        applied: result.applied,
        status: summarizeStatus(result.status),
      },
      null,
      2,
    ),
  );
}

function summarizeStatus(status) {
  return {
    connected: status.connected,
    identity: status.identity,
    migrationsInDb: status.migrationsInDb,
    localMigrationCount: status.localMigrationCount,
    pending: status.pending,
    workspaceColumns: status.workspaceColumns,
  };
}

function buildWorker(migrations) {
  return `import pg from "pg";

const { Client } = pg;
const migrations = ${JSON.stringify(migrations)};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function withClient(env, callback) {
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
    connectionTimeoutMillis: 5000,
  });

  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function migrationStatus(client) {
  const [identity, workspaceColumns, migrationTable] = await Promise.all([
    client.query("select current_database() as database, current_user as user"),
    client.query("select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'workspace' order by ordinal_position"),
    client.query("select exists (select 1 from information_schema.tables where table_schema = 'drizzle' and table_name = '__drizzle_migrations') as exists"),
  ]);
  let migrationsInDb = {
    exists: migrationTable.rows[0]?.exists === true,
    count: 0,
    last: null,
  };

  if (migrationsInDb.exists) {
    const summary = await client.query("select count(*)::int as count, max(created_at)::bigint as last_created_at from drizzle.__drizzle_migrations");
    const last = await client.query("select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1");
    migrationsInDb = {
      exists: true,
      count: summary.rows[0]?.count ?? 0,
      last: last.rows[0] ?? null,
    };
  }

  const lastCreatedAt = migrationsInDb.last
    ? Number(migrationsInDb.last.created_at)
    : null;
  const pending = migrations
    .filter((migration) => lastCreatedAt === null || lastCreatedAt < migration.folderMillis)
    .map((migration) => migration.tag);

  return {
    connected: true,
    identity: identity.rows[0],
    workspaceColumns: workspaceColumns.rows,
    migrationsInDb,
    localMigrationCount: migrations.length,
    pending,
  };
}

async function ensureMigrationTable(client) {
  await client.query("create schema if not exists drizzle");
  await client.query("create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)");
}

async function applyPendingMigrations(client) {
  const applied = [];
  await ensureMigrationTable(client);
  const dbMigrations = await client.query("select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1");
  const lastDbMigration = dbMigrations.rows[0];

  for (const migration of migrations) {
    if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
      for (const statement of migration.sql) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }
      await client.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)", [
        migration.hash,
        migration.folderMillis,
      ]);
      applied.push(migration.tag);
    }
  }

  return applied;
}

async function runMigrations(client) {
  await client.query("begin");

  try {
    const applied = await applyPendingMigrations(client);
    await client.query("commit");
    return { applied };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function resetAndMigrate(client) {
  await client.query("begin");

  try {
    await client.query("drop schema if exists drizzle cascade");
    await client.query("drop schema if exists public cascade");
    await client.query("create schema public");
    await client.query("grant all on schema public to public");
    const applied = await applyPendingMigrations(client);
    await client.query("commit");
    return { applied };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export default {
  async fetch(request, env) {
    if (request.headers.get("x-migration-token") !== env.MIGRATION_TOKEN) {
      return new Response("Not found", { status: 404 });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/status") {
        return await withClient(env, async (client) => json(await migrationStatus(client)));
      }

      if (request.method === "POST" && url.pathname === "/migrate") {
        return await withClient(env, async (client) => {
          const applied = await runMigrations(client);
          return json({ ...applied, status: await migrationStatus(client) });
        });
      }

      if (request.method === "POST" && url.pathname === "/reset") {
        return await withClient(env, async (client) => {
          const applied = await resetAndMigrate(client);
          return json({ ...applied, status: await migrationStatus(client) });
        });
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  },
};
`;
}
