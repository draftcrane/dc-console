/**
 * Doc Parse Spike — Phase 1: Library Quality Evaluation
 *
 * Evaluates `unpdf` (PDF text extraction) and `mammoth` (DOCX to HTML)
 * against programmatic test fixtures with known ground truth.
 *
 * Outputs a Markdown report with PASS/FAIL per threshold to stdout
 * and writes it to docs/adr/ADR-008-spike-results.md.
 *
 * Usage:
 *   npx tsx scripts/doc-parse-spike.ts
 *
 * Fixture generation:
 *   npx tsx scripts/generate-doc-parse-fixtures.ts
 */

import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures/doc-parse-spike");
const OUTPUT_PATH = resolve(__dirname, "../docs/adr/ADR-008-spike-results.md");

// ---------------------------------------------------------------------------
// Ground truth (imported inline to keep script self-contained)
// ---------------------------------------------------------------------------

const PDF_GROUND_TRUTH = {
  paragraphs: [
    "The history of document management spans several decades of technological evolution. " +
      "From early paper-based filing systems to modern cloud storage solutions, the journey " +
      "reflects humanity's enduring need to organize and retrieve information efficiently.",
    "In the 1990s, the advent of the World Wide Web transformed how documents were shared " +
      "and accessed. Organizations that once relied on physical archives began digitizing " +
      "their collections, creating vast repositories of searchable text.",
    "Today, artificial intelligence augments these systems with semantic search, automatic " +
      "classification, and intelligent summarization. The documents themselves remain the " +
      "foundation, but the tools for working with them have become remarkably sophisticated.",
    "Consider the challenges of preserving formatting across different platforms. A document " +
      "created in one application may look entirely different when opened in another. This " +
      "interoperability problem has driven the development of standards like PDF and OOXML.",
    "The Portable Document Format, created by Adobe in the early 1990s, solved the problem " +
      "of consistent rendering across devices. Its adoption as an ISO standard in 2008 " +
      "cemented its role as the universal document exchange format.",
  ],
};

const LIGATURE_TEST_WORDS = [
  "efficient",
  "definition",
  "office",
  "affluent",
  "difficult",
  "official",
  "suffix",
  "ification",
  "offline",
  "different",
];

const DOCX_GROUND_TRUTH = {
  title: "Research Methods in Qualitative Analysis",
  headings: [
    { level: 1, text: "Chapter 1: Introduction to Qualitative Research" },
    { level: 2, text: "Historical Context" },
    { level: 2, text: "Key Methodologies" },
    { level: 3, text: "Grounded Theory" },
    { level: 3, text: "Phenomenological Analysis" },
    { level: 1, text: "Chapter 2: Data Collection Techniques" },
    { level: 2, text: "Interview Methods" },
    { level: 2, text: "Observation Protocols" },
  ],
  paragraphs: [
    "Qualitative research provides a framework for understanding human experiences " +
      "through detailed observation and analysis. Unlike quantitative methods that rely " +
      "on numerical data, qualitative approaches embrace the complexity and nuance of " +
      "lived experience.",
    "The origins of qualitative research trace back to anthropological fieldwork in the " +
      "early twentieth century. Researchers like Bronislaw Malinowski pioneered participant " +
      "observation as a method for understanding cultures from within.",
    "Grounded theory, developed by Barney Glaser and Anselm Strauss in 1967, offers a " +
      "systematic approach to generating theory from data. Rather than testing hypotheses, " +
      "grounded theory builds explanations through iterative coding and comparison.",
    "Phenomenological analysis focuses on the structure of conscious experience. Drawing " +
      "on the philosophical traditions of Edmund Husserl and Martin Heidegger, this " +
      "approach seeks to uncover the essential features of lived phenomena.",
    "Data collection in qualitative research requires careful planning and ethical " +
      "consideration. Researchers must establish trust with participants while maintaining " +
      "the rigor and transparency demanded by the academic community.",
    "Semi-structured interviews balance flexibility with consistency. The interviewer " +
      "follows a guide of key topics while allowing the conversation to explore " +
      "unexpected themes that emerge during the dialogue.",
    "Observation protocols range from fully participatory to completely detached. The " +
      "choice of approach depends on the research question, the setting, and the " +
      "relationship between researcher and participants.",
  ],
  lists: [
    ["Open coding", "Axial coding", "Selective coding"],
    ["Bracketing assumptions", "Identifying themes", "Constructing textural descriptions"],
  ],
  boldPhrases: [
    "grounded theory",
    "phenomenological analysis",
    "participant observation",
    "semi-structured interviews",
  ],
  italicPhrases: [
    "lived experience",
    "conscious experience",
    "textural descriptions",
    "research question",
  ],
};

