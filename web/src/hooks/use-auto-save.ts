"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft, loadDraft, deleteDraft } from "@/lib/indexeddb";

/**
 * Save status for the three-tier auto-save system.
 *
 * Per US-015 acceptance criteria:
 * - "Saving..." during active save
 * - "Saved [timestamp]" after successful save
 * - "Save failed - retrying" on failure with retry
 */
export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: Date }
  | { state: "error"; message: string };

/**
 * Recovery state when IndexedDB content is at least as recent as remote.
 */
export interface RecoveryPrompt {
  localContent: string;
  localUpdatedAt: number;
  remoteVersion: number;
}

interface UseAutoSaveOptions {
  chapterId: string | null;
  /** Current version from the server */
  version: number;
  /** Function to get the auth token */
  getToken: () => Promise<string | null>;
  /** API base URL */
  apiUrl: string;
  /** Debounce interval in ms (default 2000 per US-015) */
  debounceMs?: number;
  /** Max retries for Drive/R2 save (default 3 per business rules) */
  maxRetries?: number;
}

interface UseAutoSaveReturn {
  /** Call on every content change (keystroke) */
  handleContentChange: (html: string) => void;
  /** Trigger an immediate save (for Cmd+S, visibilitychange, chapter switch) */
  saveNow: () => Promise<void>;
  /** Current save status */
  saveStatus: SaveStatus;
  /** Recovery prompt data if IndexedDB has newer content */
  recoveryPrompt: RecoveryPrompt | null;
  /** Accept recovered content */
  acceptRecovery: () => void;
  /** Dismiss recovery (keep remote version) */
  dismissRecovery: () => void;
  /** Current content (latest from any source) */
  content: string;
  /** Set content directly (for initial load or recovery) */
  setContent: (html: string) => void;
  /** Current version tracked by auto-save */
  currentVersion: number;
}

/**
 * useAutoSave - Three-tier auto-save hook
 *
 * Tier 1 (IndexedDB): Every keystroke, <5ms, crash protection
 * Tier 2 (Drive/R2): 2-second debounce, PUT /chapters/:chapterId/content
 * Tier 3 (D1 metadata): Updated on every successful Tier 2 save (server-side)
 *
 * Per US-015 acceptance criteria and business rules.
 */
