import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migration CLI always uses local SQLite (DATABASE_URL).
// Turso is handled at runtime via db.ts based on ENVIRONMENT.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