const TABLE_GROUND_TRUTH = {
  headers: ["Method", "Data Type", "Sample Size", "Time Required"],
  rows: [
    ["Survey", "Quantitative", "100-1000+", "2-4 weeks"],
    ["Interview", "Qualitative", "10-30", "4-8 weeks"],
    ["Focus Group", "Qualitative", "6-12 per group", "2-3 weeks"],
    ["Case Study", "Mixed", "1-5", "8-16 weeks"],
    ["Ethnography", "Qualitative", "1 community", "6-24 months"],
  ],
};

// ---------------------------------------------------------------------------
// Pass/Fail thresholds
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  pdfTextCompleteness: 0.8, // >80% word match
  pdfReadingOrder: 0.8, // >80% sentence order preserved
  pdfLigatures: 0.7, // >70% ligature words extract correctly
  docxHeadings: 0.9, // >90% headings detected at correct level
  docxTables: 1.0, // Tables produce <table>/<tr>/<td> HTML
  docxListDetection: 0.8, // >80% list items detected
  docxBoldItalic: 0.7, // >70% bold/italic preserved
  docxTextCompleteness: 0.8, // >80% word match
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function wordMatchRate(extracted: string, reference: string): number {
  const extractedWords = extractWords(extracted);
  const referenceWords = extractWords(reference);

  if (referenceWords.length === 0) return extracted.length === 0 ? 1 : 0;

  let matched = 0;
  const extractedSet = new Set(extractedWords);
  for (const word of referenceWords) {
    if (extractedSet.has(word)) matched++;
  }

  return matched / referenceWords.length;
}

function sentenceOrderScore(extracted: string, reference: string): number {
  // Extract sentences from reference
  const refSentences = reference
    .split(/[.!?]+/)
    .map((s) => normalizeWhitespace(s))
    .filter((s) => s.length > 10);

  if (refSentences.length === 0) return 1;

  const extractedNorm = normalizeWhitespace(extracted);
  let lastIdx = -1;
  let inOrder = 0;

  for (const sentence of refSentences) {
    // Find a significant chunk of the sentence in the extracted text
    const searchChunk = sentence.slice(0, Math.min(40, sentence.length));
    const idx = extractedNorm.indexOf(searchChunk);
    if (idx >= 0) {
      if (idx > lastIdx) {
        inOrder++;
      }
      lastIdx = idx;
    }
  }

  return inOrder / refSentences.length;
}

function fileExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

