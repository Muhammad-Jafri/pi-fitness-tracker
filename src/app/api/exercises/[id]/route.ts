import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { prisma } from "@/lib/db";

const UpdateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["upper", "lower", "core"]),
});

async function getOwnedCustomExercise(id: string, userId: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!exercise.isCustom) return { error: NextResponse.json({ error: "Cannot modify built-in exercises" }, { status: 403 }) };
  if (exercise.userId !== userId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { exercise };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await getOwnedCustomExercise(id, session.user.id);
  if (error) return error;

  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Check name uniqueness for this user (excluding the exercise being updated)
  const conflict = await prisma.exercise.findFirst({
    where: { userId: session.user.id, name: parsed.data.name, NOT: { id } },
  });
  if (conflict) {
    return NextResponse.json({ error: "Name already taken" }, { status: 409 });
  }

  const updated = await prisma.exercise.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await getOwnedCustomExercise(id, session.user.id);
  if (error) return error;

  // Delete orphaned sets first (no cascade on Exercise → WorkoutSet)
  await prisma.workoutSet.deleteMany({ where: { exerciseId: id } });
  await prisma.exercise.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
