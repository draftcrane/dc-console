/**
 * Generate test fixtures for research-query-quality-gate.ts
 *
 * Fetches real public-domain text from Project Gutenberg and builds
 * scripts/fixtures/research-query-cases.json with 12 test scenarios.
 *
 * Usage:
 *   npx tsx scripts/generate-research-fixtures.ts
 *
 * Sources used (all public domain):
 *   - Adam Smith, "The Wealth of Nations" (1776)
 *   - Charles Darwin, "On the Origin of Species" (1859)
 *   - Frederick Winslow Taylor, "The Principles of Scientific Management" (1911)
 *   - Benjamin Franklin, "The Autobiography of Benjamin Franklin" (1791)
 *   - Nicolo Machiavelli, "The Prince" (1532, Marriott translation)
 *   - Sun Tzu, "The Art of War" (Giles translation)
 *   - US Bureau of Labor Statistics public reports
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "fixtures/research-query-cases.json");

// ---------------------------------------------------------------------------
// Project Gutenberg plain-text URLs
// ---------------------------------------------------------------------------

const GUTENBERG_SOURCES: Record<string, { url: string; title: string }> = {
  "wealth-of-nations": {
    url: "https://www.gutenberg.org/cache/epub/3300/pg3300.txt",
    title: "The Wealth of Nations",
  },
  "origin-of-species": {
    url: "https://www.gutenberg.org/cache/epub/1228/pg1228.txt",
    title: "On the Origin of Species",
  },
  "scientific-management": {
    url: "https://www.gutenberg.org/cache/epub/6435/pg6435.txt",
    title: "The Principles of Scientific Management",
  },
  "franklin-autobiography": {
    url: "https://www.gutenberg.org/cache/epub/20203/pg20203.txt",
    title: "The Autobiography of Benjamin Franklin",
  },
  "the-prince": {
    url: "https://www.gutenberg.org/cache/epub/1232/pg1232.txt",
    title: "The Prince",
  },
  "art-of-war": {
    url: "https://www.gutenberg.org/cache/epub/132/pg132.txt",
    title: "The Art of War",
  },
};

// ---------------------------------------------------------------------------
// Fetch and extract
// ---------------------------------------------------------------------------

async function fetchGutenbergText(key: string): Promise<string> {
  const source = GUTENBERG_SOURCES[key];
  if (!source) throw new Error(`Unknown source: ${key}`);

  console.log(`  Fetching ${source.title}...`);
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
  }

  const text = await response.text();

  // Strip Gutenberg header/footer (between START/END markers)
  const startMarker = "*** START OF";
  const endMarker = "*** END OF";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  let body = text;
  if (startIdx !== -1) {
    // Find end of the START line
    const afterStart = text.indexOf("\n", startIdx);
    body = afterStart !== -1 ? text.slice(afterStart + 1) : text.slice(startIdx);
  }
  if (endIdx !== -1) {
    body = body.slice(0, body.indexOf(endMarker));
  }

  return body.trim();
}

/**
 * Extract a passage of approximately `targetWords` words starting from
 * the first occurrence of `startPhrase` in the text.
 * Preserves paragraph structure (double newlines) for proper HTML conversion.
 */
function extractPassage(fullText: string, startPhrase: string, targetWords: number): string {
  const idx = fullText.indexOf(startPhrase);
  if (idx === -1) {
    // Try case-insensitive search
    const lowerIdx = fullText.toLowerCase().indexOf(startPhrase.toLowerCase());
    if (lowerIdx === -1) {
      throw new Error(`Start phrase not found: "${startPhrase.slice(0, 60)}..."`);
    }
    return extractPassageFromIndex(fullText, lowerIdx, targetWords);
  }
  return extractPassageFromIndex(fullText, idx, targetWords);
}

function extractPassageFromIndex(fullText: string, startIdx: number, targetWords: number): string {
  // Walk forward character-by-character, counting words, preserving original formatting
  const fromStart = fullText.slice(startIdx);
  let wordCount = 0;
  let endIdx = 0;
  let inWord = false;

  for (let i = 0; i < fromStart.length; i++) {
    const ch = fromStart[i];
    const isWhitespace = /\s/.test(ch);

    if (!isWhitespace && !inWord) {
      wordCount++;
      inWord = true;
    } else if (isWhitespace) {
      inWord = false;
    }

    if (wordCount >= targetWords && isWhitespace) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === 0) endIdx = fromStart.length;

  let passage = fromStart.slice(0, endIdx);

  // Try to end at a sentence boundary (paragraph break preferred, then period)
  const lastParaBreak = passage.lastIndexOf("\n\n");
  if (lastParaBreak > passage.length * 0.7) {
    passage = passage.slice(0, lastParaBreak);
  } else {
    const lastPeriod = passage.lastIndexOf(".");
    if (lastPeriod > passage.length * 0.7) {
      passage = passage.slice(0, lastPeriod + 1);
    }
  }

  return passage.trim();
}

