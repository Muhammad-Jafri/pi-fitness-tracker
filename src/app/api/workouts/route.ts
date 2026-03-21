import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CreateSetSchema = z.object({
  exerciseId: z.string(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weight: z.number().positive().nullable().optional(),
});

const CreateWorkoutSchema = z.object({
  date: z.string().optional(),
  notes: z.string().optional(),
  sets: z.array(CreateSetSchema).min(1),
});

export async function GET() {
  const sessions = await prisma.workoutSession.findMany({
    orderBy: { date: "desc" },
    include: {
      sets: {
        include: { exercise: true },
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
      },
    },
  });
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = CreateWorkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { date, notes, sets } = parsed.data;

  const session = await prisma.workoutSession.create({
    data: {
      date: date ? new Date(date) : new Date(),
      notes,
      sets: {
        create: sets.map((s) => ({
          exerciseId: s.exerciseId,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: s.weight ?? null,
        })),
      },
    },
    include: {
      sets: { include: { exercise: true } },
    },
  });

  return NextResponse.json(session, { status: 201 });
}
