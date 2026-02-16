/**
 * IndexedDB utility for Tier 1 auto-save (crash protection).
 *
 * Per US-015:
 * - Every keystroke written to IndexedDB (<5ms latency)
 * - Provides crash protection within browser lifetime
 * - IndexedDB does NOT survive iOS killing Safari or browser cache clear
 *
 * Schema: draftcrane_autosave DB with "drafts" object store
 * Key: chapterId
 * Value: { chapterId, content, updatedAt, version }
 */

const DB_NAME = "draftcrane_autosave";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

export interface DraftEntry {
  chapterId: string;
  content: string;
  updatedAt: number; // Unix timestamp ms
  version: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "chapterId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Save draft content to IndexedDB.
 * Designed for <5ms latency per US-015 requirements.
 */
export async function saveDraft(entry: DraftEntry): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // IndexedDB failures are non-fatal; log and continue
    console.warn("IndexedDB saveDraft failed:", err);
  }
}

/**
 * Load draft content from IndexedDB.
 * Returns null if no draft exists for the given chapter.
 */
export async function loadDraft(chapterId: string): Promise<DraftEntry | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(chapterId);
    return new Promise<DraftEntry | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as DraftEntry) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB loadDraft failed:", err);
    return null;
  }
}

/**
 * Delete a draft from IndexedDB (called after successful remote save).
 */
export async function deleteDraft(chapterId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(chapterId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB deleteDraft failed:", err);
  }
}
