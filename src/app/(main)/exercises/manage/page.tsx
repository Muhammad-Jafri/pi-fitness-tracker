"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import type { Exercise, ExerciseCategory } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  upper: "bg-blue-500/10 text-blue-700 border-blue-200",
  lower: "bg-green-500/10 text-green-700 border-green-200",
  core: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const CATEGORIES: ExerciseCategory[] = ["upper", "lower", "core"];

const ExerciseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(["upper", "lower", "core"]),
});
type ExerciseForm = z.infer<typeof ExerciseSchema>;

export default function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    const data = await fetch("/api/exercises").then((r) => r.json());
    setExercises(data);
  }

  useEffect(() => { refresh(); }, []);

  const grouped = CATEGORIES.reduce<Record<ExerciseCategory, Exercise[]>>(
    (acc, cat) => {
      acc[cat] = exercises.filter((e) => e.category === cat);
      return acc;
    },
    { upper: [], lower: [], core: [] }
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/exercises/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Exercise Library</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>+ Add Exercise</Button>
      </div>

      {CATEGORIES.map((cat) => (
        <section key={cat} className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 capitalize">
            {cat}
          </h2>
          <div className="rounded-lg border divide-y">
            {grouped[cat].length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">No {cat} exercises.</p>
            )}
            {grouped[cat].map((ex) => (
              <div key={ex.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{ex.name}</span>
                  {ex.isCustom && (
                    <Badge variant="outline" className="text-xs">custom</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {ex.isCustom ? (
                    <>
                      <button
                        onClick={() => setEditTarget(ex)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(ex)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn("text-xs capitalize", CATEGORY_COLORS[ex.category])}
                    >
                      built-in
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Add Dialog */}
      <ExerciseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={refresh}
      />

      {/* Edit Dialog */}
      <ExerciseDialog
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        exercise={editTarget ?? undefined}
        onSaved={refresh}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete exercise?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be permanently deleted.
            Any sets logged with this exercise will also be removed.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Shared Add / Edit dialog
function ExerciseDialog({
  open,
  onOpenChange,
  exercise,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise?: Exercise;
  onSaved: () => void;
}) {
  const isEdit = !!exercise;
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, setError, formState: { errors } } =
    useForm<ExerciseForm>({
      resolver: zodResolver(ExerciseSchema),
      defaultValues: { name: "", category: "upper" },
    });

  // Pre-fill when editing
  useEffect(() => {
    if (open && exercise) {
      reset({ name: exercise.name, category: exercise.category });
    } else if (!open) {
      reset({ name: "", category: "upper" });
    }
  }, [open, exercise, reset]);

  async function onSubmit(values: ExerciseForm) {
    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/exercises/${exercise!.id}` : "/api/exercises",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      if (res.status === 409) {
        setError("name", { message: "Name already taken" });
        return;
      }
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Exercise" : "Add Exercise"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <input
              {...register("name")}
              placeholder="e.g. Muscle-up"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={watch("category")}
              onValueChange={(v) => setValue("category", v as ExerciseCategory)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upper">Upper</SelectItem>
                <SelectItem value="lower">Lower</SelectItem>
                <SelectItem value="core">Core</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
