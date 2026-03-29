import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateExerciseSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["upper", "lower", "core"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [
        { isCustom: false },                    // built-ins: visible to all
        { isCustom: true, userId: session.user.id }, // custom: only owner's
      ],
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(exercises);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CreateExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Ensure name is unique for this user's custom exercises
  const existing = await prisma.exercise.findFirst({
    where: { userId: session.user.id, name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json({ error: "Name already taken" }, { status: 409 });
  }

  const exercise = await prisma.exercise.create({
    data: { ...parsed.data, isCustom: true, userId: session.user.id },
  });
  return NextResponse.json(exercise, { status: 201 });
}
