"use client";

import { useEffect, useState } from "react";
import { Trash2, Pencil, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditSessionModal } from "@/components/EditSessionModal";
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
  const [showDetail, setShowDetail] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);

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

  function selectSession(id: string) {
    setSelectedId(id);
    setShowDetail(true);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/workouts/${id}`, { method: "DELETE" });
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null);
        setShowDetail(false);
      }
      return next;
    });
  }

  function handleEdit(session: WorkoutSession, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingSession(session);
  }

  const selected = sessions.find((s) => s.id === selectedId);

  return (
    <>
      <div className="flex gap-0 -m-4 md:-m-6 h-full">

        {/* MASTER — full screen on mobile when !showDetail, fixed width on desktop */}
        <div className={cn(
          "shrink-0 border-r overflow-y-auto flex-col",
          "w-full md:w-56 md:flex",
          showDetail ? "hidden md:flex" : "flex"
        )}>
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Sessions
            </h2>
          </div>
          {sessions.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No sessions yet.</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => selectSession(s.id)}
              className={cn(
                "group w-full text-left px-4 py-3 border-b text-sm transition-colors cursor-pointer flex items-center justify-between",
                s.id === selectedId
                  ? "bg-zinc-200"
                  : "hover:bg-accent"
              )}
            >
              <div>
                <div className="font-medium">
                  {new Date(s.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <div className="text-xs mt-0.5 text-muted-foreground">
                  {s.sets?.length ?? 0} sets
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleEdit(s, e)}
                  className="p-1 rounded text-muted-foreground hover:bg-black/5"
                  title="Edit session"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={(e) => handleDelete(s.id, e)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-black/5"
                  title="Delete session"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* DETAIL — full screen on mobile when showDetail, flex-1 on desktop */}
        <div className={cn(
          "flex-1 overflow-y-auto flex-col min-w-0",
          "md:flex",
          showDetail ? "flex" : "hidden md:flex"
        )}>
          {/* Mobile back button */}
          {showDetail && (
            <button
              onClick={() => setShowDetail(false)}
              className="md:hidden flex items-center gap-1 px-4 py-3 text-sm text-muted-foreground border-b hover:bg-accent"
            >
              <ChevronLeft size={16} />
              Sessions
            </button>
          )}

          <div className="p-4 md:p-6">
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
                          <div key={s.id} className="bg-muted rounded-md px-3 py-1.5 text-sm">
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
      </div>

      <EditSessionModal
        session={editingSession}
        onOpenChange={(open) => { if (!open) setEditingSession(null); }}
        onSaved={fetchSessions}
      />
    </>
  );
}
