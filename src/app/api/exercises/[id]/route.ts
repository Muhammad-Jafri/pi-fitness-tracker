import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const UpdateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["upper", "lower", "core"]),
});

async function getCustomExercise(id: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!exercise.isCustom) return { error: NextResponse.json({ error: "Cannot modify built-in exercises" }, { status: 403 }) };
  return { exercise };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await getCustomExercise(id);
  if (error) return error;

  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await prisma.exercise.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Name already taken" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await getCustomExercise(id);
  if (error) return error;

  // Delete orphaned sets first (no cascade on Exercise → WorkoutSet)
  await prisma.workoutSet.deleteMany({ where: { exerciseId: id } });
  await prisma.exercise.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
