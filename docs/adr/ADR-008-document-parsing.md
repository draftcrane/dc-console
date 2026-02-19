# ADR-008: Document Parsing Libraries for PDF and DOCX Source Materials

## Status

**Accepted** - 2026-02-19

## Context

DraftCrane source materials currently support only `.txt` and `.md` uploads (`source-local.ts`). Users need to upload `.pdf` and `.docx` research documents — the two most common formats for academic papers, book drafts, and reference material. The `source_materials` table already supports arbitrary MIME types and R2 storage keys.

**Cloudflare Workers constraints:**

- 128 MB memory limit per isolate
- 30-second CPU time (Unbound plan)
- `nodejs_compat` flag enabled
- No local filesystem (`node:fs` unavailable at runtime)
- Bundle must be under 25 MB (compressed)

**Libraries evaluated:**

| Format | Library           | Bundle Size | Rationale                                                                        |
| ------ | ----------------- | ----------- | -------------------------------------------------------------------------------- |
| PDF    | `unpdf` v0.12     | ~1.4 MB     | Cloudflare's own R2 tutorials use it. Wraps PDF.js v5 for serverless. Zero deps. |
| DOCX   | `mammoth.js` v1.8 | ~400 KB     | Pure JS DOCX-to-HTML. 17k stars. Browser bundle avoids Node fs.                  |

**Ruled out:**

- `pdfjs-dist` — Workers compatibility issues with canvas/DOM assumptions
- `pdf-parse` — Unmaintained since 2023, depends on pdfjs-dist internally
- DIY jszip+xml for DOCX — Unnecessary when mammoth handles the XML/relationship complexity

## Decision

**Adopt both `unpdf` for PDF and `mammoth.js` for DOCX.** Both libraries pass all quality and compatibility thresholds.

### Evaluation Results

Full test data: [ADR-008-spike-results.md](ADR-008-spike-results.md)

#### Phase 1: Quality Evaluation (Node.js)

**18/18 checks passed** across 8 test fixtures.

**PDF (unpdf):**

| Test                                     | Result                  | Key Findings                                                                                                                                |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline text extraction                 | PASS (100%)             | Full word match against ground truth                                                                                                        |
| Reading order preservation               | PASS (100%)             | Sentences extracted in correct sequence                                                                                                     |
| Ligature handling (fi, fl, ff, ffi, ffl) | PASS (100%)             | All 10 ligature words extracted correctly from pdf-lib-generated PDF                                                                        |
| Multipage (10 pages, 4284 words)         | PASS                    | All 20 chapter markers found, 54ms extraction                                                                                               |
| Two-column layout                        | PASS                    | Both columns extracted; reading order left-before-right preserved (informational — real-world two-column PDFs from Word/LaTeX may scramble) |
| Image-only PDF                           | PASS (expected 0 words) | No text, no crash, no hallucination                                                                                                         |

**DOCX (mammoth.js):**

| Test                       | Result      | Key Findings                                                |
| -------------------------- | ----------- | ----------------------------------------------------------- |
| Heading detection (H1-H3)  | PASS (100%) | All 8 headings at correct level                             |
| Bold preservation          | PASS (100%) | 4/4 bold phrases wrapped in `<strong>`                      |
| Italic preservation        | PASS (75%)  | 3/4 italic phrases wrapped in `<em>` (threshold: 70%)       |
| List detection             | PASS (100%) | All 6 list items in `<ul>/<li>` structure                   |
| Table structure            | PASS (100%) | `<table>/<thead>/<tbody>/<tr>/<th>/<td>` produced correctly |
| Table content              | PASS (100%) | All headers and data cells present                          |
| Large document (63k words) | PASS        | 58ms extraction, all 25 chapter markers found               |
| Text completeness          | PASS (100%) | Full word match against ground truth                        |

#### Phase 2: Workers Compatibility

**All tests passed in `wrangler dev` (workerd runtime).**

| Metric                               | Value                                  |
| ------------------------------------ | -------------------------------------- |
| Bundle size (uncompressed)           | 3.4 MB                                 |
| Bundle size (gzipped)                | 757 KB                                 |
| Health check (both libraries import) | OK                                     |
| Corrupt PDF handling                 | Graceful error (`InvalidPDFException`) |
| Corrupt DOCX handling                | Graceful error (JSZip message)         |
| Empty file handling                  | Graceful error, no crash               |

**Progressive file size results (PDF via unpdf):**

| File Size | Parse Time | Words     | Status |
| --------- | ---------- | --------- | ------ |
| 21 KB     | 101ms      | 15,694    | OK     |
| 103 KB    | 496ms      | 78,470    | OK     |
| 205 KB    | 927ms      | 156,921   | OK     |
| 611 KB    | 2,800ms    | 470,725   | OK     |
| 1 MB      | 4,998ms    | 784,529   | OK     |
| 2 MB      | 10,277ms   | 1,569,039 | OK     |
| 4 MB      | 21,764ms   | 3,138,078 | OK     |

**Progressive file size results (DOCX via mammoth.js):**

| File Size | Parse Time | Words     | Status |
| --------- | ---------- | --------- | ------ |
| 8 KB      | 58ms       | 15,964    | OK     |
| 10 KB     | 154ms      | 79,716    | OK     |
| 13 KB     | 107ms      | 159,432   | OK     |
| 23 KB     | 228ms      | 478,296   | OK     |
| 33 KB     | 521ms      | 797,160   | OK     |
| 58 KB     | 721ms      | 1,594,268 | OK     |
| 109 KB    | 1,439ms    | 3,188,536 | OK     |

