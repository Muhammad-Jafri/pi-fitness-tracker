"use client";

import { useState } from "react";
import { LogWorkoutModal } from "@/components/LogWorkoutModal";
import { Button } from "@/components/ui/button";

export function LogWorkoutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Log Workout
      </Button>
      <LogWorkoutModal open={open} onOpenChange={setOpen} />
    </>
  );
}
