/**
 * Count words in HTML content.
 * Strips HTML tags and counts whitespace-separated words.
 */
export function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text.split(" ").length : 0;
}
