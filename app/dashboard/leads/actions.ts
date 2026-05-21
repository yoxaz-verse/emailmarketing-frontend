"use server";

import { serverFetch } from "@/lib/server/server-fetch";

export type ImportReport = {
  success: boolean;
  insertedCount: number;
  duplicateCount: number;
  invalidCount: number;
  duplicateEmails: string[];
  invalidRows: Array<{ index: number; reason: string; row: Record<string, unknown> }>;
  warnings?: string[];
  skippedFields?: string[];
};

export type ImportUiError = {
  userMessage: string;
  statusCode?: number;
  raw?: string;
};

export async function runEmailValidationAction() {
  return await serverFetch<{ success: boolean; queued: number; runId: string; message: string }>("/validate/lead/start", {
    method: "POST",
    body: JSON.stringify({ mode: "pending" }),
  });
}

export async function rerunFailedValidationAction() {
  return await serverFetch<{ success: boolean; queued: number; runId: string; message: string }>("/validate/lead/start", {
    method: "POST",
    body: JSON.stringify({ mode: "rerun_failed" }),
  });
}

export async function resetStuckAndRerunAction() {
  return await serverFetch<{ success: boolean; queued: number; runId: string; message: string }>("/validate/lead/reset-stuck-rerun", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function forceUnlockAndRerunAction() {
  return await serverFetch<{
    success: boolean;
    queued: number;
    runId: string;
    newRunId?: string;
    previousRunId?: string | null;
    message: string;
  }>("/validate/lead/force-unlock-rerun", {
    method: "POST",
    body: JSON.stringify({ mode: "pending" }),
  });
}

export type ValidationRunStatusResponse = {
  success: boolean;
  status: "idle" | "queued" | "running" | "completed" | "failed";
  run: null | {
    id: string;
    type: "pending" | "rerun_failed";
    status: "queued" | "running" | "completed" | "failed";
    started_at: string;
    finished_at: string | null;
    total_targeted: number;
    processed_count: number;
    success_count: number;
    risky_count: number;
    invalid_count: number;
    failed_count: number;
    updated_at: string;
  };
  metrics: {
    totalTargeted: number;
    processed: number;
    remaining: number;
    inProgress: number;
    completionPercent: number;
  };
  availability?: {
    pendingAvailable: number;
    processingNow: number;
    stuckProcessing?: number;
    recentUpdates?: number;
    lastProgressAt?: string | null;
    lastProcessedLeadAt?: string | null;
    runAgeSeconds?: number;
    totalLeads: number;
    topReasons?: Array<{ reason: string; count: number }>;
    stepFailureCounts?: Record<string, number>;
    mostFailedStep?: {
      key: string;
      label: string;
      count: number;
    } | null;
  };
};

export async function getValidationRunStatusAction() {
  return await serverFetch<ValidationRunStatusResponse>("/validate/lead/status", {
    method: "GET",
  });
}

export type LeadFolder = {
  id: string;
  name: string;
  lead_count: number;
  created_at: string;
  updated_at: string;
};

export async function listLeadFoldersAction() {
  const response = await serverFetch<{ success: boolean; folders: LeadFolder[] }>("/lead-folders", { method: "GET" });
  return response.folders ?? [];
}

export async function createLeadFolderAction(name: string) {
  return await serverFetch<{ success: boolean; folder: LeadFolder }>("/lead-folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function assignLeadsToFolderAction(folderId: string, leadIds: string[]) {
  return await serverFetch<{ success: boolean; inserted: number }>(`/lead-folders/${folderId}/members`, {
    method: "POST",
    body: JSON.stringify({ lead_ids: leadIds }),
  });
}

export async function deleteLeadsBulkAction(leadIds: string[]) {
  const ids = Array.from(new Set((leadIds ?? []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
  if (ids.length === 0) {
    throw new Error('No selected leads to delete.');
  }

  return await serverFetch<{ success: boolean; deletedCount: number }>(`/crud/leads/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function uploadImportedLeadsAction(payload: {
  fileType: "csv" | "xlsx";
  mapping: Record<
    string,
    | string
    | {
        mode: "combine";
        columns: string[];
        separator?: "," | " " | "\n";
      }
  >;
  rows: Record<string, unknown>[];
  operator_id?: string;
  source?: string;
  tags?: string[];
}): Promise<ImportReport> {
  try {
    return await serverFetch<ImportReport>("/operator/leads/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    const statusCode = err?.statusCode as number | undefined;
    const raw = err?.raw || err?.message || "Unknown error";
    const message = String(err?.message || "").toLowerCase();

    let userMessage = "Lead import failed. Please retry.";

    if (
      message.includes("unauthenticated") ||
      message.includes("unauthorized") ||
      statusCode === 401
    ) {
      userMessage = "Your session expired. Please log out and log in again, then retry import.";
    } else if (
      message.includes("forbidden") ||
      message.includes("insufficient permissions") ||
      message.includes("operator access required") ||
      statusCode === 403
    ) {
      userMessage = "Access denied. You do not have permission to import leads with this account.";
    } else if (message.includes("backend unavailable")) {
      userMessage = "Backend unavailable. Please start backend and retry.";
    } else if (message.includes("operator_id is required")) {
      userMessage = "Select an operator before importing.";
    } else if (message.includes("schema fallback")) {
      userMessage = "Import failed due to schema mismatch. Apply migrations and retry.";
    }

    const uiError: ImportUiError = {
      userMessage,
      statusCode,
      raw,
    };

    throw new Error(JSON.stringify(uiError));
  }
}
