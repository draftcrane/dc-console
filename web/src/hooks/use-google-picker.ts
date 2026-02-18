"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
const GOOGLE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || "";

interface PickerFile {
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

    return new Promise((resolve, reject) => {
      // Check if gapi is already loaded
      if (window.gapi) {
        window.gapi.load("picker", () => {
          pickerApiLoaded.current = true;
          resolve();
        });
        return;
      }

      // Load the gapi script
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = () => {
        window.gapi!.load("picker", () => {
          pickerApiLoaded.current = true;
          resolve();
        });
      };
      script.onerror = () => reject(new Error("Failed to load Google Picker API"));
      document.head.appendChild(script);
    });
  }, []);

  /** Fetch a short-lived OAuth token from our API for Picker use */
  const fetchPickerToken = useCallback(async (): Promise<string> => {
    const token = await getToken();
    const response = await fetch(`${API_URL}/drive/picker-token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to get Picker token. Is Google Drive connected?");
    const data = await response.json();
    return data.accessToken;
  }, [getToken]);

  /**
   * Open the Google Picker for file selection.
   * Returns selected files, or empty array if cancelled.
   */
  const openPicker = useCallback(async (): Promise<PickerFile[]> => {
    try {
      setIsLoading(true);
      setError(null);

      // Load Picker API and fetch token in parallel
      const [, oauthToken] = await Promise.all([loadPickerApi(), fetchPickerToken()]);

      return new Promise<PickerFile[]>((resolve) => {
        const view = new google.picker.DocsView()
          .setIncludeFolders(false)
          .setMimeTypes("application/vnd.google-apps.document");

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
              setIsLoading(false);
              resolve(files);
            } else if (data.action === google.picker.Action.CANCEL) {
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
      setError(err instanceof Error ? err.message : "Failed to open file picker");
      setIsLoading(false);
      return [];
    }
  }, [loadPickerApi, fetchPickerToken]);

  return { openPicker, isLoading, error };
}
