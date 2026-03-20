"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Exercise, AnalyticsFilter, AnalyticsDataPoint } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  upper: "bg-blue-500/10 text-blue-700 border-blue-200",
  lower: "bg-green-500/10 text-green-700 border-green-200",
  core: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const STORAGE_KEY_EXERCISE = "selectedExerciseId";
const STORAGE_KEY_FILTER = "analyticsFilter";

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AnalyticsFilter>("week");
  const [chartData, setChartData] = useState<AnalyticsDataPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // Load exercises
  useEffect(() => {
    fetch("/api/exercises")
      .then((r) => r.json())
      .then((data: Exercise[]) => {
        setExercises(data);
        // Restore from localStorage or pick first
        const saved = localStorage.getItem(STORAGE_KEY_EXERCISE);
        const match = data.find((e) => e.id === saved);
        setSelectedId(match ? match.id : data[0]?.id ?? null);
      });
    const savedFilter = localStorage.getItem(STORAGE_KEY_FILTER) as AnalyticsFilter | null;
    if (savedFilter) setFilter(savedFilter);
  }, []);

  // Persist selections
  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY_EXERCISE, selectedId);
  }, [selectedId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FILTER, filter);
  }, [filter]);

  // Fetch analytics data
  useEffect(() => {
    if (!selectedId) return;
    setLoadingChart(true);
    fetch(`/api/analytics/${selectedId}?filter=${filter}`)
      .then((r) => r.json())
      .then((data: AnalyticsDataPoint[]) => {
        setChartData(data);
        setLoadingChart(false);
      });
  }, [selectedId, filter]);

  const selected = exercises.find((e) => e.id === selectedId);
  const totalReps = chartData.reduce((acc, d) => acc + d.reps, 0);
  const bestPoint = chartData.reduce(
    (best, d) => (d.reps > best.reps ? d : best),
    { label: "—", reps: 0 }
  );
  const activeDays = chartData.filter((d) => d.reps > 0).length;

  return (
    <div className="flex gap-0 h-full -m-6">
      {/* MASTER */}
      <div className="w-56 shrink-0 border-r overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Exercises
          </h2>
        </div>
        {exercises.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No exercises.</p>
        )}
        {exercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => setSelectedId(ex.id)}
            className={cn(
              "w-full text-left px-4 py-3 border-b text-sm transition-colors",
              ex.id === selectedId
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            )}
          >
            <div className="font-medium">{ex.name}</div>
            <div
              className={cn(
                "text-xs mt-0.5 capitalize",
                ex.id === selectedId ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {ex.category}
            </div>
          </button>
        ))}
      </div>

      {/* DETAIL */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <p className="text-muted-foreground text-sm">Select an exercise.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <Badge
                  variant="outline"
                  className={cn("capitalize text-xs", CATEGORY_COLORS[selected.category])}
                >
                  {selected.category}
                </Badge>
              </div>
              <Tabs
                value={filter}
                onValueChange={(v) => setFilter(v as AnalyticsFilter)}
              >
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Chart */}
            <div className="h-56 mb-6">
              {loadingChart ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : chartData.every((d) => d.reps === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No data for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={32} />
                    <Tooltip
                      formatter={(value) => [`${value} reps`, "Reps"]}
                    />
                    <Bar dataKey="reps" radius={[4, 4, 0, 0]} className="fill-primary" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Total Reps
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{totalReps}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Best {filter === "month" ? "Month" : filter === "week" ? "Day" : "Set"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{bestPoint.reps}</p>
                  <p className="text-xs text-muted-foreground">{bestPoint.label}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Active {filter === "month" ? "Months" : filter === "week" ? "Days" : "Sets"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{activeDays}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
