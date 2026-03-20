export type ExerciseCategory = "upper" | "lower" | "core";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  isCustom: boolean;
  createdAt: Date;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: string;
  date: Date;
  notes: string | null;
  sets?: WorkoutSet[];
}

// Analytics
export type AnalyticsFilter = "day" | "week" | "month";

export interface AnalyticsDataPoint {
  label: string; // "Mon", "Jan", "10:00" etc.
  reps: number;
}
