import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpdateSetSchema = z.object({
  exerciseId: z.string(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weight: z.number().positive().nullable().optional(),
});

const UpdateWorkoutSchema = z.object({
  sets: z.array(UpdateSetSchema).min(1),
});

async function getOwnedSession(id: string, userId: string) {
  const workoutSession = await prisma.workoutSession.findUnique({ where: { id } });
  if (!workoutSession) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (workoutSession.userId !== userId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { workoutSession };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await getOwnedSession(id, session.user.id);
  if (error) return error;

  const full = await prisma.workoutSession.findUnique({
    where: { id },
    include: {
      sets: {
        include: { exercise: true },
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
      },
    },
  });

  return NextResponse.json(full);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await getOwnedSession(id, session.user.id);
  if (error) return error;

  const body = await request.json();
  const parsed = UpdateWorkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Replace all sets: delete existing, create new ones
  await prisma.workoutSet.deleteMany({ where: { sessionId: id } });
  const updated = await prisma.workoutSession.update({
    where: { id },
    data: {
      sets: {
        create: parsed.data.sets.map((s) => ({
          exerciseId: s.exerciseId,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: s.weight ?? null,
        })),
      },
    },
    include: { sets: { include: { exercise: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await getOwnedSession(id, session.user.id);
  if (error) return error;

  await prisma.workoutSession.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
