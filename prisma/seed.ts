import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

async function main() {
  const existing = await prisma.exercise.count({ where: { isCustom: false } });
  if (existing === exercises.length) {
    console.log("Built-in exercises already seeded, skipping.");
    return;
  }

  // Delete and re-seed built-ins (safe — userId is null so no user data is affected)
  await prisma.exercise.deleteMany({ where: { isCustom: false } });
  await prisma.exercise.createMany({
    data: exercises.map((ex) => ({ ...ex, isCustom: false })),
  });

  console.log(`Seeded ${exercises.length} exercises.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
