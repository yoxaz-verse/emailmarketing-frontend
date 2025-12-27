"use client";

import { Button } from "@/components/ui/button";

export function RunValidationButton() {
  const handleClick = async () => {
    await fetch("/api/leads/run-validation", {
      method: "POST",
    });
  };

  return (
    <Button onClick={handleClick}>
      Run Email Validation
    </Button>
  );
}