function pf(pass: boolean): string {
  return pass ? "PASS" : "FAIL";
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// PDF Tests
// ---------------------------------------------------------------------------

interface PdfTestResult {
  name: string;
  file: string;
  fileSizeKB: number;
  extractionTimeMs: number;
  wordCount: number;
  checks: { name: string; score: number; threshold: number; pass: boolean }[];
  notes: string[];
  rawText: string;
}

async function testPdfFile(
  name: string,
  filePath: string,
  checks: (text: string) => { name: string; score: number; threshold: number }[],
): Promise<PdfTestResult | null> {
  if (!(await fileExists(filePath))) {
    return null;
  }

  const fileBytes = await readFile(filePath);
  const fileSizeKB = Math.round(fileBytes.byteLength / 1024);

  const start = performance.now();
  let text = "";
  const notes: string[] = [];

  try {
    const doc = await getDocumentProxy(new Uint8Array(fileBytes));
    const result = await extractText(doc, { mergePages: true });
    text = result.text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    notes.push(`Extraction error: ${msg}`);
  }

  const extractionTimeMs = Math.round(performance.now() - start);
  const wordCount = extractWords(text).length;

  const checkResults = checks(text);

  return {
    name,
    file: basename(filePath),
    fileSizeKB,
    extractionTimeMs,
    wordCount,
    checks: checkResults.map((c) => ({ ...c, pass: c.score >= c.threshold })),
    notes,
    rawText: text,
  };
}

async function runPdfTests(): Promise<PdfTestResult[]> {
  const results: PdfTestResult[] = [];

  // 01-baseline.pdf: programmatic text, full ground truth
  const r1 = await testPdfFile(
    "Baseline (programmatic)",
    resolve(FIXTURES_DIR, "01-baseline.pdf"),
    (text) => {
      const referenceText = PDF_GROUND_TRUTH.paragraphs.join(" ");
      return [
        {
          name: "Text completeness",
          score: wordMatchRate(text, referenceText),
          threshold: THRESHOLDS.pdfTextCompleteness,
        },
        {
          name: "Reading order",
          score: sentenceOrderScore(text, referenceText),
          threshold: THRESHOLDS.pdfReadingOrder,
        },
      ];
    },
  );
  if (r1) results.push(r1);

  // 02-ligatures.pdf: ligature word extraction
  const r2 = await testPdfFile(
    "Ligature test",
    resolve(FIXTURES_DIR, "02-ligatures.pdf"),
    (text) => {
      const textLower = text.toLowerCase();
      let found = 0;
      const missing: string[] = [];
      for (const word of LIGATURE_TEST_WORDS) {
        if (textLower.includes(word)) {
          found++;
        } else {
          missing.push(word);
        }
      }
      const score = found / LIGATURE_TEST_WORDS.length;
      return [
        {
          name: `Ligature words (missing: ${missing.join(", ") || "none"})`,
          score,
          threshold: THRESHOLDS.pdfLigatures,
        },
      ];
    },
  );
  if (r2) results.push(r2);

  // 03-multipage-20.pdf: multipage latency/completeness
  const r3 = await testPdfFile(
    "Multipage (20 pages)",
    resolve(FIXTURES_DIR, "03-multipage-20.pdf"),
    (text) => {
      // Check that all 20 chapter markers exist
      let chaptersFound = 0;
      for (let i = 1; i <= 20; i++) {
        if (text.includes(`Chapter ${i}:`)) chaptersFound++;
      }
      return [
        { name: "Chapter markers found", score: chaptersFound / 20, threshold: 0.9 },
        {
          name: "Word count > 3000",
          score: extractWords(text).length > 3000 ? 1 : 0,
          threshold: 1,
        },
      ];
    },
  );
  if (r3) results.push(r3);

  // 04-two-column.pdf: reading order coherence
  const r4 = await testPdfFile(
    "Two-column with footnotes",
    resolve(FIXTURES_DIR, "04-two-column.pdf"),
    (text) => {
      // Check that key phrases from each column exist
      const leftPhrase = "natural language processing";
      const rightPhrase = "document processing are substantial";
      const hasLeft = text.toLowerCase().includes(leftPhrase) ? 1 : 0;
      const hasRight = text.toLowerCase().includes(rightPhrase) ? 1 : 0;

      // Check reading order: left column content should appear before right column content
      const leftIdx = text.toLowerCase().indexOf(leftPhrase);
      const rightIdx = text.toLowerCase().indexOf(rightPhrase);
      const orderCorrect = leftIdx >= 0 && rightIdx >= 0 ? (leftIdx < rightIdx ? 1 : 0) : 0;

      return [
        { name: "Content extracted", score: (hasLeft + hasRight) / 2, threshold: 0.5 },
        { name: "Reading order (left before right)", score: orderCorrect, threshold: 0 }, // informational — may fail
      ];
    },
  );
  if (r4) {
    r4.notes.push(
      "Two-column reading order is a known PDF extraction challenge. Score is informational.",
    );
    results.push(r4);
  }

  // 05-image-only.pdf: expected failure
  const r5 = await testPdfFile(
    "Image-only (expected failure)",
    resolve(FIXTURES_DIR, "05-image-only.pdf"),
    (text) => {
      const wordCount = extractWords(text).length;
      return [
        { name: "No text extracted (expected)", score: wordCount === 0 ? 1 : 0, threshold: 1 },
      ];
    },
  );
  if (r5) {
    r5.notes.push("Expected: no text from image-only PDF. Confirms no silent hallucination.");
    results.push(r5);
  }

  // Real-world PDFs (optional — only tested if present)
  const realWorldPdfs = [
    { file: "real-word-generated.pdf", name: "Word-generated PDF (real)" },
    { file: "real-google-docs.pdf", name: "Google Docs PDF (real)" },
    { file: "real-chrome-print.pdf", name: "Chrome print-to-PDF (real)" },
  ];
  for (const rw of realWorldPdfs) {
    const path = resolve(FIXTURES_DIR, rw.file);
    const r = await testPdfFile(rw.name, path, (text) => {
      const wc = extractWords(text).length;
      // For real-world PDFs we can only check that some text was extracted
      return [{ name: "Text extracted (word count > 10)", score: wc > 10 ? 1 : 0, threshold: 1 }];
    });
    if (r) {
      results.push(r);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// DOCX Tests
// ---------------------------------------------------------------------------

interface DocxTestResult {
  name: string;
  file: string;
  fileSizeKB: number;
  extractionTimeMs: number;
  wordCount: number;
  checks: { name: string; score: number; threshold: number; pass: boolean }[];
  notes: string[];
  rawHtml: string;
  htmlElements: Record<string, number>;
}

async function testDocxFile(
  name: string,
  filePath: string,
  checks: (html: string) => { name: string; score: number; threshold: number }[],
): Promise<DocxTestResult | null> {
  if (!(await fileExists(filePath))) {
    return null;
  }

  const fileBytes = await readFile(filePath);
  const fileSizeKB = Math.round(fileBytes.byteLength / 1024);

  const start = performance.now();
  let html = "";
  const notes: string[] = [];

  try {
    const result = await mammoth.convertToHtml({ buffer: fileBytes });
    html = result.value;
    if (result.messages.length > 0) {
      notes.push(
        `Mammoth messages: ${result.messages.map((m) => `${m.type}: ${m.message}`).join("; ")}`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    notes.push(`Extraction error: ${msg}`);
  }

  const extractionTimeMs = Math.round(performance.now() - start);

  // Strip HTML tags for word count
  const plainText = html.replace(/<[^>]+>/g, " ");
  const wordCount = extractWords(plainText).length;

  // Count HTML elements
  const htmlElements: Record<string, number> = {};
  const tagPattern = /<(\w+)[\s>]/g;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    htmlElements[tag] = (htmlElements[tag] || 0) + 1;
  }

  const checkResults = checks(html);

  return {
    name,
    file: basename(filePath),
    fileSizeKB,
    extractionTimeMs,
    wordCount,
    checks: checkResults.map((c) => ({ ...c, pass: c.score >= c.threshold })),
    notes,
    rawHtml: html,
    htmlElements,
  };
}

async function runDocxTests(): Promise<DocxTestResult[]> {
  const results: DocxTestResult[] = [];

  // 06-baseline.docx: headings, bold, italic, lists
  const r1 = await testDocxFile(
    "Baseline (headings/formatting)",
    resolve(FIXTURES_DIR, "06-baseline.docx"),
    (html) => {
      const htmlLower = html.toLowerCase();

      // Check headings
      let headingsFound = 0;
      const headingsMissing: string[] = [];
      for (const h of DOCX_GROUND_TRUTH.headings) {
        const tag = `h${h.level}`;
        const pattern = new RegExp(
          `<${tag}[^>]*>.*?${h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()}.*?</${tag}>`,
          "i",
        );
        if (pattern.test(htmlLower)) {
          headingsFound++;
        } else {
          headingsMissing.push(`${tag}: ${h.text}`);
        }
      }

      // Check bold preservation (case-insensitive — mammoth preserves source casing)
      let boldFound = 0;
      for (const phrase of DOCX_GROUND_TRUTH.boldPhrases) {
        const strongPattern = new RegExp(`<strong>[^<]*${phrase}[^<]*</strong>`, "i");
        const bPattern = new RegExp(`<b>[^<]*${phrase}[^<]*</b>`, "i");
        if (strongPattern.test(html) || bPattern.test(html)) {
          boldFound++;
        }
      }

      // Check italic preservation (case-insensitive)
      let italicFound = 0;
      for (const phrase of DOCX_GROUND_TRUTH.italicPhrases) {
        const emPattern = new RegExp(`<em>[^<]*${phrase}[^<]*</em>`, "i");
        const iPattern = new RegExp(`<i>[^<]*${phrase}[^<]*</i>`, "i");
        if (emPattern.test(html) || iPattern.test(html)) {
          italicFound++;
        }
      }

      // Check list items
      let listItemsFound = 0;
      const allListItems = DOCX_GROUND_TRUTH.lists.flat();
      for (const item of allListItems) {
        if (htmlLower.includes(item.toLowerCase())) {
          listItemsFound++;
        }
      }

      // Check text completeness
      const plainText = html.replace(/<[^>]+>/g, " ");
      const refText = DOCX_GROUND_TRUTH.paragraphs.join(" ");
      const textMatch = wordMatchRate(plainText, refText);

      return [
        {
          name: `Headings (missing: ${headingsMissing.length > 0 ? headingsMissing.join(", ") : "none"})`,
          score: headingsFound / DOCX_GROUND_TRUTH.headings.length,
          threshold: THRESHOLDS.docxHeadings,
        },
        {
          name: "Bold preservation",
          score: boldFound / DOCX_GROUND_TRUTH.boldPhrases.length,
          threshold: THRESHOLDS.docxBoldItalic,
        },
        {
          name: "Italic preservation",
          score: italicFound / DOCX_GROUND_TRUTH.italicPhrases.length,
          threshold: THRESHOLDS.docxBoldItalic,
        },
        {
          name: "List items detected",
          score: listItemsFound / allListItems.length,
          threshold: THRESHOLDS.docxListDetection,
        },
        {
          name: "Text completeness",
          score: textMatch,
          threshold: THRESHOLDS.docxTextCompleteness,
        },
      ];
    },
  );
  if (r1) results.push(r1);

  // 07-tables.docx: table structure
  const r2 = await testDocxFile(
    "Tables with merged cells",
    resolve(FIXTURES_DIR, "07-tables.docx"),
    (html) => {
      const hasTable = html.includes("<table");
      const hasTr = html.includes("<tr");
      const hasTd = html.includes("<td") || html.includes("<th");
      const tableStructure = hasTable && hasTr && hasTd;

      // Check header content
      let headersFound = 0;
      for (const h of TABLE_GROUND_TRUTH.headers) {
        if (html.includes(h)) headersFound++;
      }

      // Check data rows
      let cellsFound = 0;
      const allCells = TABLE_GROUND_TRUTH.rows.flat();
      for (const cell of allCells) {
        if (html.includes(cell)) cellsFound++;
      }

      return [
        {
          name: "Table structure (<table>/<tr>/<td>)",
          score: tableStructure ? 1 : 0,
          threshold: THRESHOLDS.docxTables,
        },
        {
          name: "Table headers found",
          score: headersFound / TABLE_GROUND_TRUTH.headers.length,
          threshold: 0.75,
        },
        { name: "Table cells found", score: cellsFound / allCells.length, threshold: 0.75 },
      ];
    },
  );
  if (r2) results.push(r2);

  // 08-large-50k.docx: latency/memory stress test
  const r3 = await testDocxFile(
    "Large document (50k words)",
    resolve(FIXTURES_DIR, "08-large-50k.docx"),
    (html) => {
      const plainText = html.replace(/<[^>]+>/g, " ");
      const wc = extractWords(plainText).length;
      // Check that most content survived
      return [
        { name: "Word count > 40000", score: wc > 40000 ? 1 : 0, threshold: 1 },
        {
          name: "Chapter markers (25)",
          score: (() => {
            let found = 0;
            for (let i = 1; i <= 25; i++) {
              if (html.includes(`Chapter ${i}:`)) found++;
            }
            return found / 25;
          })(),
          threshold: 0.9,
        },
      ];
    },
  );
  if (r3) results.push(r3);

  // Real-world DOCX (optional)
  const realPath = resolve(FIXTURES_DIR, "real-word-doc.docx");
  const rw = await testDocxFile("Real Word document", realPath, (html) => {
    const wc = extractWords(html.replace(/<[^>]+>/g, " ")).length;
    return [{ name: "Text extracted (word count > 10)", score: wc > 10 ? 1 : 0, threshold: 1 }];
  });
  if (rw) results.push(rw);

  return results;
}

// ---------------------------------------------------------------------------
// Mammoth HTML element audit (for sanitization whitelist)
// ---------------------------------------------------------------------------

function auditMammothElements(results: DocxTestResult[]): Record<string, number> {
  const combined: Record<string, number> = {};
  for (const r of results) {
    for (const [tag, count] of Object.entries(r.htmlElements)) {
      combined[tag] = (combined[tag] || 0) + count;
    }
  }
  return combined;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateReport(
  pdfResults: PdfTestResult[],
  docxResults: DocxTestResult[],
  mammothElements: Record<string, number>,
): string {
  const lines: string[] = [];
  const date = new Date().toISOString().split("T")[0];

  lines.push("# ADR-008 Spike Results: Document Parsing Library Evaluation");
  lines.push("");
  lines.push(`**Date:** ${date}`);
  lines.push(`**Libraries:** unpdf (PDF), mammoth.js (DOCX)`);
  lines.push("");

  // Summary
  const allChecks = [
    ...pdfResults.flatMap((r) => r.checks),
    ...docxResults.flatMap((r) => r.checks),
  ];
  const totalPass = allChecks.filter((c) => c.pass).length;
  const totalFail = allChecks.filter((c) => !c.pass).length;

  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total checks | ${allChecks.length} |`);
  lines.push(`| Passed | ${totalPass} |`);
  lines.push(`| Failed | ${totalFail} |`);
  lines.push(`| Overall | **${totalFail === 0 ? "ALL PASS" : `${totalFail} FAILURE(S)`}** |`);
  lines.push("");

  // PDF Results
  lines.push("## PDF Extraction (unpdf)");
  lines.push("");

  for (const r of pdfResults) {
    lines.push(`### ${r.name}`);
    lines.push("");
    lines.push(
      `**File:** \`${r.file}\` (${r.fileSizeKB} KB) | **Time:** ${r.extractionTimeMs}ms | **Words:** ${r.wordCount}`,
    );
    lines.push("");
    lines.push("| Check | Score | Threshold | Result |");
    lines.push("|-------|-------|-----------|--------|");
    for (const c of r.checks) {
      lines.push(`| ${c.name} | ${pct(c.score)} | ${pct(c.threshold)} | **${pf(c.pass)}** |`);
    }
    if (r.notes.length > 0) {
      lines.push("");
      for (const note of r.notes) {
        lines.push(`> ${note}`);
      }
    }
    lines.push("");
  }

  // DOCX Results
  lines.push("## DOCX Extraction (mammoth.js)");
  lines.push("");

  for (const r of docxResults) {
    lines.push(`### ${r.name}`);
    lines.push("");
    lines.push(
      `**File:** \`${r.file}\` (${r.fileSizeKB} KB) | **Time:** ${r.extractionTimeMs}ms | **Words:** ${r.wordCount}`,
    );
    lines.push("");
    lines.push("| Check | Score | Threshold | Result |");
    lines.push("|-------|-------|-----------|--------|");
    for (const c of r.checks) {
      lines.push(`| ${c.name} | ${pct(c.score)} | ${pct(c.threshold)} | **${pf(c.pass)}** |`);
    }
    if (r.notes.length > 0) {
      lines.push("");
      for (const note of r.notes) {
        lines.push(`> ${note}`);
      }
    }
    lines.push("");

    // Show HTML element inventory for this file
    if (Object.keys(r.htmlElements).length > 0) {
      lines.push("<details>");
      lines.push(
        `<summary>HTML elements produced (${Object.keys(r.htmlElements).length} unique tags)</summary>`,
      );
      lines.push("");
      lines.push("| Tag | Count |");
      lines.push("|-----|-------|");
      for (const [tag, count] of Object.entries(r.htmlElements).sort((a, b) => b[1] - a[1])) {
        lines.push(`| \`<${tag}>\` | ${count} |`);
      }
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
  }

  // Mammoth element audit
  lines.push("## Mammoth HTML Element Audit (Sanitization Whitelist)");
  lines.push("");
  lines.push("Combined element inventory across all DOCX test files:");
  lines.push("");
  lines.push("| Tag | Total Count | Include in Whitelist? |");
  lines.push("|-----|-------------|----------------------|");
  const sortedElements = Object.entries(mammothElements).sort((a, b) => b[1] - a[1]);
  const safeElements = new Set([
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "table",
    "tr",
    "td",
    "th",
    "thead",
    "tbody",
    "a",
    "br",
    "sup",
    "sub",
    "blockquote",
  ]);
  for (const [tag, count] of sortedElements) {
    const safe = safeElements.has(tag) ? "Yes" : "Review";
    lines.push(`| \`<${tag}>\` | ${count} | ${safe} |`);
  }
  lines.push("");
  lines.push("**Recommended sanitize-html allowlist:**");
  lines.push("```js");
  lines.push(`allowedTags: [${[...safeElements].map((t) => `'${t}'`).join(", ")}]`);
  lines.push("```");
  lines.push("");

  // Performance summary
  lines.push("## Performance Summary");
  lines.push("");
  lines.push("| Test | File Size | Extraction Time | Words Extracted |");
  lines.push("|------|-----------|-----------------|-----------------|");
  for (const r of [...pdfResults, ...docxResults]) {
    lines.push(`| ${r.name} | ${r.fileSizeKB} KB | ${r.extractionTimeMs}ms | ${r.wordCount} |`);
  }
  lines.push("");

  // Thresholds reference
  lines.push("## Pass/Fail Thresholds");
  lines.push("");
  lines.push("| Criterion | Threshold |");
  lines.push("|-----------|-----------|");
  for (const [key, val] of Object.entries(THRESHOLDS)) {
    lines.push(`| ${key} | ${pct(val)} |`);
  }
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Doc Parse Spike — Phase 1: Library Quality Evaluation");
  console.log("=====================================================");
  console.log("");

  console.log("Running PDF tests (unpdf)...");
  const pdfResults = await runPdfTests();
  console.log(`  ${pdfResults.length} PDF tests completed`);
  console.log("");

  console.log("Running DOCX tests (mammoth.js)...");
  const docxResults = await runDocxTests();
  console.log(`  ${docxResults.length} DOCX tests completed`);
  console.log("");

  const mammothElements = auditMammothElements(docxResults);

  const report = generateReport(pdfResults, docxResults, mammothElements);

  // Write report
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, report, "utf-8");
  console.log(`Report written to: ${OUTPUT_PATH}`);
  console.log("");

  // Print summary to console
  const allChecks = [
    ...pdfResults.flatMap((r) => r.checks),
    ...docxResults.flatMap((r) => r.checks),
  ];

  console.log("=== RESULTS ===");
  console.log("");

  for (const r of pdfResults) {
    console.log(`PDF: ${r.name} (${r.file})`);
    for (const c of r.checks) {
      console.log(`  ${pf(c.pass)} ${c.name}: ${pct(c.score)} (threshold: ${pct(c.threshold)})`);
    }
  }

  for (const r of docxResults) {
    console.log(`DOCX: ${r.name} (${r.file})`);
    for (const c of r.checks) {
      console.log(`  ${pf(c.pass)} ${c.name}: ${pct(c.score)} (threshold: ${pct(c.threshold)})`);
    }
  }

  console.log("");
  const totalFail = allChecks.filter((c) => !c.pass).length;
  if (totalFail === 0) {
    console.log("ALL CHECKS PASSED");
  } else {
    console.log(`${totalFail} CHECK(S) FAILED`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
