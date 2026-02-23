"use client";

import { useState, useCallback } from "react";
import { DriveFolderPicker } from "./drive-folder-picker";
import type { SourceConnection } from "@/hooks/use-sources";

export interface ExportDestination {
  type: "device" | "drive";
  connectionId?: string;
  email?: string;
  folderId?: string;
  folderPath?: string;
}

interface ExportDestinationPickerProps {
  fileName: string;
  connections: SourceConnection[];
  projectTitle: string;
  /** Current default destination (for edit mode) */
  currentDefault?: ExportDestination | null;
  /** Whether this is edit mode (opened from menu, not export flow) */
  editMode?: boolean;
  onSave: (destination: ExportDestination, rememberDefault: boolean) => void;
  onClear?: () => void;
  onDismiss: () => void;
}

/**
 * ExportDestinationPicker — bottom sheet for choosing where to save an export.
 *
 * Shows "This Device" and connected Drive accounts as destination options.
 * "Always save exports here" checkbox to remember the choice.
 * In edit mode, shows current default with "Clear default" option.
 */
export function ExportDestinationPicker({
  fileName,
  connections,
  projectTitle,
  currentDefault,
  editMode = false,
  onSave,
  onClear,
  onDismiss,
}: ExportDestinationPickerProps) {
  const [selected, setSelected] = useState<ExportDestination>(() => {
    if (currentDefault) return currentDefault;
    return { type: "device" };
  });
  const [rememberDefault, setRememberDefault] = useState(!!currentDefault);
  const [folderPickerOpen, setFolderPickerOpen] = useState<string | null>(null);

  // Drive folder state per connection
  const [driveFolders, setDriveFolders] = useState<
    Record<string, { folderId: string; folderPath: string }>
  >(() => {
    if (currentDefault?.type === "drive" && currentDefault.connectionId) {
      return {
        [currentDefault.connectionId]: {
          folderId: currentDefault.folderId || "",
          folderPath: currentDefault.folderPath || `${projectTitle} / _exports`,
        },
      };
    }
    return {};
  });

  const handleSelectDevice = useCallback(() => {
    setSelected({ type: "device" });
    setFolderPickerOpen(null);
  }, []);

  const handleSelectDrive = useCallback(
    (connection: SourceConnection) => {
      const folder = driveFolders[connection.driveConnectionId];
      setSelected({
        type: "drive",
        connectionId: connection.driveConnectionId,
        email: connection.email,
        folderId: folder?.folderId,
        folderPath: folder?.folderPath || `${projectTitle} / _exports`,
      });
      setFolderPickerOpen(null);
    },
    [driveFolders, projectTitle],
  );

  const handleFolderSelected = useCallback(
    (connectionId: string, folderId: string, folderPath: string) => {
      setDriveFolders((prev) => ({
        ...prev,
        [connectionId]: { folderId, folderPath },
      }));
      setSelected((prev) => ({
        ...prev,
        folderId,
        folderPath,
      }));
      setFolderPickerOpen(null);
    },
    [],
  );

  const handleSave = useCallback(() => {
    onSave(selected, rememberDefault);
  }, [selected, rememberDefault, onSave]);

  // If folder picker is open, show it instead of the main picker
  if (folderPickerOpen) {
    const folder = driveFolders[folderPickerOpen];
    return (
      <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center">
        <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-xl">
          <DriveFolderPicker
            connectionId={folderPickerOpen}
            initialFolderId={folder?.folderId}
            initialFolderName={folder?.folderPath?.split(" / ").pop()}
            onSelect={(folderId, folderPath) =>
              handleFolderSelected(folderPickerOpen, folderId, folderPath)
            }
            onCancel={() => setFolderPickerOpen(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {editMode ? "Export Destination" : "Save Export"}
            </h2>
            {!editMode && <p className="text-xs text-gray-500 truncate mt-0.5">{fileName}</p>}
          </div>
          <button
            onClick={onDismiss}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Destinations */}
        <div className="px-4 py-3 space-y-2">
          {/* This Device */}
          <button
            onClick={handleSelectDevice}
            className={`w-full text-left p-3 rounded-lg border transition-colors min-h-[44px] ${
              selected.type === "device"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-gray-600 shrink-0"
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
              <div>
                <p className="text-sm font-medium text-gray-900">This Device</p>
                <p className="text-xs text-gray-500">Save to your Downloads folder</p>
              </div>
            </div>
          </button>

          {/* Drive accounts */}
          {connections.map((connection) => {
            const folder = driveFolders[connection.driveConnectionId];
            const isSelected =
              selected.type === "drive" && selected.connectionId === connection.driveConnectionId;

            return (
              <button
                key={connection.driveConnectionId}
                onClick={() => handleSelectDrive(connection)}
                className={`w-full text-left p-3 rounded-lg border transition-colors min-h-[44px] ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-600 shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Google Drive</p>
                    <p className="text-xs text-gray-500 truncate">{connection.email}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {folder?.folderPath || `${projectTitle} / _exports`}
                    </p>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderPickerOpen(connection.driveConnectionId);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 mt-1 min-h-[32px]"
                      >
                        Change folder...
                      </button>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Remember checkbox */}
        <div className="px-4 py-2">
          <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDefault}
              onChange={(e) => setRememberDefault(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Always save exports here</span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2">
          {editMode && currentDefault && onClear && (
            <button
              onClick={onClear}
              className="h-10 px-4 text-sm text-red-600 hover:bg-red-50 rounded-lg
                         transition-colors min-h-[44px]"
            >
              Clear default
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleSave}
            className="h-10 px-6 text-sm font-medium text-white bg-blue-600 rounded-lg
                       hover:bg-blue-700 min-h-[44px]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
