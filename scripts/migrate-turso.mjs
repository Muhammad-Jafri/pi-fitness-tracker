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

  try {
    await client.executeMultiple(sql);
    await client.execute({
      sql: "INSERT INTO _migrations (name) VALUES (?)",
      args: [dir],
    });
    console.log(`✓ Applied: ${dir}`);
    count++;
  } catch (err) {
    console.error(`✗ Failed to apply ${dir}:`, err.message);
    process.exit(1);
  }
}

console.log(count === 0 ? "No pending migrations." : `${count} migration(s) applied.`);
process.exit(0);
