import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AnalyticsDataPoint } from "@/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const { exerciseId } = await params;
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "week";

  const now = new Date();

  if (filter === "week") {
    // Current Mon–Sun
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const sets = await prisma.workoutSet.findMany({
      where: {
        exerciseId,
        session: { date: { gte: monday, lte: sunday } },
      },
      include: { session: true },
    });

    // Aggregate: Mon=1 … Sun=0, map to Mon–Sun (index 0–6)
    const totals = [0, 0, 0, 0, 0, 0, 0]; // Mon=0 … Sun=6
    for (const s of sets) {
      const jsDay = new Date(s.session.date).getDay(); // 0=Sun,1=Mon…6=Sat
      const idx = (jsDay + 6) % 7; // Mon=0…Sun=6
      totals[idx] += s.reps;
    }

    const data: AnalyticsDataPoint[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
      (label, i) => ({ label, reps: totals[i] })
    );
    return NextResponse.json(data);
  }

  if (filter === "month") {
    // Jan–Dec of current year
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const sets = await prisma.workoutSet.findMany({
      where: {
        exerciseId,
        session: { date: { gte: yearStart, lte: yearEnd } },
      },
      include: { session: true },
    });

    const totals = new Array(12).fill(0);
    for (const s of sets) {
      const month = new Date(s.session.date).getMonth(); // 0–11
      totals[month] += s.reps;
    }

    const data: AnalyticsDataPoint[] = MONTH_LABELS.map((label, i) => ({
      label,
      reps: totals[i],
    }));
    return NextResponse.json(data);
  }

  // day: today's sets grouped by session
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const sets = await prisma.workoutSet.findMany({
    where: {
      exerciseId,
      session: { date: { gte: todayStart, lte: todayEnd } },
    },
    include: { session: true },
    orderBy: { setNumber: "asc" },
  });

  const data: AnalyticsDataPoint[] = sets.map((s) => ({
    label: `Set ${s.setNumber}`,
    reps: s.reps,
  }));

  return NextResponse.json(data);
}
