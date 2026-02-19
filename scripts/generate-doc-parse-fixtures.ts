/**
 * Generate programmatic test fixtures for the doc-parse spike.
 *
 * Creates PDF fixtures via pdf-lib and DOCX fixtures via the docx npm package.
 * Real-world PDFs (Word-generated, Google Docs, Chrome print, etc.) must be
 * created manually and placed in scripts/fixtures/doc-parse-spike/.
 *
 * Usage:
 *   npx tsx scripts/generate-doc-parse-fixtures.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalMergeType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures/doc-parse-spike");

// ---------------------------------------------------------------------------
// Ground-truth data (shared between generators and evaluation)
// ---------------------------------------------------------------------------

export const PDF_GROUND_TRUTH = {
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

export const LIGATURE_TEST_WORDS = [
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

export const DOCX_GROUND_TRUTH = {
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

export const TABLE_GROUND_TRUTH = {
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
// PDF Fixtures
// ---------------------------------------------------------------------------

async function generateBaselinePdf(): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontSize = 12;
  const lineHeight = 18;
  const margin = 72; // 1 inch
  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const textWidth = pageWidth - 2 * margin;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  page.drawText("Document Management: A Historical Overview", {
    x: margin,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 40;

  // Paragraphs
  for (const para of PDF_GROUND_TRUTH.paragraphs) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > textWidth && line) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size: fontSize, font });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      if (y < margin + lineHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font });
      y -= lineHeight;
    }
    y -= lineHeight / 2; // paragraph gap
  }

  const bytes = await doc.save();
  await writeFile(resolve(FIXTURES_DIR, "01-baseline.pdf"), bytes);
  console.log("  01-baseline.pdf");
}

async function generateLigaturePdf(): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontSize = 12;
  const lineHeight = 20;
  const margin = 72;
  const pageWidth = 612;
  const pageHeight = 792;

  const page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText("Ligature Test Document", {
    x: margin,
    y,
    size: 18,
    font: boldFont,
  });
  y -= 36;

  page.drawText(
    "This document tests extraction of words containing common ligature combinations (fi, fl, ff, ffi, ffl).",
    { x: margin, y, size: fontSize, font },
  );
  y -= lineHeight * 2;

  // Each ligature word in a sentence
  const sentences = [
    `The process was remarkably ${LIGATURE_TEST_WORDS[0]} and well-organized.`,
    `By ${LIGATURE_TEST_WORDS[1]}, the term encompasses all related concepts.`,
    `She walked into the ${LIGATURE_TEST_WORDS[2]} and sat down at her desk.`,
    `The ${LIGATURE_TEST_WORDS[3]} neighborhood attracted many visitors.`,
    `This was a particularly ${LIGATURE_TEST_WORDS[4]} problem to solve.`,
    `The ${LIGATURE_TEST_WORDS[5]} statement was released on Monday.`,
    `Adding a ${LIGATURE_TEST_WORDS[6]} to the word changed its meaning entirely.`,
    `The process of ${LIGATURE_TEST_WORDS[7]} requires careful documentation.`,
    `The system was taken ${LIGATURE_TEST_WORDS[8]} for scheduled maintenance.`,
    `A ${LIGATURE_TEST_WORDS[9]} approach was needed for each situation.`,
  ];

  for (const sentence of sentences) {
    if (y < margin + lineHeight) break;
    page.drawText(sentence, { x: margin, y, size: fontSize, font });
    y -= lineHeight;
  }

  const bytes = await doc.save();
  await writeFile(resolve(FIXTURES_DIR, "02-ligatures.pdf"), bytes);
  console.log("  02-ligatures.pdf");
}

async function generateMultipagePdf(): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontSize = 11;
  const lineHeight = 16;
  const margin = 72;
  const pageWidth = 612;
  const pageHeight = 792;
  const textWidth = pageWidth - 2 * margin;

  // Generate ~20 pages of content
  const loremBase =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor " +
    "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud " +
    "exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure " +
    "dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. " +
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt " +
    "mollit anim id est laborum.";

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  page.drawText("Multipage Stress Test Document", {
    x: margin,
    y,
    size: 20,
    font: boldFont,
  });
  y -= 40;

  // 20 chapters with substantial content
  for (let ch = 1; ch <= 20; ch++) {
    if (y < margin + 60) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    page.drawText(`Chapter ${ch}: Section Content`, {
      x: margin,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 28;

    // 3 paragraphs per chapter
    for (let p = 0; p < 3; p++) {
      const text = `[Ch${ch}-P${p + 1}] ${loremBase}`;
      const words = text.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > textWidth && line) {
          if (y < margin + lineHeight) {
            page = doc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          page.drawText(line, { x: margin, y, size: fontSize, font });
          y -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size: fontSize, font });
        y -= lineHeight;
      }
      y -= lineHeight / 2;
    }
  }

  const bytes = await doc.save();
  await writeFile(resolve(FIXTURES_DIR, "03-multipage-20.pdf"), bytes);
  console.log(`  03-multipage-20.pdf (${doc.getPageCount()} pages)`);
}

async function generateTwoColumnPdf(): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 54;
  const gutter = 18;
  const pageWidth = 612;
  const pageHeight = 792;
  const colWidth = (pageWidth - 2 * margin - gutter) / 2;

  const page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title spanning both columns
  page.drawText("Two-Column Research Article with Footnotes", {
    x: margin,
    y,
    size: 16,
    font: boldFont,
  });
  y -= 30;

  // Left column content
  const leftText = [
    "The development of natural language processing has accelerated significantly " +
      "in recent years. Transformer architectures, introduced by Vaswani et al. (2017), " +
      "fundamentally changed the approach to sequence modeling tasks.",
    "Pre-trained language models like BERT and GPT demonstrated that large-scale " +
      "unsupervised learning could produce representations useful across many downstream " +
      "tasks. This transfer learning paradigm reduced the need for task-specific architectures.",
    "Recent work has focused on scaling these models to hundreds of billions of parameters, " +
      "with corresponding improvements in few-shot and zero-shot performance across benchmarks.",
  ];

  // Right column content
  const rightText = [
    "The implications for document processing are substantial. Modern NLP systems can " +
      "extract structured information from unstructured text with unprecedented accuracy.",
    "Named entity recognition, relation extraction, and document classification have all " +
      "benefited from transformer-based approaches. Production systems now routinely " +
      "achieve human-level performance on many extraction tasks.",
    "However, challenges remain in handling domain-specific terminology, multilingual " +
      "documents, and preserving document structure during extraction. These are active " +
      "areas of research with significant practical implications.",
  ];

  // Render left column
  let leftY = y;
  for (const para of leftText) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > colWidth && line) {
        page.drawText(line, { x: margin, y: leftY, size: fontSize, font });
        leftY -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y: leftY, size: fontSize, font });
      leftY -= lineHeight;
    }
    leftY -= lineHeight / 2;
  }

  // Render right column
  let rightY = y;
  const rightX = margin + colWidth + gutter;
  for (const para of rightText) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > colWidth && line) {
        page.drawText(line, { x: rightX, y: rightY, size: fontSize, font });
        rightY -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: rightX, y: rightY, size: fontSize, font });
      rightY -= lineHeight;
    }
    rightY -= lineHeight / 2;
  }

  // Footnotes at bottom
  const footnoteY = margin + 40;
  page.drawLine({
    start: { x: margin, y: footnoteY + 10 },
    end: { x: margin + colWidth, y: footnoteY + 10 },
    thickness: 0.5,
  });

  const footnotes = [
    '1. Vaswani, A. et al. "Attention Is All You Need." NeurIPS 2017.',
    '2. Devlin, J. et al. "BERT: Pre-training of Deep Bidirectional Transformers." NAACL 2019.',
  ];

  let fnY = footnoteY;
  for (const fn of footnotes) {
    page.drawText(fn, { x: margin, y: fnY, size: 8, font });
    fnY -= 12;
  }

  const bytes = await doc.save();
  await writeFile(resolve(FIXTURES_DIR, "04-two-column.pdf"), bytes);
  console.log("  04-two-column.pdf");
}

async function generateImageOnlyPdf(): Promise<void> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);

  // Draw a rectangle with a "scanned document" placeholder
  page.drawRectangle({
    x: 72,
    y: 200,
    width: 468,
    height: 500,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  // Note: pdf-lib can't embed raster images from scratch without actual image bytes.
  // We create a PDF with only vector graphics and no text operators at all.
  // This simulates an image-only/scanned PDF for the "expected failure" test case.
  page.drawRectangle({
    x: 100,
    y: 600,
    width: 200,
    height: 20,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawRectangle({
    x: 100,
    y: 560,
    width: 350,
    height: 12,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawRectangle({
    x: 100,
    y: 540,
    width: 320,
    height: 12,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawRectangle({
    x: 100,
    y: 520,
    width: 360,
    height: 12,
    color: rgb(0.5, 0.5, 0.5),
  });

  const bytes = await doc.save();
  await writeFile(resolve(FIXTURES_DIR, "05-image-only.pdf"), bytes);
  console.log("  05-image-only.pdf (expected failure - no text)");
}

// ---------------------------------------------------------------------------
// DOCX Fixtures
// ---------------------------------------------------------------------------

async function generateBaselineDocx(): Promise<void> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: DOCX_GROUND_TRUTH.title,
      heading: HeadingLevel.TITLE,
    }),
  );

  let headingIdx = 0;
  let paraIdx = 0;
  let listIdx = 0;

  // Chapter 1
  const h = DOCX_GROUND_TRUTH.headings;

  // H1: Chapter 1
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_1 }));
  // Para
  children.push(
    new Paragraph({ children: buildFormattedRuns(DOCX_GROUND_TRUTH.paragraphs[paraIdx++]) }),
  );

  // H2: Historical Context
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_2 }));
  children.push(
    new Paragraph({ children: buildFormattedRuns(DOCX_GROUND_TRUTH.paragraphs[paraIdx++]) }),
  );

  // H2: Key Methodologies
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_2 }));

  // H3: Grounded Theory
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_3 }));
  children.push(
    new Paragraph({ children: buildFormattedRuns(DOCX_GROUND_TRUTH.paragraphs[paraIdx++]) }),
  );

  // Bullet list: coding methods
  for (const item of DOCX_GROUND_TRUTH.lists[listIdx++]) {
    children.push(
      new Paragraph({
        text: item,
        bullet: { level: 0 },
      }),
    );
  }

  // H3: Phenomenological Analysis
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_3 }));
  children.push(
    new Paragraph({ children: buildFormattedRuns(DOCX_GROUND_TRUTH.paragraphs[paraIdx++]) }),
  );

  // Bullet list: phenomenological steps
  for (const item of DOCX_GROUND_TRUTH.lists[listIdx++]) {
    children.push(
      new Paragraph({
        text: item,
        bullet: { level: 0 },
      }),
    );
  }

  // Chapter 2
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_1 }));
  children.push(
    new Paragraph({ children: buildFormattedRuns(DOCX_GROUND_TRUTH.paragraphs[paraIdx++]) }),
  );

  // H2: Interview Methods
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_2 }));
  children.push(
    new Paragraph({ children: buildFormattedRuns(DOCX_GROUND_TRUTH.paragraphs[paraIdx++]) }),
  );

  // H2: Observation Protocols
  children.push(new Paragraph({ text: h[headingIdx++].text, heading: HeadingLevel.HEADING_2 }));
  children.push(
    new Paragraph({ children: buildFormattedRuns(DOCX_GROUND_TRUTH.paragraphs[paraIdx++]) }),
  );

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(resolve(FIXTURES_DIR, "06-baseline.docx"), buffer);
  console.log("  06-baseline.docx");
}

function buildFormattedRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;

  // Apply bold and italic from ground truth
  const allBold = DOCX_GROUND_TRUTH.boldPhrases;
  const allItalic = DOCX_GROUND_TRUTH.italicPhrases;

  // Build a list of markers sorted by position
  interface Marker {
    start: number;
    end: number;
    bold?: boolean;
    italic?: boolean;
  }
  const markers: Marker[] = [];

  for (const phrase of allBold) {
    const idx = remaining.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx >= 0) {
      markers.push({ start: idx, end: idx + phrase.length, bold: true });
    }
  }
  for (const phrase of allItalic) {
    const idx = remaining.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx >= 0) {
      markers.push({ start: idx, end: idx + phrase.length, italic: true });
    }
  }

  markers.sort((a, b) => a.start - b.start);

  let pos = 0;
  for (const m of markers) {
    if (m.start > pos) {
      runs.push(new TextRun(remaining.slice(pos, m.start)));
    }
    runs.push(
      new TextRun({
        text: remaining.slice(m.start, m.end),
        bold: m.bold,
        italics: m.italic,
      }),
    );
    pos = m.end;
  }
  if (pos < remaining.length) {
    runs.push(new TextRun(remaining.slice(pos)));
  }

  return runs.length > 0 ? runs : [new TextRun(text)];
}

async function generateTableDocx(): Promise<void> {
  const gt = TABLE_GROUND_TRUTH;

  const headerRow = new TableRow({
    tableHeader: true,
    children: gt.headers.map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
    ),
  });

  const dataRows = gt.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph(cell)],
              width: { size: 25, type: WidthType.PERCENTAGE },
            }),
        ),
      }),
  );

  // Add a merged cell row to test vertical merge
  const mergedRows = [
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph("Action Research")],
          verticalMerge: VerticalMergeType.RESTART,
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph("Mixed")],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph("Varies")],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph("Ongoing")],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph("")],
          verticalMerge: VerticalMergeType.CONTINUE,
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph("Qualitative")],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph("10-50")],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph("3-12 months")],
          width: { size: 25, type: WidthType.PERCENTAGE },
        }),
      ],
    }),
  ];

  const table = new Table({
    rows: [headerRow, ...dataRows, ...mergedRows],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Research Methods Comparison", heading: HeadingLevel.HEADING_1 }),
          new Paragraph("The following table summarizes key research methodologies:"),
          table,
          new Paragraph(
            "Table 1: Research methods comparison with merged cells for Action Research.",
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(resolve(FIXTURES_DIR, "07-tables.docx"), buffer);
  console.log("  07-tables.docx");
}

async function generateLargeDocx(): Promise<void> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: "Large Document Stress Test",
      heading: HeadingLevel.TITLE,
    }),
  );

  // Generate ~50,000 words across 25 chapters
  const loremParagraph =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor " +
    "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud " +
    "exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure " +
    "dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. " +
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt " +
    "mollit anim id est laborum. Curabitur pretium tincidunt lacus sed auctor. Nulla " +
    "facilisi morbi tempus iaculis urna. Varius vel pharetra vel turpis nunc eget lorem " +
    "dolor. Adipiscing commodo elit at imperdiet dui accumsan sit amet nulla.";

  // ~80 words per paragraph, 25 paragraphs per chapter, 25 chapters = ~50,000 words
  for (let ch = 1; ch <= 25; ch++) {
    children.push(
      new Paragraph({
        text: `Chapter ${ch}: Topic ${ch}`,
        heading: HeadingLevel.HEADING_1,
      }),
    );

    for (let p = 0; p < 25; p++) {
      children.push(
        new Paragraph({
          text: `[${ch}.${p + 1}] ${loremParagraph}`,
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(resolve(FIXTURES_DIR, "08-large-50k.docx"), buffer);
  const sizeKB = Math.round(buffer.byteLength / 1024);
  console.log(`  08-large-50k.docx (${sizeKB} KB)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(FIXTURES_DIR, { recursive: true });

  console.log("Generating PDF fixtures...");
  await generateBaselinePdf();
  await generateLigaturePdf();
  await generateMultipagePdf();
  await generateTwoColumnPdf();
  await generateImageOnlyPdf();

  console.log("");
  console.log("Generating DOCX fixtures...");
  await generateBaselineDocx();
  await generateTableDocx();
  await generateLargeDocx();

  console.log("");
  console.log("Done. Manual fixtures required:");
  console.log("  - Word-generated PDF (save .docx as PDF from Word)");
  console.log("  - Google Docs-generated PDF (export from Docs)");
  console.log("  - Chrome print-to-PDF (print a web page)");
  console.log("  - Real Word .docx with footnotes, images, track changes");
  console.log("");
  console.log(`Fixtures directory: ${FIXTURES_DIR}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
