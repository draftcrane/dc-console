/**
 * Sanitize a string for use in a file name.
 * Strips characters unsafe for most filesystems and truncates to 200 chars.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Format date as YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Build a sanitized file name: {title} - YYYY-MM-DD.{ext}
 */
export function buildFileName(title: string, extension: string): string {
  const sanitized = sanitizeFileName(title);
  const date = formatDate(new Date());
  return `${sanitized} - ${date}.${extension}`;
}

/**
 * Build a Content-Disposition header value with proper escaping.
 * Sanitizes the filename to prevent header injection via quotes or newlines.
 * Uses RFC 5987 encoding for Unicode-safe filenames.
 */
export function safeContentDisposition(fileName: string): string {
  const sanitized = fileName.replace(/["\\\n\r]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/'/g, "%27");
  return `attachment; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}
