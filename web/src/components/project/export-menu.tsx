"use client";

import { useState, useEffect, useCallback } from "react";
import { useBackup } from "@/hooks/use-backup";
import { useDropdown } from "@/hooks/use-dropdown";
import { useExportPreferences } from "@/hooks/use-export-preferences";
import type { SourceConnection } from "@/hooks/use-sources";
import { ExportDestinationPicker, type ExportDestination } from "./export-destination-picker";

type ExportFormat = "pdf" | "epub";

type DriveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; driveFileId: string; webViewLink: string; folderPath?: string }
  | { phase: "error"; message: string };

type ExportState =
  | { phase: "idle" }
  | { phase: "exporting"; scope: "book" | "chapter" }
  | { phase: "complete"; fileName: string; downloadUrl: string; jobId: string }
  | { phase: "error"; message: string };

/** Phase of post-export delivery flow */
type DeliveryPhase =
  | "none"
  | "auto-delivered"
  | "picker-open"
  | "destination-settings"
  | "resolving-default";

interface ExportMenuProps {
  projectId: string;
  projectTitle?: string;
  activeChapterId: string | null;
  getToken: () => Promise<string | null>;
  apiUrl: string;
  /** Project-scoped Drive connections. When empty, "Save to Drive" is hidden. */
  connections?: SourceConnection[];
}

/**
 * ExportMenu - Dropdown menu for PDF and EPUB export with destination management.
 *
 * Flow:
 * 1. User picks export format from dropdown
 * 2. Export generates server-side
 * 3. On completion:
 *    - If default preference exists & valid → auto-deliver, show confirmation toast
 *    - Otherwise → show destination picker (always; explicit consent required)
 * 4. "Export destination..." menu item opens picker in edit mode
 */
