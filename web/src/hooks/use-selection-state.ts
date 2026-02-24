"use client";

import { useState, useCallback, useMemo } from "react";

type CheckState = "checked" | "unchecked" | "indeterminate";

interface SelectionState {
  /** Whether the root source is selected */
  rootSelected: boolean;
  /** Directly selected folders (folder.id -> name) */
  selectedFolders: Map<string, string>;
  /** Directly selected documents (doc.id -> {id, name, mimeType}) */
  selectedDocuments: Map<string, { id: string; name: string; mimeType: string }>;
  /** Excluded items (item.id -> { name, type }) */
  exclusions: Map<string, { name: string; type: "folder" | "document" }>;
  /** Folder IDs that have at least one excluded descendant (for indeterminate display) */
  foldersWithExclusions: Set<string>;
}

/**
 * useSelectionState — manages tri-state checkbox selection for the Drive browser.
 *
 * Uses an exclusion model: selecting a folder includes everything inside it by default.
 * Users can then deselect specific items, which become exclusions.
 *
 * parentChain: derived from breadcrumbs.map(b => b.id), represents the ancestry path.
 */
export function useSelectionState() {
  const [rootSelected, setRootSelected] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Map<string, string>>(new Map());
  const [selectedDocuments, setSelectedDocuments] = useState<
    Map<string, { id: string; name: string; mimeType: string }>
  >(new Map());
  const [exclusions, setExclusions] = useState<
    Map<string, { name: string; type: "folder" | "document" }>
  >(new Map());
  const [foldersWithExclusions, setFoldersWithExclusions] = useState<Set<string>>(new Set());

  /**
   * Check if an item has a selected ancestor in the parentChain.
   * Returns the ancestor ID if found, null otherwise.
   */
  const findSelectedAncestor = useCallback(
    (parentChain: string[]): string | null => {
      if (rootSelected) return "root";
      for (const parentId of parentChain) {
        if (selectedFolders.has(parentId)) return parentId;
      }
      return null;
    },
    [rootSelected, selectedFolders],
  );

  /**
   * Get the checkbox state for the root source row.
   */
  const getSourceCheckboxState = useCallback((): CheckState => {
    if (!rootSelected) {
      // Check if any individual items are selected
      if (selectedFolders.size > 0 || selectedDocuments.size > 0) return "indeterminate";
      return "unchecked";
    }
    if (exclusions.size > 0) return "indeterminate";
    return "checked";
  }, [rootSelected, selectedFolders.size, selectedDocuments.size, exclusions.size]);

  /**
   * Get the checkbox state for a specific item.
   */
  const getCheckboxState = useCallback(
    (itemId: string, itemType: "folder" | "document", parentChain: string[]): CheckState => {
      // If explicitly excluded, always unchecked
      if (exclusions.has(itemId)) return "unchecked";

      // If has a selected ancestor (including root), it's inherited
      const ancestor = findSelectedAncestor(parentChain);
      if (ancestor) {
        // Inherited checked — but might be indeterminate if this folder has exclusions
        if (itemType === "folder" && foldersWithExclusions.has(itemId)) {
          return "indeterminate";
        }
        return "checked";
      }

      // If directly selected
      if (itemType === "folder" && selectedFolders.has(itemId)) {
        if (foldersWithExclusions.has(itemId)) return "indeterminate";
        return "checked";
      }
      if (itemType === "document" && selectedDocuments.has(itemId)) {
        return "checked";
      }

      return "unchecked";
    },
    [exclusions, findSelectedAncestor, selectedFolders, selectedDocuments, foldersWithExclusions],
  );

  /**
   * Mark a folder in the parentChain as having exclusions (for indeterminate display).
   */
  const markAncestorsWithExclusions = useCallback((parentChain: string[]) => {
    setFoldersWithExclusions((prev) => {
      const next = new Set(prev);
      for (const parentId of parentChain) {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  /**
   * Toggle root selection (entire source).
   */
  const toggleRoot = useCallback(() => {
    if (rootSelected) {
      // Deselect root — clear everything
      setRootSelected(false);
      setExclusions(new Map());
      setFoldersWithExclusions(new Set());
    } else {
      // Select root — clear individual selections, they're now covered by root
      setRootSelected(true);
      setSelectedFolders(new Map());
      setSelectedDocuments(new Map());
      setExclusions(new Map());
      setFoldersWithExclusions(new Set());
    }
  }, [rootSelected]);

  /**
   * Toggle a folder's selection state.
   */
  const toggleFolder = useCallback(
    (folderId: string, folderName: string, parentChain: string[]) => {
      const currentState = getCheckboxState(folderId, "folder", parentChain);

      if (currentState === "checked" || currentState === "indeterminate") {
        // Currently selected (directly or inherited) — deselect
        const ancestor = findSelectedAncestor(parentChain);
        if (ancestor) {
          // Inherited from ancestor — add as exclusion
          setExclusions((prev) => {
            const next = new Map(prev);
            next.set(folderId, { name: folderName, type: "folder" });
            return next;
          });
          markAncestorsWithExclusions(parentChain);
        } else if (selectedFolders.has(folderId)) {
          // Directly selected — remove from selected
          setSelectedFolders((prev) => {
            const next = new Map(prev);
            next.delete(folderId);
            return next;
          });
          // Clean up any exclusions that were inside this folder
          // (they're no longer relevant since the folder is deselected)
          setFoldersWithExclusions((prev) => {
            const next = new Set(prev);
            next.delete(folderId);
            return next;
          });
        }
      } else {
        // Currently unchecked — select
        // If it was an exclusion, remove the exclusion
        if (exclusions.has(folderId)) {
          setExclusions((prev) => {
            const next = new Map(prev);
            next.delete(folderId);
            return next;
          });
          // Recalculate foldersWithExclusions — check if ancestors still have other exclusions
          // For simplicity, we keep the ancestor marks (they'll be recalculated on commit)
        } else {
          // Not inherited — add as direct selection
          setSelectedFolders((prev) => {
            const next = new Map(prev);
            next.set(folderId, folderName);
            return next;
          });
        }
      }
    },
    [
      getCheckboxState,
      findSelectedAncestor,
      selectedFolders,
      exclusions,
      markAncestorsWithExclusions,
    ],
  );

  /**
   * Toggle a document's selection state.
   */
  const toggleDocument = useCallback(
    (file: { id: string; name: string; mimeType: string }, parentChain: string[]) => {
      const currentState = getCheckboxState(file.id, "document", parentChain);

      if (currentState === "checked") {
        // Currently selected — deselect
        const ancestor = findSelectedAncestor(parentChain);
        if (ancestor) {
          // Inherited — add as exclusion
          setExclusions((prev) => {
            const next = new Map(prev);
            next.set(file.id, { name: file.name, type: "document" });
            return next;
          });
          markAncestorsWithExclusions(parentChain);
        } else if (selectedDocuments.has(file.id)) {
          // Directly selected — remove
          setSelectedDocuments((prev) => {
            const next = new Map(prev);
            next.delete(file.id);
            return next;
          });
        }
      } else {
        // Currently unchecked — select
        if (exclusions.has(file.id)) {
          // Was excluded — remove exclusion
          setExclusions((prev) => {
            const next = new Map(prev);
            next.delete(file.id);
            return next;
          });
        } else {
          // No ancestor selected — add as direct selection
          setSelectedDocuments((prev) => {
            const next = new Map(prev);
            next.set(file.id, file);
            return next;
          });
        }
      }
    },
    [
      getCheckboxState,
      findSelectedAncestor,
      selectedDocuments,
      exclusions,
      markAncestorsWithExclusions,
    ],
  );

  /**
   * Get a label for the footer action button.
   */
  const getButtonLabel = useCallback((): string => {
    if (rootSelected) {
      if (exclusions.size > 0) {
        return `Link All (${exclusions.size} excluded)`;
      }
      return "Link All";
    }

    const folderCount = selectedFolders.size;
    const docCount = selectedDocuments.size;

    if (folderCount > 0 && docCount > 0) {
      return `Link ${folderCount} Folder${folderCount !== 1 ? "s" : ""} + ${docCount} Document${docCount !== 1 ? "s" : ""}`;
    }
    if (folderCount > 0) {
      return `Link ${folderCount} Folder${folderCount !== 1 ? "s" : ""}`;
    }
    if (docCount > 0) {
      return `Add ${docCount} Document${docCount !== 1 ? "s" : ""}`;
    }
    return "Add";
  }, [rootSelected, exclusions.size, selectedFolders.size, selectedDocuments.size]);

  /**
   * Whether any selection exists.
   */
  const isEmpty = useMemo(
    () => !rootSelected && selectedFolders.size === 0 && selectedDocuments.size === 0,
    [rootSelected, selectedFolders.size, selectedDocuments.size],
  );

  const state: SelectionState = useMemo(
    () => ({
      rootSelected,
      selectedFolders,
      selectedDocuments,
      exclusions,
      foldersWithExclusions,
    }),
    [rootSelected, selectedFolders, selectedDocuments, exclusions, foldersWithExclusions],
  );

  return {
    state,
    getCheckboxState,
    getSourceCheckboxState,
    toggleRoot,
    toggleFolder,
    toggleDocument,
    getButtonLabel,
    isEmpty,
  };
}
