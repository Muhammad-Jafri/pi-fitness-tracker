"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@/types";

const SetSchema = z.object({
  exerciseId: z.string().min(1, "Pick an exercise"),
  reps: z.coerce.number().int().positive("Must be > 0"),
  weight: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
});

const FormSchema = z.object({
  sets: z.array(SetSchema).min(1),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogWorkoutModal({ open, onOpenChange }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormValues, unknown, FormValues>({
      resolver: zodResolver(FormSchema) as never,
      defaultValues: { sets: [{ exerciseId: "", reps: 10, weight: "" }] },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "sets" });

  useEffect(() => {
    fetch("/api/exercises")
      .then((r) => r.json())
      .then(setExercises);
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) reset({ sets: [{ exerciseId: "", reps: 10, weight: "" }] });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const setsWithNumber = values.sets.map((s, i) => ({
        exerciseId: s.exerciseId,
        reps: s.reps,
        weight: s.weight !== "" && s.weight !== undefined ? Number(s.weight) : null,
        setNumber: i + 1,
      }));
      await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sets: setsWithNumber }),
      });
      onOpenChange(false);
      window.dispatchEvent(new Event("workout-saved"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Workout</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10 shrink-0">
                  Set {index + 1}
                </span>
                <Select
                  value={watch(`sets.${index}.exerciseId`)}
                  onValueChange={(val) => setValue(`sets.${index}.exerciseId`, val ?? "")}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Exercise">
                      {exercises.find((ex) => ex.id === watch(`sets.${index}.exerciseId`))?.name ?? "Exercise"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {exercises.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="number"
                  min={1}
                  {...register(`sets.${index}.reps`)}
                  placeholder="Reps"
                  className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-center"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  {...register(`sets.${index}.weight`)}
                  placeholder="kg"
                  className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-center"
                />
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-destructive text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.sets && (
            <p className="text-xs text-destructive">
              {errors.sets.message ?? "Check your sets"}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => append({ exerciseId: "", reps: 10, weight: "" })}
          >
            + Add Set
          </Button>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save Workout"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