export function ExportMenu({
  projectId,
  projectTitle = "Book",
  activeChapterId,
  getToken,
  apiUrl,
  connections = [],
}: ExportMenuProps) {
  const { isOpen, ref: menuRef, toggle, close } = useDropdown();
  const [state, setState] = useState<ExportState>({ phase: "idle" });
  const [driveState, setDriveState] = useState<DriveState>({ phase: "idle" });
  const [deliveryPhase, setDeliveryPhase] = useState<DeliveryPhase>("none");
  const { downloadBackup, isDownloading } = useBackup();
  const {
    preference,
    isLoading: isPreferenceLoading,
    save: savePreference,
    clear: clearPreference,
  } = useExportPreferences(projectId);

  /**
   * Save the completed export to Google Drive.
   * Per US-021: POST /exports/:jobId/to-drive
   */
  const handleSaveToDrive = useCallback(
    async (connectionId?: string, folderId?: string) => {
      if (state.phase !== "complete") return false;

      setDriveState({ phase: "saving" });

      try {
        const token = await getToken();
        if (!token) {
          setDriveState({ phase: "error", message: "Authentication required" });
          return false;
        }

        const response = await fetch(`${apiUrl}/exports/${state.jobId}/to-drive`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ connectionId, folderId }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const msg =
            (body as { error?: string } | null)?.error || "Failed to save to Google Drive";
          setDriveState({ phase: "error", message: msg });
          return false;
        }

        const result = (await response.json()) as {
          driveFileId: string;
          fileName: string;
          webViewLink: string;
        };

        setDriveState({
          phase: "saved",
          driveFileId: result.driveFileId,
          webViewLink: result.webViewLink,
        });
        return true;
      } catch (err) {
        setDriveState({
          phase: "error",
          message: err instanceof Error ? err.message : "Failed to save to Google Drive",
        });
        return false;
      }
    },
    [state, getToken, apiUrl],
  );

  /**
   * Apply a saved default preference after export completes.
   */
  const applyDefault = useCallback(
    async (fileName: string, downloadUrl: string, jobId: string) => {
      if (!preference) return false;

      // Check for stale Drive default (connection removed)
      if (preference.destinationType === "drive" && !preference.driveConnectionId) {
        // Stale — fall back to picker
        return false;
      }

      if (preference.destinationType === "device") {
        const token = await getToken();
        if (!token) {
          return false;
        }
        const delivered = await triggerDownload(downloadUrl, fileName, token);
        if (!delivered) {
          return false;
        }
        setDeliveryPhase("auto-delivered");
        return true;
      }

      if (preference.destinationType === "drive" && preference.driveConnectionId) {
        // Verify connection still exists
        const conn = connections.find((c) => c.driveConnectionId === preference.driveConnectionId);
        if (!conn) {
          // Connection removed — stale
          return false;
        }

        setDriveState({ phase: "saving" });

        try {
          const token = await getToken();
          if (!token) {
            setDriveState({ phase: "idle" });
            return false;
          }
          setDeliveryPhase("auto-delivered");

          const response = await fetch(`${apiUrl}/exports/${jobId}/to-drive`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connectionId: preference.driveConnectionId,
              folderId: preference.driveFolderId || undefined,
            }),
          });

          if (!response.ok) {
            // Folder might be deleted — fall back to picker
            setDriveState({ phase: "idle" });
            return false;
          }

          const result = (await response.json()) as {
            driveFileId: string;
            fileName: string;
            webViewLink: string;
          };

          setDriveState({
            phase: "saved",
            driveFileId: result.driveFileId,
            webViewLink: result.webViewLink,
            folderPath: preference.driveFolderPath || undefined,
          });
          return true;
        } catch {
          setDriveState({ phase: "idle" });
          return false;
        }
      }

      return false;
    },
    [preference, connections, getToken, apiUrl],
  );

  const handleExport = useCallback(
    async (scope: "book" | "chapter", format: ExportFormat = "pdf") => {
      close();
      setState({ phase: "exporting", scope });
      setDriveState({ phase: "idle" });
      setDeliveryPhase("none");

      try {
        const token = await getToken();
        if (!token) {
          setState({ phase: "error", message: "Authentication required" });
          return;
        }

        const url =
          scope === "book"
            ? `${apiUrl}/projects/${projectId}/export`
            : `${apiUrl}/projects/${projectId}/chapters/${activeChapterId}/export`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ format }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            setState({
              phase: "error",
              message: "Export rate limit reached. Please wait a moment.",
            });
            return;
          }
          const body = await response.json().catch(() => null);
          const msg = (body as { error?: string } | null)?.error || "Export failed";
          setState({ phase: "error", message: msg });
          return;
        }

        const result = (await response.json()) as {
          jobId: string;
          status: string;
          fileName: string | null;
          downloadUrl: string | null;
          error: string | null;
        };

        if (result.status === "failed") {
          setState({
            phase: "error",
            message: result.error || "Export failed",
          });
          return;
        }

        if (result.downloadUrl && result.fileName) {
          setState({
            phase: "complete",
            fileName: result.fileName,
            downloadUrl: result.downloadUrl,
            jobId: result.jobId,
          });

          setDeliveryPhase("resolving-default");

          // Check for saved default preference
          if (!isPreferenceLoading && preference) {
            const applied = await applyDefault(result.fileName, result.downloadUrl, result.jobId);
            if (applied) return;
            // If failed (stale), fall through to picker
          }

          if (!isPreferenceLoading) {
            // No default (or stale default) -> always show picker for explicit consent
            setDeliveryPhase("picker-open");
          }
        } else {
          setState({ phase: "error", message: "Export completed but no download available" });
        }
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Export failed",
        });
      }
    },
    [
      projectId,
      activeChapterId,
      getToken,
      apiUrl,
      preference,
      isPreferenceLoading,
      applyDefault,
      close,
    ],
  );

  /**
   * Handle destination selection from the picker.
   */
  const handleDestinationSave = useCallback(
    async (destination: ExportDestination, rememberDefault: boolean) => {
      setDeliveryPhase("none");

      if (rememberDefault) {
        await savePreference({
          destinationType: destination.type,
          driveConnectionId: destination.connectionId,
          driveFolderId: destination.folderId,
          driveFolderPath: destination.folderPath,
        });
      }

      if (state.phase !== "complete") return;

      if (destination.type === "device") {
        const token = await getToken();
        if (!token) {
          setDeliveryPhase("picker-open");
          return;
        }
        const delivered = await triggerDownload(state.downloadUrl, state.fileName, token);
        setDeliveryPhase(delivered ? "auto-delivered" : "picker-open");
      } else if (destination.type === "drive" && destination.connectionId) {
        const saved = await handleSaveToDrive(destination.connectionId, destination.folderId);
        setDeliveryPhase(saved ? "auto-delivered" : "picker-open");
      }
    },
    [state, getToken, savePreference, handleSaveToDrive],
  );

  /**
   * Handle destination clear from edit mode.
   */
  const handleClearDefault = useCallback(async () => {
    await clearPreference();
    setDeliveryPhase("none");
  }, [clearPreference]);

  const handleDismiss = useCallback(() => {
    setState({ phase: "idle" });
    setDriveState({ phase: "idle" });
    setDeliveryPhase("none");
  }, []);

  /**
   * If export completed before preferences finished loading, resolve delivery
   * once preference fetch settles.
   */
  useEffect(() => {
    if (state.phase !== "complete") return;
    if (deliveryPhase !== "resolving-default") return;
    if (isPreferenceLoading) return;
    const completedState = state;

    let cancelled = false;

    async function resolveDelayedDefault() {
      if (preference) {
        const applied = await applyDefault(
          completedState.fileName,
          completedState.downloadUrl,
          completedState.jobId,
        );
        if (cancelled || applied) return;
      }
      if (!cancelled) {
        setDeliveryPhase("picker-open");
      }
    }

    void resolveDelayedDefault();

    return () => {
      cancelled = true;
    };
  }, [state, deliveryPhase, isPreferenceLoading, preference, applyDefault]);

  const isExporting = state.phase === "exporting" || isDownloading;

  // Build current default for edit mode
  const currentDefault: ExportDestination | null = preference
    ? {
        type: preference.destinationType,
        connectionId: preference.driveConnectionId || undefined,
        email: preference.driveConnectionId
          ? connections.find((c) => c.driveConnectionId === preference.driveConnectionId)?.email
          : undefined,
        folderId: preference.driveFolderId || undefined,
        folderPath: preference.driveFolderPath || undefined,
      }
    : null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Export button */}
      <button
        onClick={() => {
          if (isExporting) return;
          toggle();
        }}
        disabled={isExporting}
        className="min-h-[44px] px-3 text-sm rounded-lg hover:bg-[var(--dc-color-surface-tertiary)] transition-colors min-w-[44px]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center gap-1.5"
        aria-label="Export"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Exporting...</span>
          </>
        ) : (
          "Export"
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          role="menu"
          aria-label="Export options"
        >
          <button
            onClick={() => handleExport("book", "pdf")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Export Book as PDF
          </button>

          <button
            onClick={() => handleExport("book", "epub")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Export Book as EPUB
          </button>

          <div className="border-t border-gray-100 my-1" role="separator" />

          <button
            onClick={() => handleExport("chapter", "pdf")}
            disabled={!activeChapterId}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export This Chapter as PDF
          </button>

          <button
            onClick={() => handleExport("chapter", "epub")}
            disabled={!activeChapterId}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export This Chapter as EPUB
          </button>

          <div className="border-t border-gray-100 my-1" role="separator" />

          {/* Export destination settings */}
          <button
            onClick={() => {
              close();
              setDeliveryPhase("destination-settings");
            }}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Export destination...
          </button>

          <button
            onClick={() => {
              close();
              downloadBackup(projectId);
            }}
            disabled={isDownloading}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {isDownloading ? "Saving..." : "Save to Files"}
          </button>
        </div>
      )}

      {/* Destination picker (post-export or settings) */}
      {(deliveryPhase === "picker-open" || deliveryPhase === "destination-settings") &&
        state.phase === "complete" && (
          <ExportDestinationPicker
            fileName={state.fileName}
            connections={connections}
            projectTitle={projectTitle}
            currentDefault={deliveryPhase === "destination-settings" ? currentDefault : null}
            editMode={deliveryPhase === "destination-settings"}
            onSave={handleDestinationSave}
            onClear={handleClearDefault}
            onDismiss={() => setDeliveryPhase("none")}
          />
        )}

      {/* Destination settings (when no export is active) */}
      {deliveryPhase === "destination-settings" && state.phase !== "complete" && (
        <ExportDestinationPicker
          fileName=""
          connections={connections}
          projectTitle={projectTitle}
          currentDefault={currentDefault}
          editMode
          onSave={async (destination, rememberDefault) => {
            if (rememberDefault) {
              await savePreference({
                destinationType: destination.type,
                driveConnectionId: destination.connectionId,
                driveFolderId: destination.folderId,
                driveFolderPath: destination.folderPath,
              });
            }
            setDeliveryPhase("none");
          }}
          onClear={handleClearDefault}
          onDismiss={() => setDeliveryPhase("none")}
        />
      )}

      {/* Confirmation toast (auto-delivered with default) */}
      {state.phase === "complete" && deliveryPhase === "auto-delivered" && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 shadow-lg z-50 max-w-sm">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1 min-w-0">
              {driveState.phase === "saving" ? (
                <p className="text-sm font-medium text-green-800">Saving to Google Drive...</p>
              ) : driveState.phase === "saved" ? (
                <>
                  <p className="text-sm font-medium text-green-800">Saved to Google Drive</p>
                  {driveState.folderPath && (
                    <p className="text-xs text-green-600 mt-0.5">{driveState.folderPath}</p>
                  )}
                </>
              ) : driveState.phase === "error" ? (
                <>
                  <p className="text-sm font-medium text-red-800">Save failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{driveState.message}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-green-800">Downloaded</p>
                  <p className="text-xs text-green-600 truncate mt-0.5">{state.fileName}</p>
                </>
              )}
              <button
                onClick={() => setDeliveryPhase("picker-open")}
                className="text-xs text-blue-600 hover:text-blue-700 mt-1 min-h-[32px]"
              >
                Change
              </button>
            </div>
            <button
              onClick={handleDismiss}
              className="text-green-500 hover:text-green-700 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Recovery toast: export complete but picker was dismissed */}
      {state.phase === "complete" && deliveryPhase === "none" && (
        <div className="fixed bottom-4 right-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 shadow-lg z-50 max-w-sm">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800">Export ready</p>
              <p className="text-xs text-blue-600 truncate mt-0.5">{state.fileName}</p>
              <button
                onClick={() => setDeliveryPhase("picker-open")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 min-h-[32px]"
              >
                Choose destination
              </button>
            </div>
            <button
              onClick={handleDismiss}
              className="text-blue-400 hover:text-blue-600 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {state.phase === "error" && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 shadow-lg z-50 max-w-sm">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">Export failed</p>
              <p className="text-xs text-red-600 mt-0.5">{state.message}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-red-500 hover:text-red-700 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Trigger a file download by fetching the file with auth and creating a blob URL.
 *
 * Per US-022:
 * - Works on Safari (iPad), Chrome, and Firefox
 * - On iPad Safari, the file is saved to the Files app via the blob download
 * - Uses correct MIME type so the OS knows how to handle the file
 */
async function triggerDownload(
  downloadUrl: string,
  fileName: string,
  token: string,
): Promise<boolean> {
  try {
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return false;

    // Determine the correct MIME type from the response or file extension
    const contentType =
      response.headers.get("Content-Type") ||
      (fileName.endsWith(".epub") ? "application/epub+zip" : "application/pdf");

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    // Set type attribute to help Safari identify the file type
    link.type = contentType;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    // Cleanup after a delay to ensure the download has started
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    }, 5000);
    return true;
  } catch {
    // Download trigger failed silently - user can still use the Download button
    return false;
  }
}

export default ExportMenu;