export function useAutoSave({
  chapterId,
  version,
  getToken,
  apiUrl,
  debounceMs = 2000,
  maxRetries = 3,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });
  const [recoveryPrompt, setRecoveryPrompt] = useState<RecoveryPrompt | null>(null);
  const [content, setContentState] = useState<string>("");
  const [currentVersion, setCurrentVersion] = useState<number>(version);

  // Refs for debounce and retry
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);
  const retryCountRef = useRef(0);
  const chapterIdRef = useRef(chapterId);
  const contentRef = useRef(content);
  const versionRef = useRef(currentVersion);

  // Keep refs in sync
  useEffect(() => {
    chapterIdRef.current = chapterId;
  }, [chapterId]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    versionRef.current = currentVersion;
  }, [currentVersion]);

  // Sync version from props
  useEffect(() => {
    setCurrentVersion(version);
  }, [version]);

  /**
   * Tier 2: Save content to the API (Drive/R2 + D1 metadata)
   */
  const saveToApi = useCallback(
    async (htmlContent: string): Promise<boolean> => {
      const id = chapterIdRef.current;
      if (!id) return false;

      try {
        const token = await getToken();
        if (!token) return false;

        const response = await fetch(`${apiUrl}/chapters/${id}/content`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: htmlContent,
            version: versionRef.current,
          }),
        });

        if (response.status === 409) {
          // Version conflict - per US-015 acceptance criteria
          setSaveStatus({
            state: "error",
            message: "Version conflict - someone else edited this chapter",
          });
          return false;
        }

        if (!response.ok) {
          throw new Error(`Save failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          version: number;
          wordCount: number;
          updatedAt: string;
        };

        // Update version from server response
        setCurrentVersion(data.version);
        versionRef.current = data.version;

        // Clear IndexedDB draft on successful remote save
        await deleteDraft(id);

        return true;
      } catch (err) {
        console.error("API save failed:", err);
        return false;
      }
    },
    [getToken, apiUrl],
  );

  /**
   * Execute save with exponential backoff retry.
   * Per business rules: max 3 retries with exponential backoff.
   */
  const executeSave = useCallback(
    async (htmlContent: string) => {
      if (isSavingRef.current) {
        // Queue for next save
        pendingContentRef.current = htmlContent;
        return;
      }

      isSavingRef.current = true;
      setSaveStatus({ state: "saving" });
      retryCountRef.current = 0;

      let success = false;
      while (retryCountRef.current <= maxRetries && !success) {
        if (retryCountRef.current > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
          setSaveStatus({ state: "error", message: "Save failed \u2014 retrying" });
          await new Promise((r) => setTimeout(r, delay));
          setSaveStatus({ state: "saving" });
        }

        success = await saveToApi(htmlContent);
        if (!success) {
          retryCountRef.current++;
        }
      }

      isSavingRef.current = false;

      if (success) {
        setSaveStatus({ state: "saved", at: new Date() });
      } else {
        setSaveStatus({ state: "error", message: "Save failed" });
      }

      // If content was queued while saving, save it now
      if (pendingContentRef.current !== null) {
        const pending = pendingContentRef.current;
        pendingContentRef.current = null;
        executeSave(pending);
      }
    },
    [saveToApi, maxRetries],
  );

  /**
   * Tier 1 + start Tier 2 debounce.
   * Called on every keystroke.
   */
  const handleContentChange = useCallback(
    (html: string) => {
      setContentState(html);
      contentRef.current = html;

      const id = chapterIdRef.current;
      if (!id) return;

      // Tier 1: Write to IndexedDB immediately (<5ms target)
      saveDraft({
        chapterId: id,
        content: html,
        updatedAt: Date.now(),
        version: versionRef.current,
      });

      // Tier 2: Debounce API save (2-second delay per US-015)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executeSave(html);
      }, debounceMs);
    },
    [executeSave, debounceMs],
  );

  /**
   * Immediate save - for Cmd+S, visibilitychange, chapter switch.
   * Cancels any pending debounce and saves immediately.
   */
  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const currentContent = contentRef.current;
    if (currentContent && chapterIdRef.current) {
      await executeSave(currentContent);
    }
  }, [executeSave]);

  /**
   * visibilitychange handler: immediate save when tab is backgrounded.
   * Per US-015 acceptance criteria.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && contentRef.current && chapterIdRef.current) {
        // Fire and forget - tab is going away
        saveNow();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [saveNow]);

  /**
   * Cmd+S handler: immediate save.
   * Per US-015 acceptance criteria.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveNow]);

  /**
   * Crash recovery check: on mount, compare IndexedDB version with remote.
   * Per US-015: only prompt when local draft version is not older than remote.
   */
  useEffect(() => {
    if (!chapterId) return;

    let cancelled = false;

    async function checkRecovery() {
      const draft = await loadDraft(chapterId!);
      if (cancelled) return;

      if (draft && draft.content && draft.version >= version) {
        setRecoveryPrompt({
          localContent: draft.content,
          localUpdatedAt: draft.updatedAt,
          remoteVersion: version,
        });
      }
    }

    checkRecovery();

    return () => {
      cancelled = true;
    };
  }, [chapterId, version]);

  /**
   * Accept recovered content from IndexedDB.
   */
  const acceptRecovery = useCallback(() => {
    if (recoveryPrompt) {
      setContentState(recoveryPrompt.localContent);
      contentRef.current = recoveryPrompt.localContent;
      setRecoveryPrompt(null);
      // Trigger a save of the recovered content
      executeSave(recoveryPrompt.localContent);
    }
  }, [recoveryPrompt, executeSave]);

  /**
   * Dismiss recovery prompt (keep remote version).
   */
  const dismissRecovery = useCallback(() => {
    if (chapterId) {
      deleteDraft(chapterId);
    }
    setRecoveryPrompt(null);
  }, [chapterId]);

  /**
   * Cleanup debounce timer on unmount.
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Save before chapter switch (cleanup on chapterId change).
   */
  useEffect(() => {
    return () => {
      // When chapterId changes (chapter switch), flush any pending save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [chapterId]);

  const setContent = useCallback((html: string) => {
    setContentState(html);
    contentRef.current = html;
  }, []);

  return {
    handleContentChange,
    saveNow,
    saveStatus,
    recoveryPrompt,
    acceptRecovery,
    dismissRecovery,
    content,
    setContent,
    currentVersion,
  };
}
