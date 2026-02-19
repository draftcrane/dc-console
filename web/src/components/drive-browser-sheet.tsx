"use client";

import { useMemo, useState } from "react";
import type { DriveBrowseItem } from "@/hooks/use-drive-browser";

interface DriveBrowserSheetProps {
  isOpen: boolean;
  items: DriveBrowseItem[];
  isLoading: boolean;
  error: string | null;
  canGoBack: boolean;
  onClose: () => void;
  onBack: () => void;
  onOpenFolder: (folderId: string) => void;
  onSelectDocs: (docs: DriveBrowseItem[]) => void;
  isDoc: (item: DriveBrowseItem) => boolean;
  isFolder: (item: DriveBrowseItem) => boolean;
}

const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";

export function DriveBrowserSheet({
  isOpen,
  items,
  isLoading,
  error,
  canGoBack,
  onClose,
  onBack,
  onOpenFolder,
  onSelectDocs,
  isDoc,
  isFolder,
}: DriveBrowserSheetProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const docs = useMemo(
    () => items.filter((item) => isDoc(item)),
    [items, isDoc],
  );
  const folders = useMemo(
    () => items.filter((item) => isFolder(item)),
    [items, isFolder],
  );

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = () => {
    const selected = docs.filter((doc) => selectedIds.has(doc.id));
    if (selected.length > 0) {
      onSelectDocs(selected);
      setSelectedIds(new Set());
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-4 pt-3 pb-2 border-b border-gray-200 flex items-center gap-2">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-40"
            aria-label="Back"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Browse Google Drive</h2>
            <p className="text-xs text-gray-500">Select Google Docs to add as sources</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
          {isLoading && (
            <div className="text-sm text-gray-500">Loading...</div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          {!isLoading && !error && folders.length === 0 && docs.length === 0 && (
            <div className="text-sm text-gray-500">No Google Docs found in this folder.</div>
          )}

          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onOpenFolder(folder.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left"
            >
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="text-sm text-gray-900 truncate">{folder.name}</span>
            </button>
          ))}

          {docs.map((doc) => (
            <label
              key={doc.id}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(doc.id)}
                onChange={() => toggle(doc.id)}
                className="h-4 w-4"
              />
              <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-900 truncate">{doc.name}</div>
                <div className="text-xs text-gray-500">{GOOGLE_DOC_MIME_TYPE === doc.mimeType ? "Google Doc" : doc.mimeType}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleAdd}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Add to Sources
          </button>
        </div>
      </div>
    </>
  );
}
