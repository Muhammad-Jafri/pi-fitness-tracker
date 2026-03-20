"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkoutSession } from "@/types";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Group sets by exercise within a session
function groupByExercise(sets: WorkoutSession["sets"]) {
  if (!sets) return [];
  const map = new Map<string, { name: string; sets: typeof sets }>();
  for (const s of sets) {
    const name = s.exercise?.name ?? "Unknown";
    if (!map.has(name)) map.set(name, { name, sets: [] });
    map.get(name)!.sets.push(s);
  }
  return Array.from(map.values());
}

export default function WorkoutsPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function fetchSessions() {
    fetch("/api/workouts")
      .then((r) => r.json())
      .then((data: WorkoutSession[]) => {
        setSessions(data);
        if (data.length > 0) setSelectedId((prev) => prev ?? data[0].id);
      });
  }

  useEffect(() => {
    fetchSessions();
    window.addEventListener("workout-saved", fetchSessions);
    return () => window.removeEventListener("workout-saved", fetchSessions);
  }, []);

  const selected = sessions.find((s) => s.id === selectedId);

  return (
    <div className="flex gap-0 h-full -m-6">
      {/* MASTER */}
      <div className="w-56 shrink-0 border-r overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Sessions
          </h2>
        </div>
        {sessions.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No sessions yet.</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={cn(
              "w-full text-left px-4 py-3 border-b text-sm transition-colors",
              s.id === selectedId
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            )}
          >
            <div className="font-medium">
              {new Date(s.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </div>
            <div
              className={cn(
                "text-xs mt-0.5",
                s.id === selectedId ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {s.sets?.length ?? 0} sets
            </div>
          </button>
        ))}
      </div>

      {/* DETAIL */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <p className="text-muted-foreground text-sm">Select a session.</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-1">{formatDate(selected.date)}</h2>
            {selected.notes && (
              <p className="text-sm text-muted-foreground mb-4">{selected.notes}</p>
            )}
            <div className="space-y-6">
              {groupByExercise(selected.sets).map(({ name, sets }) => (
                <div key={name}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{name}</h3>
                    <Badge variant="secondary">{sets.length} sets</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sets.map((s) => (
                      <div
                        key={s.id}
                        className="bg-muted rounded-md px-3 py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground text-xs">Set {s.setNumber} </span>
                        <span className="font-medium">{s.reps} reps</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {sets.reduce((acc, s) => acc + s.reps, 0)} reps
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
