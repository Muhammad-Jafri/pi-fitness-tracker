import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.resolve("./prisma/dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const exercises = [
    { name: "Push-up", category: "upper" },
    { name: "Pull-up", category: "upper" },
    { name: "Dip", category: "upper" },
    { name: "Diamond Push-up", category: "upper" },
    { name: "Squat", category: "lower" },
    { name: "Lunge", category: "lower" },
    { name: "Jump Squat", category: "lower" },
    { name: "Calf Raise", category: "lower" },
    { name: "Plank", category: "core" },
    { name: "Crunch", category: "core" },
    { name: "Leg Raise", category: "core" },
    { name: "Mountain Climber", category: "core" },
  ];

  for (const ex of exercises) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {},
      create: { name: ex.name, category: ex.category, isCustom: false },
    });
  }

  console.log(`Seeded ${exercises.length} exercises.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