/**
 * Convert plain text to simple HTML with paragraph tags.
 * Splits on double newlines (paragraph breaks).
 */
function textToHTML(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0);

  return paragraphs.map((p) => `<p>${escapeHTML(p)}</p>`).join("\n");
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Test case builders
// ---------------------------------------------------------------------------

interface SourceMaterial {
  id: string;
  title: string;
  htmlContent: string;
}

interface TestCase {
  id: string;
  queryType: string;
  genre: string;
  query: string;
  sources: SourceMaterial[];
  expectedBehavior: {
    snippetCount: string;
    shouldBeVerbatim: boolean;
    queryUnderstood: boolean;
    notes: string;
  };
}

function buildCase1(texts: Map<string, string>): TestCase {
  const passage = extractPassage(texts.get("wealth-of-nations")!, "The greatest improvement", 1200);
  return {
    id: "factual-single-business",
    queryType: "factual-extraction",
    genre: "business",
    query: "What are the three advantages of division of labor described by the author?",
    sources: [
      {
        id: "src-001",
        title: "The Wealth of Nations - Chapter 1",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "2-4",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Should extract the three advantages: increased dexterity, time savings, and invention of machinery. These are explicitly enumerated in the text.",
    },
  };
}

function buildCase2(texts: Map<string, string>): TestCase {
  const passage = extractPassage(
    texts.get("scientific-management")!,
    "The principal object of management",
    1200,
  );
  return {
    id: "factual-single-technical",
    queryType: "factual-extraction",
    genre: "technical",
    query: "What does the author identify as the principal object of management?",
    sources: [
      {
        id: "src-002",
        title: "The Principles of Scientific Management - Chapter 1",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "1-3",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Should find Taylor's statement about the principal object of management being maximum prosperity for employer and employee.",
    },
  };
}

function buildCase3(texts: Map<string, string>): TestCase {
  const passage = extractPassage(texts.get("origin-of-species")!, "struggle for existence", 1200);
  return {
    id: "concept-single-nonfiction",
    queryType: "concept-explanation",
    genre: "nonfiction-prose",
    query: "How does the author define and explain the concept of the struggle for existence?",
    sources: [
      {
        id: "src-003",
        title: "On the Origin of Species - Chapter 3",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "2-5",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Should extract Darwin's explanation of the struggle for existence, including his note about using it in a broad metaphorical sense.",
    },
  };
}

function buildCase4(texts: Map<string, string>): TestCase {
  const smithPassage = extractPassage(texts.get("wealth-of-nations")!, "division of labour", 800);
  const taylorPassage = extractPassage(
    texts.get("scientific-management")!,
    "maximum prosperity",
    800,
  );
  const franklinPassage = extractPassage(texts.get("franklin-autobiography")!, "industry", 800);
  return {
    id: "concept-multi-business",
    queryType: "concept-explanation",
    genre: "business",
    query:
      "What do these authors say about the relationship between worker productivity and prosperity?",
    sources: [
      {
        id: "src-004a",
        title: "The Wealth of Nations",
        htmlContent: textToHTML(smithPassage),
      },
      {
        id: "src-004b",
        title: "The Principles of Scientific Management",
        htmlContent: textToHTML(taylorPassage),
      },
      {
        id: "src-004c",
        title: "The Autobiography of Benjamin Franklin",
        htmlContent: textToHTML(franklinPassage),
      },
    ],
    expectedBehavior: {
      snippetCount: "3-6",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Should pull from all three sources. Smith on division of labor, Taylor on scientific management and prosperity, Franklin on industry and frugality.",
    },
  };
}

function buildCase5(texts: Map<string, string>): TestCase {
  const passage = extractPassage(texts.get("the-prince")!, "CONCERNING CRUELTY AND CLEMENCY", 1200);
  return {
    id: "opinion-single-nonfiction",
    queryType: "opinion-stance",
    genre: "nonfiction-prose",
    query: "What is the author's position on whether it is better to be feared or loved?",
    sources: [
      {
        id: "src-005",
        title: "The Prince - Chapter XVII",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "2-4",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Should extract Machiavelli's argument that it is safer to be feared than loved, with his caveats about avoiding hatred.",
    },
  };
}

function buildCase6(texts: Map<string, string>): TestCase {
  const smithPassage = extractPassage(
    texts.get("wealth-of-nations")!,
    "from the benevolence of the butcher",
    1000,
  );
  const taylorPassage = extractPassage(
    texts.get("scientific-management")!,
    "the most elaborate cooperation",
    1000,
  );
  return {
    id: "opinion-multi-business",
    queryType: "opinion-stance",
    genre: "business",
    query: "Do these authors believe workers and employers should cooperate or compete?",
    sources: [
      {
        id: "src-006a",
        title: "The Wealth of Nations",
        htmlContent: textToHTML(smithPassage),
      },
      {
        id: "src-006b",
        title: "The Principles of Scientific Management",
        htmlContent: textToHTML(taylorPassage),
      },
    ],
    expectedBehavior: {
      snippetCount: "2-4",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Smith's self-interest view vs Taylor's cooperation view. Should surface contrasting perspectives from both sources.",
    },
  };
}

function buildCase7(texts: Map<string, string>): TestCase {
  const smithPassage = extractPassage(
    texts.get("wealth-of-nations")!,
    "productive powers of labour",
    600,
  );
  const darwinPassage = extractPassage(texts.get("origin-of-species")!, "natural selection", 600);
  const artOfWarPassage = extractPassage(
    texts.get("art-of-war")!,
    "supreme excellence consists in breaking",
    600,
  );
  return {
    id: "synthesis-multi-mixed",
    queryType: "multi-source-synthesis",
    genre: "mixed",
    query:
      "What strategies do these authors recommend for achieving competitive advantage or superiority?",
    sources: [
      {
        id: "src-007a",
        title: "The Wealth of Nations",
        htmlContent: textToHTML(smithPassage),
      },
      {
        id: "src-007b",
        title: "On the Origin of Species",
        htmlContent: textToHTML(darwinPassage),
      },
      {
        id: "src-007c",
        title: "The Art of War",
        htmlContent: textToHTML(artOfWarPassage),
      },
    ],
    expectedBehavior: {
      snippetCount: "3-6",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Should synthesize across disciplines: economic advantage (Smith), natural advantage (Darwin), strategic advantage (Sun Tzu). Summary field should connect themes.",
    },
  };
}

function buildCase8(texts: Map<string, string>): TestCase {
  const taylorPassage = extractPassage(texts.get("scientific-management")!, "soldiering", 1200);
  const smithPassage = extractPassage(texts.get("wealth-of-nations")!, "division of labour", 1000);
  return {
    id: "negation-multi-technical",
    queryType: "negation-query",
    genre: "technical",
    query:
      "What do these authors say about the disadvantages or risks of automation and machinery replacing human workers?",
    sources: [
      {
        id: "src-008a",
        title: "The Principles of Scientific Management",
        htmlContent: textToHTML(taylorPassage),
      },
      {
        id: "src-008b",
        title: "The Wealth of Nations",
        htmlContent: textToHTML(smithPassage),
      },
    ],
    expectedBehavior: {
      snippetCount: "0-2",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "These passages focus on the benefits of productivity and division of labor, not on automation risk. LLM should return few or no snippets, or note that the sources don't directly address this concern.",
    },
  };
}

function buildCase9(texts: Map<string, string>): TestCase {
  const passage = extractPassage(texts.get("wealth-of-nations")!, "accumulation of stock", 1200);
  return {
    id: "ambiguous-single-business",
    queryType: "ambiguous-query",
    genre: "business",
    query: "What does the author say about stock?",
    sources: [
      {
        id: "src-009",
        title: "The Wealth of Nations",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "1-3",
      shouldBeVerbatim: true,
      queryUnderstood: false,
      notes:
        "The query 'stock' is ambiguous in context of Wealth of Nations (capital stock, livestock, joint-stock companies). LLM should set queryUnderstood=false or provide snippets with caveats.",
    },
  };
}

function buildCase10(texts: Map<string, string>): TestCase {
  const passage = extractPassage(
    texts.get("origin-of-species")!,
    "variation under domestication",
    1200,
  );
  return {
    id: "no-results-single-nonfiction",
    queryType: "no-results",
    genre: "nonfiction-prose",
    query: "What does the author recommend for treating diabetes with modern pharmaceuticals?",
    sources: [
      {
        id: "src-010",
        title: "On the Origin of Species - Chapter 1",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "0",
      shouldBeVerbatim: false,
      queryUnderstood: true,
      noResultsExpected: true,
      notes:
        "Darwin's text about species variation has nothing about diabetes treatment. Should return empty snippets with a noResultsReason.",
    } as TestCase["expectedBehavior"],
  };
}

function buildCase11(texts: Map<string, string>): TestCase {
  // Use a passage that will naturally create 3+ chunks
  const passage = extractPassage(texts.get("scientific-management")!, "elimination of", 1500);
  return {
    id: "chunked-single-technical",
    queryType: "chunked-input",
    genre: "technical",
    query: "What does the author say about the elimination of inefficiency in the workplace?",
    sources: [
      {
        id: "src-011",
        title: "The Principles of Scientific Management",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "1-3",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Tests chunk reference accuracy. Snippets should reference specific chunk IDs that contain the relevant text about eliminating soldiering and inefficiency.",
    },
  };
}

function buildCase12(texts: Map<string, string>): TestCase {
  // Use a longer passage (~2000 words) for the long document test
  const passage = extractPassage(
    texts.get("franklin-autobiography")!,
    "From a child I was fond of reading",
    2000,
  );
  return {
    id: "long-doc-single-nonfiction",
    queryType: "long-document",
    genre: "nonfiction-prose",
    query: "What books and reading materials influenced the author's intellectual development?",
    sources: [
      {
        id: "src-012",
        title: "The Autobiography of Benjamin Franklin",
        htmlContent: textToHTML(passage),
      },
    ],
    expectedBehavior: {
      snippetCount: "3-6",
      shouldBeVerbatim: true,
      queryUnderstood: true,
      notes:
        "Franklin mentions many books: Bunyan's Pilgrim's Progress, Plutarch's Lives, Defoe, Cotton Mather, etc. Tests ability to find multiple snippets across a long document with accurate chunk references.",
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Generating research query test fixtures...");
  console.log("");

  // Fetch all source texts
  console.log("Fetching public-domain texts from Project Gutenberg:");
  const texts = new Map<string, string>();

  for (const [key, source] of Object.entries(GUTENBERG_SOURCES)) {
    try {
      const text = await fetchGutenbergText(key);
      texts.set(key, text);
      const wordCount = text.split(/\s+/).length;
      console.log(`  ${source.title}: ${wordCount.toLocaleString()} words`);
    } catch (err) {
      console.error(`  FAILED: ${source.title} — ${err}`);
      process.exit(1);
    }
  }

  console.log("");
  console.log("Building 12 test cases...");

  const cases: TestCase[] = [];
  const builders = [
    buildCase1,
    buildCase2,
    buildCase3,
    buildCase4,
    buildCase5,
    buildCase6,
    buildCase7,
    buildCase8,
    buildCase9,
    buildCase10,
    buildCase11,
    buildCase12,
  ];

  for (const builder of builders) {
    try {
      const tc = builder(texts);
      cases.push(tc);
      const sourceCount = tc.sources.length;
      const totalWords = tc.sources.reduce((sum, s) => sum + s.htmlContent.split(/\s+/).length, 0);
      console.log(`  ${tc.id}: ${tc.queryType} | ${sourceCount} source(s) | ~${totalWords} words`);
    } catch (err) {
      console.error(`  FAILED to build case: ${err}`);
      process.exit(1);
    }
  }

  // Write output
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(cases, null, 2), "utf-8");

  console.log("");
  console.log(`Written ${cases.length} test cases to:`);
  console.log(`  ${OUTPUT_PATH}`);

  // Verify the output
  const totalSources = cases.reduce((s, c) => s + c.sources.length, 0);
  const totalWords = cases.reduce(
    (s, c) => s + c.sources.reduce((ss, src) => ss + src.htmlContent.split(/\s+/).length, 0),
    0,
  );
  console.log(`  ${totalSources} total sources, ~${totalWords.toLocaleString()} total words`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
