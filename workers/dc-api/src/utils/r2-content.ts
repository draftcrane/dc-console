/**
 * Fetch chapter content from R2 sequentially.
 * Shared between ExportService and BackupService.
 * Sequential fetching is memory-safe for book-length documents (per ADR-004).
 */
export interface R2ChapterRow {
  r2_key: string | null;
}

export async function fetchChapterContentsFromR2<T extends R2ChapterRow>(
  bucket: R2Bucket,
  chapterRows: T[],
): Promise<Map<T, string>> {
  const results = new Map<T, string>();

  for (const row of chapterRows) {
    let html = "";
    if (row.r2_key) {
      const object = await bucket.get(row.r2_key);
      if (object) {
        html = await object.text();
      }
    }
    results.set(row, html);
  }

  return results;
}
