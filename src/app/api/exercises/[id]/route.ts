import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!exercise.isCustom) {
    return NextResponse.json(
      { error: "Cannot delete built-in exercises" },
      { status: 403 }
    );
  }

  await prisma.exercise.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
