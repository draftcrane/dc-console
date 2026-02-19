"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
const GOOGLE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || "";
const GOOGLE_PICKER_SCRIPT_URL = "https://apis.google.com/js/api.js";

export interface PickerFile {
  driveFileId: string;
  title: string;
  mimeType: string;
}

/**
 * Hook to manage Google Picker lifecycle.
 * Lazy-loads the Picker API, fetches a short-lived OAuth token,
 * and opens the Picker for file selection.
 *
 * Security: The OAuth token is used immediately and never persisted
 * in localStorage, sessionStorage, or component state.
 */
export function useGooglePicker() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerApiLoaded = useRef(false);

  /** Load the Google Picker API script (lazy, once) */
  const loadPickerApi = useCallback((): Promise<void> => {
    if (pickerApiLoaded.current) return Promise.resolve();
    if (!PICKER_API_KEY) {
      return Promise.reject(new Error("Google Picker API key is not configured"));
    }
    if (!GOOGLE_APP_ID) {
      return Promise.reject(new Error("Google App ID is not configured"));
    }

    return new Promise((resolve, reject) => {
      const withTimeout = (promiseFactory: () => void, ms: number, label: string) => {
        const timeout = window.setTimeout(() => {
          reject(new Error(`${label} timed out`));
        }, ms);
        const clear = () => window.clearTimeout(timeout);
        return { clear, run: promiseFactory };
      };

      const handleLoaded = () => {
        if (!window.gapi) {
          reject(new Error("Google API client was not available after script load"));
          return;
        }

        window.gapi.load("picker", () => {
          if (!window.google?.picker) {
            reject(new Error("Google Picker API failed to initialize"));
            return;
          }
          pickerApiLoaded.current = true;
          resolve();
        });
      };

      // Check if gapi is already loaded
      if (window.gapi) {
        handleLoaded();
        return;
      }

      // Reuse existing script tag if already injected.
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${GOOGLE_PICKER_SCRIPT_URL}"]`,
      );
      if (existing) {
        const loadedFlag = existing.getAttribute("data-dc-loaded") === "true";
        const failedFlag = existing.getAttribute("data-dc-failed") === "true";
        if (loadedFlag && !failedFlag) {
          handleLoaded();
          return;
        }

        if (failedFlag) {
          existing.remove();
        } else {
          const timer = withTimeout(() => {}, 10000, "Google Picker script load");
          existing.addEventListener(
            "load",
            () => {
              timer.clear();
              handleLoaded();
            },
            { once: true },
          );
          existing.addEventListener(
            "error",
            () => {
              timer.clear();
              reject(new Error("Failed to load Google Picker API script"));
            },
            { once: true },
          );
          timer.run();
          return;
        }
      }

      // Load the gapi script
      const script = document.createElement("script");
      script.src = GOOGLE_PICKER_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      const timer = withTimeout(() => {}, 10000, "Google Picker script load");
      script.onload = () => {
        script.setAttribute("data-dc-loaded", "true");
        script.setAttribute("data-dc-failed", "false");
        timer.clear();
        handleLoaded();
      };
      script.onerror = () => {
        script.setAttribute("data-dc-failed", "true");
        timer.clear();
        reject(new Error("Failed to load Google Picker API script"));
      };
      document.head.appendChild(script);
      timer.run();
    });
  }, []);

  /** Fetch a short-lived OAuth token from our API for Picker use.
   * If connectionId is provided, fetches token scoped to that specific connection. */
  const fetchPickerToken = useCallback(
    async (connectionId?: string): Promise<string> => {
      const token = await getToken();
      const url = connectionId
        ? `${API_URL}/drive/picker-token/${connectionId}`
        : `${API_URL}/drive/picker-token`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (body?.code === "DRIVE_NOT_CONNECTED") {
          throw new Error("Connect Google Drive first, then try adding sources.");
        }
        throw new Error(body?.error || "Failed to get Picker token");
      }
      const data = await response.json();
      return data.accessToken;
    },
    [getToken],
  );

  /**
   * Open the Google Picker for file selection.
   * Optionally accepts a connectionId to scope the Picker to a specific Drive account.
   * Returns selected files, or empty array if cancelled.
   */
  const openPicker = useCallback(
    async (connectionId?: string): Promise<PickerFile[]> => {
      try {
        setIsLoading(true);
        setError(null);

        // Load Picker API and fetch token in parallel
        const [, oauthToken] = await Promise.all([loadPickerApi(), fetchPickerToken(connectionId)]);
        console.info(JSON.stringify({ event: "picker_open_started" }));

        return new Promise<PickerFile[]>((resolve) => {
          const view = new google.picker.DocsView()
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
            .setMimeTypes(
              "application/vnd.google-apps.document,application/vnd.google-apps.folder",
            );

          const picker = new google.picker.PickerBuilder()
            .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
            .setDeveloperKey(PICKER_API_KEY)
            .setAppId(GOOGLE_APP_ID)
            .setOAuthToken(oauthToken)
            .setCallback((data: google.picker.ResponseObject) => {
              if (data.action === google.picker.Action.PICKED && data.docs) {
                const files: PickerFile[] = data.docs.map((doc) => ({
                  driveFileId: doc.id,
                  title: doc.name,
                  mimeType: doc.mimeType,
                }));
                console.info(
                  JSON.stringify({
                    event: "picker_open_success",
                    selectedCount: files.length,
                  }),
                );
                setIsLoading(false);
                resolve(files);
              } else if (data.action === google.picker.Action.CANCEL) {
                console.info(JSON.stringify({ event: "picker_open_cancelled" }));
                setIsLoading(false);
                resolve([]);
              } else if (data.action === google.picker.Action.ERROR || data.action === "error") {
                const message = data.error || "Google Picker failed to load. Try again.";
                console.error(JSON.stringify({ event: "picker_open_error", message }));
                setError(message);
                setIsLoading(false);
                resolve([]);
              }
            })
            .setOrigin(window.location.protocol + "//" + window.location.host)
            .setTitle("Select source documents")
            .addView(view)
            .build();

          picker.setVisible(true);
        });
      } catch (err) {
        console.error("Picker open failed:", err);
        setError(err instanceof Error ? err.message : "Failed to open file picker");
        setIsLoading(false);
        return [];
      }
    },
    [loadPickerApi, fetchPickerToken],
  );

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return { openPicker, isLoading, error, resetError };
}
