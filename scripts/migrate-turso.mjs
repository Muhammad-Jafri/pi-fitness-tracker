/**
 * Applies pending Prisma migrations to Turso at build time.
 * Tracks applied migrations in a _migrations table in Turso.
 * Run as part of the Vercel build command before next build.
 */

import { createClient } from "@libsql/client";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "prisma", "migrations");

if (!process.env.TURSO_DATABASE_URL) {
  console.log("No TURSO_DATABASE_URL — skipping Turso migration.");
  process.exit(0);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create migrations tracking table if it doesn't exist
await client.execute(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT NOT NULL PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Get already-applied migrations
const { rows } = await client.execute("SELECT name FROM _migrations");
const applied = new Set(rows.map((r) => r.name));

// Read migration directories in chronological order
const dirs = readdirSync(migrationsDir).sort();
let count = 0;

for (const dir of dirs) {
  if (applied.has(dir)) continue;

  const sqlPath = join(migrationsDir, dir, "migration.sql");
  if (!existsSync(sqlPath)) continue;

  const sql = readFileSync(sqlPath, "utf8");

  // Run each statement individually so "already exists" skips only that
  // statement rather than silently swallowing the entire migration file.
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  let failed = false;
  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err) {
      if (err.message?.includes("already exists") || err.message?.includes("duplicate column")) {
        console.log(`  ↷ Skipped (already exists): ${stmt.slice(0, 60)}…`);
      } else {
        console.error(`✗ Failed in ${dir}:`, err.message);
        console.error(`  Statement: ${stmt}`);
        failed = true;
        break;
      }
    }
  }

  if (failed) process.exit(1);

  await client.execute({
    sql: "INSERT OR IGNORE INTO _migrations (name) VALUES (?)",
    args: [dir],
  });
  console.log(`✓ Applied: ${dir}`);
  count++;
}

console.log(count === 0 ? "No pending migrations." : `${count} migration(s) applied.`);
process.exit(0);
