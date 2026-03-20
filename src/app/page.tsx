"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WorkoutSession } from "@/types";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function totalReps(session: WorkoutSession) {
  return session.sets?.reduce((acc, s) => acc + s.reps, 0) ?? 0;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  function fetchSessions() {
    fetch("/api/workouts")
      .then((r) => r.json())
      .then(setSessions);
  }

  useEffect(() => {
    fetchSessions();
    window.addEventListener("workout-saved", fetchSessions);
    return () => window.removeEventListener("workout-saved", fetchSessions);
  }, []);

  const recent = sessions.slice(0, 5);

  // Streak: consecutive days with at least one session (from today backwards)
  function calcStreak() {
    if (sessions.length === 0) return 0;
    const days = new Set(
      sessions.map((s) =>
        new Date(s.date).toLocaleDateString("en-CA") // YYYY-MM-DD
      )
    );
    let streak = 0;
    const cursor = new Date();
    while (days.has(cursor.toLocaleDateString("en-CA"))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  const streak = calcStreak();
  const totalSessions = sessions.length;
  const thisWeekSessions = sessions.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return d >= monday;
  }).length;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Your fitness at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Streak
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{streak}</p>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{thisWeekSessions}</p>
            <p className="text-xs text-muted-foreground">sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Sessions</h3>
          <Link href="/workouts" className="text-sm text-muted-foreground hover:underline">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions yet. Hit <strong>+ Log Workout</strong> to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => {
              const exercises = [
                ...new Set(s.sets?.map((set) => set.exercise?.name).filter(Boolean)),
              ] as string[];
              return (
                <Link
                  key={s.id}
                  href="/workouts"
                  className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{formatDate(s.date)}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {exercises.slice(0, 3).map((name) => (
                        <Badge key={name} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                      {exercises.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{exercises.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {totalReps(s)} reps
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