### Recommended Upload Limits

| Format        | Max Upload Size | Rationale                                                                    |
| ------------- | --------------- | ---------------------------------------------------------------------------- |
| `.txt`, `.md` | 5 MB            | Current limit, adequate for text files                                       |
| `.pdf`        | 20 MB           | 4 MB PDF parsed in ~22s, within 30s CPU limit with margin                    |
| `.docx`       | 20 MB           | DOCX compression means a 20 MB file is very large; mammoth handles it easily |

Note: PDF parse time scales roughly linearly with file size (~5ms/KB). A 20 MB PDF would take ~22s. The 30s CPU limit is the binding constraint. Recommend a user-facing warning for files over 10 MB PDF.

### Storage Format

**HTML** — same as existing `.txt`/`.md` flow in `source-local.ts`.

- Mammoth produces HTML natively
- PDF text gets wrapped via existing `textToHtml()` utility
- Tiptap consumes HTML directly
- Zero architecture changes required

### Sanitization Whitelist

Mammoth HTML output must pass through `sanitize-html` (already a dc-api dependency) before R2 storage. This prevents XSS from malicious DOCX files.

**Mammoth HTML element inventory** (observed across all test fixtures):

| Tag                                                     | Observed | Whitelist |
| ------------------------------------------------------- | -------- | --------- |
| `<p>`                                                   | 667      | Yes       |
| `<h1>` - `<h6>`                                         | 36       | Yes       |
| `<strong>`                                              | 8        | Yes       |
| `<em>`                                                  | 3        | Yes       |
| `<ul>`, `<ol>`, `<li>`                                  | 10       | Yes       |
| `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` | 42       | Yes       |

**Recommended `sanitize-html` configuration:**

```typescript
const ALLOWED_TAGS = [
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
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "br",
  "sup",
  "sub",
  "blockquote",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href"],
};
```

### Integration Path

Extend `SourceLocalService.addLocalSource()` in `source-local.ts`:

1. Add `.pdf` and `.docx` to `ALLOWED_LOCAL_EXTENSIONS`
2. Add MIME type mapping (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
3. For `.pdf`: `const doc = await getDocumentProxy(new Uint8Array(file.content)); const { text } = await extractText(doc, { mergePages: true }); const html = textToHtml(text);`
4. For `.docx`: `const { value: html } = await mammoth.convertToHtml({ arrayBuffer: file.content }); const sanitized = sanitizeHtml(html, { allowedTags: ALLOWED_TAGS, allowedAttributes: ALLOWED_ATTRIBUTES });`
5. Increase `MAX_LOCAL_FILE_SIZE` to 20 MB for PDF/DOCX (keep 5 MB for text)
6. Store original file in R2 as before, store converted HTML in `content.html`

No new bindings, routes, or database migrations required.

## Known Limitations

1. **Image/scanned PDFs produce no text.** No OCR capability in Phase 0. The spike confirmed that `unpdf` returns empty text for image-only PDFs without crashing. Recommend a user-facing message: "This PDF appears to contain only images. Please use a text-based PDF."

2. **PDF text extraction is flat.** No reliable heading/list structure from PDF — all text comes out as plain paragraphs. This is inherent to the PDF format (it stores rendering instructions, not document structure). Headings would require heuristics (font size detection) which are fragile.

3. **Multi-column PDF reading order.** The programmatic two-column test passed, but real-world multi-column PDFs from Word or LaTeX may produce scrambled reading order. This is a known limitation of all PDF text extraction libraries. Recommend a user-facing note for academic papers.

4. **DOCX visual formatting intentionally dropped.** Mammoth produces semantic HTML — fonts, colors, and visual styling are stripped. This is correct behavior for DraftCrane (content, not presentation).

5. **DOCX footnotes/endnotes.** Mammoth extracts footnote content but may not preserve the footnote reference markers. This is acceptable — source materials are reference text, not final manuscripts.

6. **Large PDF parse time.** PDFs over 10 MB take 10+ seconds to parse. Recommend a progress indicator in the UI and a file size warning.

## Consequences

### Positive

- Users can upload the two most common document formats for research materials
- Both libraries bundle and run in Cloudflare Workers with zero compatibility issues
- Combined bundle overhead is only 757 KB gzipped — negligible impact on cold start
- Error handling is graceful — corrupt files produce clear errors, not Worker crashes
- Integration requires changes to one file (`source-local.ts`) with no new infrastructure
- Sanitization whitelist protects against XSS from malicious DOCX files

### Negative

- PDF text extraction loses all structural information (headings, lists, tables become flat text)
- Image-only PDFs are silently empty — requires UI-level detection and user messaging
- Large PDFs (10+ MB) have meaningful parse latency — may need progress indication
- DOCX `Title` paragraph style produces a mammoth warning (cosmetic, not functional)

## References

- [Issue #135](https://github.com/venturecrane/dc-console/issues/135) — Spike: document parsing evaluation
- [unpdf](https://github.com/nicolo-ribaudo/unpdf) — PDF text extraction for serverless
- [mammoth.js](https://github.com/mwilliamson/mammoth.js) — DOCX to HTML converter
- [Cloudflare R2 + unpdf tutorial](https://developers.cloudflare.com/r2/tutorials/read-pdf/) — Cloudflare's own usage example
- ADR-005: Content Storage Architecture (R2 as content cache)
- `workers/dc-api/src/services/source-local.ts` — Current upload/parse/store pattern
