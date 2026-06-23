"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RunValidationButton({
  label = "Run Email Validation",
  successText = "Email validation started",
  onRun,
  disabled = false,
  disabledText,
}: {
  label?: string;
  successText?: string;
  onRun: () => Promise<{ queued?: number } | void>;
  disabled?: boolean;
  disabledText?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await onRun();
      const queued = typeof result?.queued === "number" ? result.queued : null;
      setMessage(queued == null ? successText : `${successText} (${queued} queued)`);
    } catch (err: any) {
      setMessage(err.message || "Failed to start validation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={handleClick}
        disabled={loading || disabled}
      >
        {loading ? "Starting..." : label}
      </Button>

      {!loading && disabled && disabledText && (
        <div className="text-xs text-amber-700 dark:text-amber-400">
          {disabledText}
        </div>
      )}

      {message && (
        <div className="text-xs text-muted-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
