# ADR-008 Spike Results: Document Parsing Library Evaluation

**Date:** 2026-02-19
**Libraries:** unpdf (PDF), mammoth.js (DOCX)

## Summary

| Metric       | Value        |
| ------------ | ------------ |
| Total checks | 18           |
| Passed       | 18           |
| Failed       | 0            |
| Overall      | **ALL PASS** |

## PDF Extraction (unpdf)

### Baseline (programmatic)

**File:** `01-baseline.pdf` (2 KB) | **Time:** 463ms | **Words:** 175

| Check             | Score  | Threshold | Result   |
| ----------------- | ------ | --------- | -------- |
| Text completeness | 100.0% | 80.0%     | **PASS** |
| Reading order     | 100.0% | 80.0%     | **PASS** |

### Ligature test

**File:** `02-ligatures.pdf` (2 KB) | **Time:** 5ms | **Words:** 98

| Check                          | Score  | Threshold | Result   |
| ------------------------------ | ------ | --------- | -------- |
| Ligature words (missing: none) | 100.0% | 70.0%     | **PASS** |

### Multipage (20 pages)

**File:** `03-multipage-20.pdf` (13 KB) | **Time:** 54ms | **Words:** 4284

| Check                 | Score  | Threshold | Result   |
| --------------------- | ------ | --------- | -------- |
| Chapter markers found | 100.0% | 90.0%     | **PASS** |
| Word count > 3000     | 100.0% | 100.0%    | **PASS** |

### Two-column with footnotes

**File:** `04-two-column.pdf` (2 KB) | **Time:** 6ms | **Words:** 182

| Check                             | Score  | Threshold | Result   |
| --------------------------------- | ------ | --------- | -------- |
| Content extracted                 | 100.0% | 50.0%     | **PASS** |
| Reading order (left before right) | 100.0% | 0.0%      | **PASS** |

> Two-column reading order is a known PDF extraction challenge. Score is informational.

### Image-only (expected failure)

**File:** `05-image-only.pdf` (1 KB) | **Time:** 2ms | **Words:** 0

| Check                        | Score  | Threshold | Result   |
| ---------------------------- | ------ | --------- | -------- |
| No text extracted (expected) | 100.0% | 100.0%    | **PASS** |

> Expected: no text from image-only PDF. Confirms no silent hallucination.

## DOCX Extraction (mammoth.js)

### Baseline (headings/formatting)

**File:** `06-baseline.docx` (9 KB) | **Time:** 40ms | **Words:** 249

| Check                    | Score  | Threshold | Result   |
| ------------------------ | ------ | --------- | -------- |
| Headings (missing: none) | 100.0% | 90.0%     | **PASS** |
| Bold preservation        | 100.0% | 70.0%     | **PASS** |
| Italic preservation      | 75.0%  | 70.0%     | **PASS** |
| List items detected      | 100.0% | 80.0%     | **PASS** |
| Text completeness        | 100.0% | 80.0%     | **PASS** |

> Mammoth messages: warning: Unrecognised paragraph style: 'Title' (Style ID: Title)

<details>
<summary>HTML elements produced (8 unique tags)</summary>

| Tag        | Count |
| ---------- | ----- |
| `<p>`      | 8     |
| `<li>`     | 6     |
| `<h2>`     | 4     |
| `<strong>` | 4     |
| `<em>`     | 3     |
| `<h1>`     | 2     |
| `<h3>`     | 2     |
| `<ul>`     | 2     |

</details>

### Tables with merged cells

**File:** `07-tables.docx` (8 KB) | **Time:** 28ms | **Words:** 67

| Check                               | Score  | Threshold | Result   |
| ----------------------------------- | ------ | --------- | -------- |
| Table structure (<table>/<tr>/<td>) | 100.0% | 100.0%    | **PASS** |
| Table headers found                 | 100.0% | 75.0%     | **PASS** |
| Table cells found                   | 100.0% | 75.0%     | **PASS** |

<details>
<summary>HTML elements produced (9 unique tags)</summary>

| Tag        | Count |
| ---------- | ----- |
| `<p>`      | 33    |
| `<td>`     | 27    |
| `<tr>`     | 8     |
| `<th>`     | 4     |
| `<strong>` | 4     |
| `<h1>`     | 1     |
| `<table>`  | 1     |
| `<thead>`  | 1     |
| `<tbody>`  | 1     |

</details>

### Large document (50k words)

**File:** `08-large-50k.docx` (12 KB) | **Time:** 58ms | **Words:** 63229

| Check                | Score  | Threshold | Result   |
| -------------------- | ------ | --------- | -------- |
| Word count > 40000   | 100.0% | 100.0%    | **PASS** |
| Chapter markers (25) | 100.0% | 90.0%     | **PASS** |

> Mammoth messages: warning: Unrecognised paragraph style: 'Title' (Style ID: Title)

<details>
<summary>HTML elements produced (2 unique tags)</summary>

| Tag    | Count |
| ------ | ----- |
| `<p>`  | 626   |
| `<h1>` | 25    |

</details>

## Mammoth HTML Element Audit (Sanitization Whitelist)

Combined element inventory across all DOCX test files:

| Tag        | Total Count | Include in Whitelist? |
| ---------- | ----------- | --------------------- |
| `<p>`      | 667         | Yes                   |
| `<h1>`     | 28          | Yes                   |
| `<td>`     | 27          | Yes                   |
| `<strong>` | 8           | Yes                   |
| `<tr>`     | 8           | Yes                   |
| `<li>`     | 6           | Yes                   |
| `<h2>`     | 4           | Yes                   |
| `<th>`     | 4           | Yes                   |
| `<em>`     | 3           | Yes                   |
| `<h3>`     | 2           | Yes                   |
| `<ul>`     | 2           | Yes                   |
| `<table>`  | 1           | Yes                   |
| `<thead>`  | 1           | Yes                   |
| `<tbody>`  | 1           | Yes                   |

**Recommended sanitize-html allowlist:**

```js
allowedTags: [
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
];
```

## Performance Summary

| Test                           | File Size | Extraction Time | Words Extracted |
| ------------------------------ | --------- | --------------- | --------------- |
| Baseline (programmatic)        | 2 KB      | 463ms           | 175             |
| Ligature test                  | 2 KB      | 5ms             | 98              |
| Multipage (20 pages)           | 13 KB     | 54ms            | 4284            |
| Two-column with footnotes      | 2 KB      | 6ms             | 182             |
| Image-only (expected failure)  | 1 KB      | 2ms             | 0               |
| Baseline (headings/formatting) | 9 KB      | 40ms            | 249             |
| Tables with merged cells       | 8 KB      | 28ms            | 67              |
| Large document (50k words)     | 12 KB     | 58ms            | 63229           |

## Pass/Fail Thresholds

| Criterion            | Threshold |
| -------------------- | --------- |
| pdfTextCompleteness  | 80.0%     |
| pdfReadingOrder      | 80.0%     |
| pdfLigatures         | 70.0%     |
| docxHeadings         | 90.0%     |
| docxTables           | 100.0%    |
| docxListDetection    | 80.0%     |
| docxBoldItalic       | 70.0%     |
| docxTextCompleteness | 80.0%     |
