"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Poll interval in milliseconds */
const POLL_INTERVAL_MS = 3_000;
/** Max poll timeout in minutes */
const MAX_POLL_TIMEOUT_MINUTES = 30;

interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalBatches: number;
  completedBatches: number;
  resultText: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface UseDeepAnalysisReturn {
  startJob: (projectId: string, jobId: string, totalBatches: number) => void;
  jobId: string | null;
  status: "pending" | "processing" | "completed" | "failed" | null;
  totalBatches: number;
  completedBatches: number;
  resultText: string | null;
  error: string | null;
  isPolling: boolean;
  reset: () => void;
}

/**
 * Hook for polling deep analysis job status.
 *
 * On mount, checks /jobs/latest to recover any active job.
 * When startJob is called, begins polling /jobs/:jobId every 3 seconds.
 * Stops when status is completed or failed, or on timeout.
 */
export function useDeepAnalysis(projectId: string): UseDeepAnalysisReturn {
  const { getToken } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<UseDeepAnalysisReturn["status"]>(null);
  const [totalBatches, setTotalBatches] = useState(0);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [resultText, setResultText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const applyJobStatus = useCallback(
    (job: JobStatus) => {
      setJobId(job.jobId);
      setStatus(job.status);
      setTotalBatches(job.totalBatches);
      setCompletedBatches(job.completedBatches);

      if (job.status === "completed") {
        setResultText(job.resultText);
        setError(null);
        stopPolling();
      } else if (job.status === "failed") {
        setError(job.errorMessage || "Analysis failed");
        stopPolling();
      }
    },
    [stopPolling],
  );

  const pollJob = useCallback(
    async (pId: string, jId: string) => {
      try {
        const token = await getToken();
        if (!token) return;

        const response = await fetch(`${API_URL}/projects/${pId}/research/jobs/${jId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const job = (await response.json()) as JobStatus;
        applyJobStatus(job);
      } catch {
        // Polling errors are non-fatal — keep trying
      }
    },
    [getToken, applyJobStatus],
  );

  const startJob = useCallback(
    (pId: string, jId: string, batches: number) => {
      stopPolling();

      setJobId(jId);
      setStatus("processing");
      setTotalBatches(batches);
      setCompletedBatches(0);
      setResultText(null);
      setError(null);
      setIsPolling(true);

      // Start polling
      intervalRef.current = setInterval(() => {
        pollJob(pId, jId);
      }, POLL_INTERVAL_MS);

      // Timeout: scale with batch count, cap at MAX_POLL_TIMEOUT_MINUTES
      const timeoutMinutes = Math.min(Math.max(5, batches * 2), MAX_POLL_TIMEOUT_MINUTES);
      timeoutRef.current = setTimeout(
        () => {
          stopPolling();
          setError("Analysis timed out. The job may still be processing.");
          setStatus("failed");
        },
        timeoutMinutes * 60 * 1000,
      );
    },
    [stopPolling, pollJob],
  );

  const reset = useCallback(() => {
    stopPolling();
    setJobId(null);
    setStatus(null);
    setTotalBatches(0);
    setCompletedBatches(0);
    setResultText(null);
    setError(null);
  }, [stopPolling]);

  // On mount: check for active jobs via /jobs/latest
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    async function checkLatest() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const response = await fetch(`${API_URL}/projects/${projectId}/research/jobs/latest`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok || cancelled) return;

        const job = (await response.json()) as JobStatus | null;
        if (!job || cancelled) return;

        if (job.status === "pending" || job.status === "processing") {
          // Resume polling
          startJob(projectId, job.jobId, job.totalBatches);
          setCompletedBatches(job.completedBatches);
        } else if (job.status === "completed") {
          applyJobStatus(job);
        }
        // Don't recover failed jobs — user should retry explicitly
      } catch {
        // Non-fatal
      }
    }

    checkLatest();

    return () => {
      cancelled = true;
    };
    // Only run on mount / projectId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startJob,
    jobId,
    status,
    totalBatches,
    completedBatches,
    resultText,
    error,
    isPolling,
    reset,
  };
}
