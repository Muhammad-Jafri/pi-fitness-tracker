import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateExerciseSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["upper", "lower", "core"]),
});

export async function GET() {
  const exercises = await prisma.exercise.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(exercises);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = CreateExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const exercise = await prisma.exercise.create({
    data: { ...parsed.data, isCustom: true },
  });
  return NextResponse.json(exercise, { status: 201 });
}
