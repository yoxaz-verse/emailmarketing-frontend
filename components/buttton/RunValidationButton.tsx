"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { runEmailValidationAction } from "@/app/dashboard/leads/actions";

export function RunValidationButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await runEmailValidationAction();
      setMessage("Email validation started");
    } catch (err: any) {
      setMessage(err.message || "Failed to start validation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Starting…" : "Run Email Validation"}
      </Button>

      {message && (
        <div className="text-xs text-muted-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
