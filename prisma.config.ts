import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const isTurso = !!process.env.TURSO_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: isTurso
      ? process.env.TURSO_DATABASE_URL!
      : `file:${path.resolve("./prisma/dev.db")}`,
    adapter: isTurso
      ? new PrismaLibSql({
          url: process.env.TURSO_DATABASE_URL!,
          authToken: process.env.TURSO_AUTH_TOKEN,
        })
      : new PrismaBetterSqlite3({ url: `file:${path.resolve("./prisma/dev.db")}` }),
  },
});
