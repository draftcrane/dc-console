/**
 * Count words in plain text.
 */
export function countWordsInText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Count words in HTML content by stripping tags first.
 */
export function countWordsInHtml(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return countWordsInText(text);
}
