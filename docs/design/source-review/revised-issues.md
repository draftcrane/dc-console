# Revised Issues: DraftCrane Source/Research UX

> Companion to `design-spec.md`
> Covers all backlog issues #121-137 plus new issues discovered during the design review
> Date: 2026-02-19

---

## Summary Table

| Original # | Disposition | New Title | Phase | Effort |
|-------------|-------------|-----------|-------|--------|
| #121 | Keep | Authorize Google Drive access for source file reading | A | S |
| #122 | Rewrite | Select Google Drive files as project sources via inline Drive browser | A | M |
| #123 | Rewrite | Upload local files (.txt, .md, .docx, .pdf) as project sources | A | S |
| #124 | Keep (extend) | Backend text extraction service for .docx, .pdf, .txt with FTS indexing | A | L |
| #125 | Rewrite | AI natural language query endpoint with SSE streaming | B | L |
| #126 | Keep | Chunk source text and build effective LLM prompts | B | M |
| #127 | Keep | Parse LLM responses into structured snippet list with source references | B | M |
| #128 | Rewrite | Research Panel with tab navigation and toolbar toggle | A | L |
| #129 | Rewrite | Ask tab with query input, streaming results, and result cards | B | L |
| #130 | Rewrite | Tappable source citations that navigate to source detail with breadcrumb | B | S |
| #131 | Rewrite | Save snippets to Clips from AI results and source text selection | C | M |
| #132 | Rewrite | Clips tab with chapter filter, search, and management | C | M |
| #133 | Rewrite | Insert clips into editor with automatic footnote creation | C | L |
| #134 | Keep | SPIKE: LLM prompt engineering for structured snippet output | Pre-B | S |
| #135 | Keep | SPIKE: Document parsing library evaluation for .pdf and .docx | Pre-A | S |
| #136 | Keep | SPIKE: Content chunking strategy and context window management | Pre-B | S |
| #137 | Rewrite | SPIKE: Source content renderer with scroll-to-position for Research Panel | A | S |
| NEW-1 | New | Research Panel infrastructure: context provider and state machine | A | M |
| NEW-2 | New | Trust messaging in Source Add Flow | A | XS |
| NEW-3 | New | First-use nudge for Research Panel discovery | A | S |
| NEW-4 | New | Always-visible search in Source Detail View | A | S |
| NEW-5 | New | Cross-tab navigation with breadcrumb for source citations | B | S |
| NEW-6 | New | Chapter tag on clips for power user organization | C | S |
| NEW-7 | New | Tiptap footnote extension for auto-citation | C | L |
| NEW-8 | New | Remove chapter-source linking (deprecate endpoints and table) | A | S |
| NEW-9 | New | Full-text search endpoint for Sources tab | A | M |
| NEW-10 | New | Research clips CRUD API | B-C | M |

---

## Issue #121: Authorize Google Drive access for source file reading

**Replaces/Updates:** #121
**Type:** story
**Phase:** A
**Dependencies:** None
**Effort:** S

### Story
As a user, I want to connect my Google Drive account so DraftCrane can read my source documents for research purposes.

### Acceptance Criteria
- [ ] OAuth flow connects user's Google Drive with read-only scope
- [ ] Connected accounts appear in the Source Add Flow
- [ ] Multiple Google accounts supported
- [ ] Disconnect flow removes access tokens
- [ ] Existing Drive OAuth implementation preserved

### Technical Notes
No changes from current implementation. This issue is a prerequisite for #122.

### Design References
- design-spec.md, Section 5: Flow 1 (precondition: Google account connected)

---

## Issue #122: Select Google Drive files as project sources via inline Drive browser

**Replaces/Updates:** #122
**Type:** story
**Phase:** A
**Dependencies:** #121 (Drive auth), #128 (Research Panel), NEW-2 (trust messaging)
**Effort:** M

### Story
As a user, I want to browse my Google Drive within the Research Panel's Sources tab and select files to add as project sources, without any sheet stacking or modal layering.

### Acceptance Criteria
- [ ] [+ Add] button in Sources tab header opens inline Source Add Flow
- [ ] Source Add Flow replaces source list content (no sheet/modal overlay)
- [ ] Trust message visible: "DraftCrane reads your files to help you search and reference them. Your originals are never changed."
- [ ] Connected Drive accounts shown with "Browse Google Drive" option
- [ ] Selecting an account opens inline folder browser
- [ ] Folder browser shows folders (navigable via tap) and Google Docs (selectable via checkbox)
- [ ] Files already in project show "Already added" with disabled checkbox
- [ ] "Add N Selected" button adds all checked files as project sources
- [ ] After adding, view transitions back to source list with new sources showing "Processing..."
- [ ] [< Sources] back button at every level for navigation
- [ ] All touch targets minimum 44pt
- [ ] Checkboxes: 44x44pt tap area (visually 24x24px)
- [ ] "Add Selected" footer: 48pt height, full width, sticky at bottom

### Technical Notes
- Replaces `AddSourceSheet` and `DriveBrowserSheet` components
- Reuses existing `useDriveBrowser` hook, rendered inline within Sources tab instead of as sheets
- The `SourceAddFlow` component manages its own sub-navigation (account list > folder browser)
- DraftCrane stack: Next.js frontend, Cloudflare Workers backend, Google Drive API

### Design References
- design-spec.md, Section 5: Flow 1 (Add Source from Google Drive)
- design-spec.md, Section 7: SourceAddFlow component spec

---

## Issue #123: Upload local files (.txt, .md, .docx, .pdf) as project sources

**Replaces/Updates:** #123
**Type:** story
**Phase:** A
**Dependencies:** #124 (text extraction for .docx/.pdf), #128 (Research Panel)
**Effort:** S

### Story
As a user, I want to upload files from my device as project sources via the Source Add Flow, so I can include research documents that are not in Google Drive.

### Acceptance Criteria
- [ ] "Upload from device" option in Source Add Flow alongside Drive accounts
- [ ] Tapping opens iPadOS/iOS system file picker
- [ ] File picker accepts `.txt`, `.md`, `.docx`, `.pdf`
- [ ] Uploaded file appears in source list with "Processing..." spinner
- [ ] After text extraction, source shows word count and "Updated" timestamp
- [ ] File size limit: 5MB (clear error for larger files)
- [ ] Unsupported file types show clear error message
- [ ] Upload failure shows "Upload failed" with Retry/Remove actions
- [ ] Text extraction failure shows "Could not extract text" with Remove action

### Technical Notes
- System file picker is native iPadOS -- handles its own touch targets
- `accept` attribute: `.txt,.md,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- "Upload from device" row: 56pt minimum height, full-width tap target
- Backend: existing upload endpoint expanded for new file types

### Design References
- design-spec.md, Section 5: Flow 2 (Add Source from Local Device)

---

## Issue #124: Backend text extraction service for .docx, .pdf, .txt with FTS indexing

**Replaces/Updates:** #124
**Type:** story
**Phase:** A
**Dependencies:** #135 (doc parsing spike)
**Effort:** L

### Story
As the system, I need to extract plain text from uploaded and Drive-sourced documents so that source content can be displayed in the viewer, searched in the Sources tab, and queried by the AI.

### Acceptance Criteria
- [ ] Extract text from Google Docs (existing, via Drive API export)
- [ ] Extract text from .docx files (new, via parsing library from spike #135)
- [ ] Extract text from .pdf files (new, via parsing library from spike #135)
- [ ] Extract text from .txt and .md files (existing)
- [ ] Store HTML version in R2 at `sources/{sourceId}/content.html` (for viewer display)
- [ ] Store plain text version in R2 at `sources/{sourceId}/content.txt` (for AI queries and FTS)
- [ ] Populate `source_content_fts` FTS5 virtual table after extraction
- [ ] Update `source_materials.word_count`, `r2_key`, and `cached_at` after extraction
- [ ] Handle extraction failures gracefully (set source status to "error" with message)
- [ ] Re-extraction on content refresh (update FTS index)

### Technical Notes
- Spike #135 output determines the parsing library
- FTS5 table creation is Migration 0016 (see design-spec.md, Section 8)
- Plain text version is critical path for Phase B (AI queries)
- DraftCrane stack: Cloudflare Workers (Hono), R2 for storage, D1 for metadata/FTS

### Design References
- design-spec.md, Section 8: Data Model (source_content_fts, R2 storage patterns)

---

## Issue #125: AI natural language query endpoint with SSE streaming

**Replaces/Updates:** #125
**Type:** story
**Phase:** B
**Dependencies:** #124 (text extraction), #126 (chunking), #127 (response parsing), #134 (prompt engineering spike)
**Effort:** L

### Story
As the Ask tab frontend, I need an API endpoint that accepts a natural language query and returns structured results with source citations, streamed as SSE events.

### Acceptance Criteria
- [ ] `POST /projects/:projectId/research/query` endpoint
- [ ] Accepts `{ query: string, sourceIds?: string[] }`
- [ ] Collects source content from R2 (plain text versions)
- [ ] Applies chunking strategy from spike #136 output
- [ ] Sends chunks + query to LLM (Workers AI or OpenAI per project tier)
- [ ] Parses response into individual cited results (per spike #134 output)
- [ ] Streams results as SSE: `event: result`, `event: done`, `event: error`
- [ ] Each result includes `content`, `sourceId`, `sourceTitle`, `sourceLocation`
- [ ] Rate limited: 20 queries/minute/user (KV sliding window)
- [ ] Saves query metadata to `research_queries` table
- [ ] Returns 400 if project has no sources with cached content
- [ ] Returns 400 if query exceeds 1000 characters
- [ ] Non-streaming fallback for `Accept: application/json`
- [ ] Query processing time measured and included in `done` event

### Technical Notes
- SSE streaming on Cloudflare Workers has execution time limits -- stream and close promptly
- Rate limiting uses existing KV sliding window pattern (see MEMORY.md)
- LLM selection: Workers AI (Mistral Small 3.1) for edge tier, OpenAI (gpt-4o) for frontier tier
- AI responses are ephemeral (not stored in D1). Only query metadata stored.

### Design References
- design-spec.md, Section 9: API Specification (POST /research/query)

---

## Issue #126: Chunk source text and build effective LLM prompts

**Replaces/Updates:** #126
**Type:** story
**Phase:** B
**Dependencies:** #136 (chunking strategy spike)
**Effort:** M

### Story
As the research query backend, I need a chunking service that breaks source content into appropriately sized pieces for LLM context windows, preserving document boundaries and metadata.

### Acceptance Criteria
- [ ] Chunk plain text source content into segments appropriate for LLM context window
- [ ] Preserve source document boundaries (no cross-document chunks)
- [ ] Include source metadata (title, ID) with each chunk
- [ ] Handle variable document lengths (500 words to 10,000+ words)
- [ ] Chunking strategy informed by spike #136 output
- [ ] Chunks suitable for both Workers AI (smaller context) and OpenAI (larger context)

### Technical Notes
- Chunking approach determined by spike #136
- Must handle Marcus scenario: 100+ documents, potentially millions of words total
- Context window management is critical for answer quality

### Design References
- design-spec.md, Section 9: API Specification (query endpoint implementation notes)

---

## Issue #127: Parse LLM responses into structured snippet list with source references

**Replaces/Updates:** #127
**Type:** story
**Phase:** B
**Dependencies:** #134 (prompt engineering spike)
**Effort:** M

### Story
As the research query backend, I need a response parser that extracts structured results (passage text + source citation) from LLM output, matching the `ResultCard` data format.

### Acceptance Criteria
- [ ] Parse LLM response into individual cited results
- [ ] Each result has: `content`, `sourceId`, `sourceTitle`, `sourceLocation`
- [ ] Handle cases where LLM cites multiple sources in one passage
- [ ] Handle cases where LLM finds no relevant results
- [ ] Handle malformed LLM output gracefully (fallback to raw text with best-effort citation)
- [ ] Response format informed by spike #134 output

### Technical Notes
- Prompt format and expected response structure from spike #134
- Parser must be resilient to LLM output variations
- Source location is human-readable ("Section 3", "Near beginning"), not byte offset

### Design References
- design-spec.md, Section 9: TypeScript interfaces (AISearchResult)

---

## Issue #128: Research Panel with tab navigation and toolbar toggle

**Replaces/Updates:** #128
**Type:** story
**Phase:** A
**Dependencies:** NEW-1 (context provider)
**Effort:** L

### Story
As a user, I want a Research button in the editor toolbar that toggles a right-hand panel with three tabs (Sources, Ask, Clips), providing a unified research workspace alongside my writing.

### Acceptance Criteria
- [ ] Research icon/button in editor toolbar toggles panel open/close
- [ ] Panel has three tabs: Sources, Ask, Clips
- [ ] Keyboard shortcut: Cmd+Shift+R toggles panel
- [ ] Escape key closes panel
- [ ] Landscape (1024pt+): panel is 340pt, pushes editor (editor minimum 400pt)
- [ ] Portrait (<1024pt): panel is 85% overlay with dimmed backdrop
- [ ] Swipe-right on overlay panel dismisses it (delta > 60pt)
- [ ] Tapping backdrop in overlay mode closes panel
- [ ] Panel uses `100dvh` and `env(safe-area-inset-*)`
- [ ] Tab state persists while panel is open (switching tabs doesn't reset content)
- [ ] `prefers-reduced-motion` disables slide animations
- [ ] Panel does not break editor auto-save or Drive write-through
- [ ] All text minimum 16px (prevents iOS auto-zoom)
- [ ] Panel accessibility: `role="complementary"`, `aria-label="Research panel"`
- [ ] Tab bar: `role="tablist"`, tabs: `role="tab"` with `aria-selected`
- [ ] Tab panels: `role="tabpanel"` with `aria-labelledby`
- [ ] Focus trap in overlay mode
- [ ] Ask and Clips tabs show "Coming soon" placeholder in Phase A

### Technical Notes
- Replaces: `SourcesPanel`, `AddSourceSheet`, `DriveBrowserSheet`, `SourceViewerSheet`
- `EditorDialogsProps` reduced from ~100 props to <= 5 research-related props
- Panel layout is CSS Grid or Flexbox with fixed widths
- Sidebar auto-collapse: when panel open and sidebar visible, if editor < 400pt, sidebar collapses

### Design References
- design-spec.md, Section 3: Information Architecture
- design-spec.md, Section 6: Panel Specifications

---

## Issue #129: Ask tab with query input, streaming results, and result cards

**Replaces/Updates:** #129
**Type:** story
**Phase:** B
**Dependencies:** #125 (query endpoint), #128 (panel infrastructure)
**Effort:** L

### Story
As a user, I want to type natural-language questions about my source documents in the Ask tab and see streaming results with cited passages and action buttons.

### Acceptance Criteria
- [ ] Query input at bottom of Ask tab (iMessage/chat pattern)
- [ ] Send button: 44pt minimum, disabled when input empty
- [ ] Cmd+Return keyboard shortcut submits query
- [ ] `enterkeyhint="send"` on input for mobile keyboards
- [ ] Input minimum 16px font size (prevents iOS zoom)
- [ ] Empty state shows 3 suggested queries (tappable, auto-submit)
- [ ] Loading: skeleton loader with "Searching across N sources..."
- [ ] Results stream in as SSE events, appearing progressively
- [ ] Each `ResultCard` shows: passage text, source title (tappable), source location
- [ ] "Save to Clips" action on each card (updates to checkmark "Saved")
- [ ] "Insert" action on each card (inserts at editor cursor with footnote)
- [ ] Error state: "Something went wrong" with Retry button
- [ ] No-results state: helpful message with rephrasing suggestions
- [ ] No-sources state: "Add source documents first" with link to Sources tab
- [ ] Conversation history persists within session (scrollable Q&A pairs)
- [ ] Virtual keyboard handling: conversation scrolls up via `visualViewport` API
- [ ] Result card action buttons: 44pt minimum touch targets

### Technical Notes
- Uses `useAIResearch` hook for query state, streaming, conversation
- SSE consumption via `EventSource` or `fetch` with stream reader
- Source title taps use cross-tab navigation (see NEW-5)

### Design References
- design-spec.md, Section 5: Flow 4 (Search Sources with Natural Language Query)
- design-spec.md, Section 7: AskTab, QueryInput, ResultCard components

---

## Issue #130: Tappable source citations that navigate to source detail with breadcrumb

**Replaces/Updates:** #130
**Type:** story
**Phase:** B
**Dependencies:** #128 (panel infrastructure), #137 (preview component spike), NEW-5 (cross-tab navigation)
**Effort:** S

### Story
As a user, when I see a source title in an AI result card or clip card, I want to tap it and see the full source document, scrolled near the cited passage, with a clear way to return to where I was.

### Acceptance Criteria
- [ ] Source title in `ResultCard` is a tappable link (44pt minimum)
- [ ] Source title in `ClipCard` is a tappable link (44pt minimum)
- [ ] Tapping navigates to Sources tab > Source Detail View for that source
- [ ] If `sourceLocation` is available, detail view scrolls to approximate position
- [ ] If `sourceLocation` is null, detail view opens at top
- [ ] "Back to Ask" or "Back to Clips" breadcrumb replaces standard "< Sources" back button
- [ ] Tapping breadcrumb returns to the originating tab with state preserved
- [ ] Source titles for removed sources show "[Source removed]" -- not tappable

### Technical Notes
- Cross-tab navigation managed by `ResearchPanelProvider` (`returnTab` state)
- Scroll-to-position uses text search matching from spike #137 output
- `SourceDetailView.backLabel` prop controls breadcrumb text

### Design References
- design-spec.md, Section 5: Flow 8 (cross-tab navigation resolution)
- design-spec.md, Section 7: SourceDetailView (`backLabel` prop)

---

## Issue #131: Save snippets to Clips from AI results and source text selection

**Replaces/Updates:** #131
**Type:** story
**Phase:** C
**Dependencies:** #128 (panel infrastructure), #125 (for AI result saving path), NEW-6 (chapter tags), NEW-10 (clips API)
**Effort:** M

### Story
As a user, I want to save useful passages to my Clips collection from two paths: tapping "Save to Clips" on an AI result, and selecting text in the Source Detail View.

### Acceptance Criteria
- [ ] "Save to Clips" button on each AI `ResultCard`
- [ ] Button changes to checkmark "Saved" after saving
- [ ] Duplicate detection: same content + source does not create second clip
- [ ] Long-press text selection in Source Detail View triggers iOS selection handles
- [ ] Floating toolbar appears above selection with "Copy" and "Save to Clips" (both 44pt height)
- [ ] "Save to Clips" in floating toolbar is prominently labeled, full-height button
- [ ] Optional chapter tag dropdown appears briefly after save action (2s auto-dismiss)
- [ ] Chapter dropdown defaults to "All chapters"
- [ ] Saved clip includes: content, sourceId, sourceTitle, sourceLocation, optional chapterId
- [ ] Clips tab badge updates to show new count
- [ ] Toast notification: "Saved to Clips"
- [ ] Source Detail View shows hint on first 3 views: "Tip: Select text to save passages to Clips"
- [ ] API: `POST /projects/:projectId/research/clips`

### Technical Notes
- Floating toolbar uses `position: fixed` based on `getSelection().getRangeAt(0).getBoundingClientRect()`
- Toolbar must appear above selection, not behind panel header
- Chapter tag dropdown is a lightweight inline element, not a modal
- Hint stored in `localStorage`: `source-detail-hint-count-{projectId}`

### Design References
- design-spec.md, Section 5: Flow 5 (Save a Snippet)
- design-spec.md, Section 12: Feedback Resolution #1 (text selection discoverability)

---

## Issue #132: Clips tab with chapter filter, search, and management

**Replaces/Updates:** #132
**Type:** story
**Phase:** C
**Dependencies:** #131 (save clips), NEW-6 (chapter tags), NEW-10 (clips API)
**Effort:** M

### Story
As a user, I want to view, search, filter, and manage my saved clips in the Clips tab, organized by chapter when needed.

### Acceptance Criteria
- [ ] Clips tab shows all saved clips, most recent first
- [ ] Chapter filter dropdown at top: "All Chapters" / per-chapter options
- [ ] Filtering by chapter shows only clips tagged to that chapter
- [ ] Search field filters clips by text content and source title
- [ ] Each `ClipCard` shows: snippet text (truncated 300 chars, "Show more"), source title (tappable), chapter tag (if assigned), save date
- [ ] Delete action via swipe-left or overflow menu (no modal confirmation for clips)
- [ ] Empty state: "No clips yet. Save passages from AI results or select text in source documents to build your research board."
- [ ] Clips with removed sources show "[Source removed]" in gray (not tappable)
- [ ] Clip text exceeding 300 chars truncated with "Show more" toggle (inline expand)
- [ ] All action buttons: 44pt minimum height
- [ ] API: `GET /projects/:projectId/research/clips?chapterId=xxx`, `DELETE /research/clips/:clipId`

### Technical Notes
- Chapter filter uses project's chapter list from existing sidebar data
- Search is client-side filtering (clips loaded in memory -- typically < 200 clips)
- Swipe-to-delete follows same pattern as Flow 7 (source removal)

### Design References
- design-spec.md, Section 5: Flow 8 (Browse Collected Snippets)
- design-spec.md, Section 7: ClipsTab, ClipCard components
- design-spec.md, Section 12: Feedback Resolution #3 (flat clip list scaling)

---

## Issue #133: Insert clips into editor with automatic footnote creation

**Replaces/Updates:** #133
**Type:** story
**Phase:** C
**Dependencies:** #131 (save clips), #132 (clips tab), NEW-7 (Tiptap footnote extension)
**Effort:** L

### Story
As a user, I want to insert a saved clip into my chapter at the cursor position, with the text wrapped in a blockquote and a footnote automatically created referencing the source document.

### Acceptance Criteria
- [ ] "Insert" button on each `ClipCard` and `ResultCard`
- [ ] Tapping Insert: focuses editor, inserts blockquote at stored cursor position
- [ ] Footnote auto-created with source title as reference text
- [ ] Footnote rendered at bottom of chapter content
- [ ] If no cursor position stored, text appended to end of chapter with toast: "Inserted at end of chapter"
- [ ] If no chapter selected, Insert button disabled with tooltip
- [ ] Success toast: "Inserted with footnote"
- [ ] Undo (Cmd+Z) removes blockquote and footnote together (single transaction)
- [ ] Inserted content participates in Drive write-through (auto-saves normally)
- [ ] Footnotes serialize to HTML correctly for Drive export
- [ ] No viewport jumping or keyboard flickering on iPad during insertion
- [ ] `lastSelectionRef` tracks editor cursor position even when Research Panel has focus
- [ ] `requestAnimationFrame` wrapper on `editor.commands.focus()` prevents iPad viewport issues
- [ ] **NOT** drag-and-drop. Button-only insertion. (iPad Safari limitation)

### Technical Notes
- Tiptap footnote extension (NEW-7) must be complete before this issue
- Insert is a single Tiptap transaction: `chain().insertContent(blockquote).insertContent(footnoteRef).run()`
- Footnote node type must handle: serialization to HTML, deserialization, undo/redo, Drive write-through
- `editor.commands.focus(null, { scrollIntoView: true })` with `requestAnimationFrame` for iPad
- The three-tier save architecture (local > R2 > Drive) requires footnote HTML to be valid

### Design References
- design-spec.md, Section 5: Flow 6 (Insert a Snippet)
- design-spec.md, Section 12: Feedback Resolution #2 (cursor position)

---

## Issue #134: SPIKE: LLM prompt engineering for structured snippet output

**Replaces/Updates:** #134
**Type:** spike
**Phase:** Pre-B
**Dependencies:** None
**Effort:** S

### Story
As an engineer, I need to determine the optimal prompt format and expected response structure for the research query endpoint, ensuring the LLM returns individually cited passages rather than free-form text.

### Acceptance Criteria
- [ ] Test prompt formats with both Workers AI (Mistral Small 3.1) and OpenAI (gpt-4o)
- [ ] Define a response format that can be reliably parsed into `{ content, sourceTitle, sourceLocation }` tuples
- [ ] Test with real-world source content (interviews, reports, notes) of varying quality
- [ ] Document hallucination rate: what percentage of citations are incorrect?
- [ ] Document the prompt template and parsing strategy for use in #125 and #127
- [ ] Evaluate: can the LLM distinguish between sources when multiple documents discuss the same topic?

### Technical Notes
- Output directly informs #125 (query endpoint) and #127 (response parsing)
- Consider JSON-mode output for reliable parsing
- Test with 5, 20, and 50+ source documents to evaluate scale behavior

### Design References
- design-spec.md, Section 9: API Specification (ResearchQueryRequest/Response types)

---

## Issue #135: SPIKE: Document parsing library evaluation for .pdf and .docx

**Replaces/Updates:** #135
**Type:** spike
**Phase:** Pre-A
**Dependencies:** None
**Effort:** S

### Story
As an engineer, I need to evaluate document parsing libraries that run on Cloudflare Workers for extracting plain text from .pdf and .docx files.

### Acceptance Criteria
- [ ] Evaluate at least 3 parsing approaches for .docx (e.g., mammoth, docx-parser, custom XML)
- [ ] Evaluate at least 3 parsing approaches for .pdf (e.g., pdf-parse, pdfjs-dist, external service)
- [ ] Test each with 5+ real-world documents of varying complexity
- [ ] Measure: extraction quality, performance on Workers, bundle size impact
- [ ] Determine if any require external services (not pure Workers runtime)
- [ ] Recommend a parsing library for each format
- [ ] Document limitations and edge cases

### Technical Notes
- Output directly informs #124 (text extraction service)
- Workers runtime constraints: no Node.js native modules, limited CPU time
- Consider WebAssembly-based parsers for Workers compatibility

### Design References
- design-spec.md, Section 8: Data Model (R2 storage patterns for content.txt)

---

## Issue #136: SPIKE: Content chunking strategy and context window management

**Replaces/Updates:** #136
**Type:** spike
**Phase:** Pre-B
**Dependencies:** None
**Effort:** S

### Story
As an engineer, I need to determine how to chunk source document content for LLM context windows, balancing search quality against token limits.

### Acceptance Criteria
- [ ] Evaluate chunking strategies: fixed-size, paragraph-based, semantic
- [ ] Test with source libraries of 5, 20, 50, and 100+ documents
- [ ] Measure retrieval quality: does the LLM find the right passages?
- [ ] Determine chunk size appropriate for Workers AI (128K context) and OpenAI (128K context)
- [ ] Handle the "too many documents for one context window" scenario (Marcus with 100+ docs)
- [ ] Document the recommended chunking strategy for use in #126
- [ ] Evaluate: do we need vector embeddings, or can we use keyword search + full-document context?

### Technical Notes
- Output directly informs #126 (chunking implementation)
- Consider hybrid approach: keyword search to narrow, then full context for selected documents
- D1 FTS5 provides keyword search; vector search would require additional infrastructure

### Design References
- design-spec.md, Section 9: API Specification (query endpoint implementation notes)

---

## Issue #137: SPIKE: Source content renderer with scroll-to-position for Research Panel

**Replaces/Updates:** #137
**Type:** spike
**Phase:** A
**Dependencies:** None
**Effort:** S

### Story
As an engineer, I need to build a proof-of-concept for the Source Detail View component that renders source content within the Research Panel's 340pt width, supports text selection, always-visible search, and scroll-to-position.

### Acceptance Criteria
- [ ] Renders HTML content in a scrollable container at 340pt width
- [ ] Supports programmatic scroll to a text position (for citation link navigation)
- [ ] Text selection works on iPad (long-press activates iOS selection handles)
- [ ] Performance acceptable for 10,000+ word documents on iPad Safari
- [ ] Always-visible search field in header (type to highlight matches, navigate between them)
- [ ] Minimum 16px text size
- [ ] Test with real source content of varying lengths (500, 2000, 5000, 10000+ words)

### Technical Notes
- Search implementation: client-side text matching with `window.find()` or custom highlight
- Scroll-to-position: use `element.scrollIntoView()` after finding text match
- Performance concern: very long documents may need virtualized rendering
- DraftCrane stack: React component, rendered within Research Panel

### Design References
- design-spec.md, Section 5: Flow 3 (always-visible search resolution)
- design-spec.md, Section 7: SourceDetailView component spec

---

## NEW-1: Research Panel infrastructure: context provider and state machine

**Replaces/Updates:** New issue
**Type:** tech-debt
**Phase:** A
**Dependencies:** None
**Effort:** M

### Story
As a developer, I need a `ResearchPanelProvider` context and `useResearchPanel` state machine hook that encapsulate all Research Panel state, replacing the current 50+ source-related props threaded through `EditorDialogsProps`.

### Acceptance Criteria
- [ ] `ResearchPanelProvider` context created at `web/src/components/research/research-panel-provider.tsx`
- [ ] `useResearchPanel` hook uses `useReducer` with typed actions
- [ ] State machine has exactly 6 valid states: Closed, Sources-List, Sources-Detail, Sources-Add, Ask, Clips
- [ ] Invalid state transitions are impossible (reducer enforces)
- [ ] All source-related props removed from `EditorDialogsProps` (~50 props)
- [ ] `EditorDialogsProps` receives at most 3 research-related props: `isResearchPanelOpen`, `onCloseResearchPanel`, `projectId`
- [ ] Cross-tab navigation state (`returnTab`) managed by provider
- [ ] `useChapterSources` hook deleted entirely
- [ ] Old source components (`SourcesPanel`, `AddSourceSheet`, `DriveBrowserSheet`, `SourceViewerSheet`) removed from `EditorDialogs` rendering

### Technical Notes

State machine reducer:
```typescript
type ResearchPanelAction =
  | { type: "OPEN_PANEL"; tab?: ResearchTab }
  | { type: "CLOSE_PANEL" }
  | { type: "SET_TAB"; tab: ResearchTab }
  | { type: "VIEW_SOURCE"; sourceId: string; returnTo?: "ask" | "clips" }
  | { type: "BACK_TO_LIST" }
  | { type: "RETURN_TO_TAB" }
  | { type: "START_ADD_FLOW" }
  | { type: "SET_DRIVE_CONNECTION"; connectionId: string }
  | { type: "FINISH_ADD" };
```

### Design References
- design-spec.md, Section 7: ResearchPanelProvider
- design-spec.md, Section 3: Information Architecture (What Gets Removed)

---

## NEW-2: Trust messaging in Source Add Flow

**Replaces/Updates:** New issue (from stress test Top 3 Change #1)
**Type:** story
**Phase:** A
**Dependencies:** #122 (Source Add Flow)
**Effort:** XS

### Story
As a user connecting my Google Drive, I want to see a clear message that DraftCrane will not modify my files, so I feel confident adding my source documents.

### Acceptance Criteria
- [ ] Text "DraftCrane reads your files to help you search and reference them. Your originals are never changed." visible in Source Add Flow
- [ ] Appears above the account list, always visible (not dismissible, not first-time-only)
- [ ] Styled as a subtle trust indicator (muted text, small icon), not an alert or warning
- [ ] Present on every visit to the add flow (builds trust through repetition)

### Technical Notes
- Simple static text element in `SourceAddFlow` component
- No backend changes
- Informed by stress test: both personas' deepest concern is "will it change my files?"

### Design References
- design-spec.md, Section 5: Flow 1 (Step 2 with trust messaging)
- design-spec.md, Section 12: Feedback Resolution #6

---

## NEW-3: First-use nudge for Research Panel discovery

**Replaces/Updates:** New issue (from stress test Top 3 Change #3)
**Type:** story
**Phase:** A
**Dependencies:** #128 (Research Panel)
**Effort:** S

### Story
As a new user, I want a subtle prompt indicating the Research panel exists so I discover it without needing external instructions.

### Acceptance Criteria
- [ ] When a project has zero sources AND the Research Panel has never been opened, show a tooltip on the Research toolbar button
- [ ] Tooltip text: "Have research files? Tap here to bring them in."
- [ ] Tooltip dismisses on tap anywhere, or after 8 seconds
- [ ] Pulsing dot indicator on Research button persists until panel is opened for first time
- [ ] Nudge state stored in `localStorage`: `research-nudge-dismissed-{projectId}`
- [ ] Appears once per project (not once per session)
- [ ] Does not appear if user has already opened the panel or has sources

### Technical Notes
- `FirstUseNudge` component positioned relative to the Research toolbar button via `targetRef`
- Uses `createPortal` to render above other content
- Pulsing dot: CSS animation, `prefers-reduced-motion` disables animation (static dot instead)

### Design References
- design-spec.md, Section 5: First-Use Experience
- design-spec.md, Section 7: FirstUseNudge component spec
- design-spec.md, Section 12: Feedback Resolution #4 and #8

---

## NEW-4: Always-visible search in Source Detail View

**Replaces/Updates:** New issue (from stress test Top 3 Change #2)
**Type:** story
**Phase:** A
**Dependencies:** #137 (preview component spike)
**Effort:** S

### Story
As a user viewing a source document, I want a search field always visible so I can quickly find specific passages regardless of document length.

### Acceptance Criteria
- [ ] Search field in Source Detail View header, always visible (no word-count threshold)
- [ ] Type to search: highlights matching text in the document content
- [ ] Navigate between matches (up/down arrows or next/previous buttons)
- [ ] Match count displayed: "3 of 12 matches"
- [ ] Search is instant (client-side text matching)
- [ ] Search field: `aria-label="Search within document"`
- [ ] Works on documents of all lengths (500 to 10,000+ words)
- [ ] Keyboard shortcut: Cmd+F focuses the search field (when Source Detail View is active)

### Technical Notes
- Client-side implementation: highlight matching text nodes in rendered HTML
- Use `mark` element or custom highlight for matches
- Previous design used 10,000-word threshold; removed per stress test feedback

### Design References
- design-spec.md, Section 5: Flow 3 (always-visible search)
- design-spec.md, Section 12: Feedback Resolution #7

---

## NEW-5: Cross-tab navigation with breadcrumb for source citations

**Replaces/Updates:** New issue (from stress test Flow 8 YELLOW)
**Type:** story
**Phase:** B
**Dependencies:** #128 (panel infrastructure), #130 (source citation navigation)
**Effort:** S

### Story
As a user who taps a source title in the Ask or Clips tab, I want to see the source document with a clear "Back to Ask" or "Back to Clips" breadcrumb so I can return to where I was without confusion.

### Acceptance Criteria
- [ ] When navigating to Source Detail View from Ask tab, back button reads "Back to Ask"
- [ ] When navigating from Clips tab, back button reads "Back to Clips"
- [ ] Tapping the breadcrumb returns to the originating tab with scroll position and state preserved
- [ ] When navigating directly within Sources tab, standard "< Sources" back button shown
- [ ] `ResearchPanelProvider` tracks `returnTab` state ("ask" | "clips" | null)
- [ ] Tab content is preserved in memory during cross-tab navigation (not unmounted)

### Technical Notes
- `SourceDetailView` receives `backLabel` prop to customize back button text
- `ResearchPanelProvider` manages `returnTab` via `VIEW_SOURCE` and `RETURN_TO_TAB` actions
- Tab components use `display: none` instead of conditional rendering to preserve state

### Design References
- design-spec.md, Section 5: Flow 8 (cross-tab breadcrumb resolution)
- design-spec.md, Section 12: Feedback Resolution #9

---

## NEW-6: Chapter tag on clips for power user organization

**Replaces/Updates:** New issue (from stress test: Marcus RED on flat clips)
**Type:** story
**Phase:** C
**Dependencies:** #131 (save clips), #132 (clips tab)
**Effort:** S

### Story
As a power user with many clips, I want to optionally tag clips to specific chapters so I can filter and organize my research by chapter.

### Acceptance Criteria
- [ ] When saving a clip, optional chapter tag dropdown appears briefly (2 second auto-dismiss)
- [ ] Dropdown shows: "All chapters" (default), then each project chapter
- [ ] If user does not interact, clip is saved without chapter tag ("All chapters")
- [ ] If user taps a chapter, clip is tagged to that chapter
- [ ] Clips tab chapter filter dropdown shows only chapters that have tagged clips (plus "All")
- [ ] `research_clips.chapter_id` column stores the tag (nullable FK to chapters)
- [ ] Deleting a chapter sets `chapter_id = NULL` on affected clips (ON DELETE SET NULL)
- [ ] Chapter tag displayed on `ClipCard` as a small label (e.g., "Ch. 4")

### Technical Notes
- `research_clips` table already has `chapter_id` column (Migration 0014)
- Chapter list comes from existing project chapters data
- Auto-dismiss dropdown: 2s timeout, cancelled if user interacts
- Simple UX for Diane (ignore it) and useful for Marcus (tap a chapter)

### Design References
- design-spec.md, Section 5: Flow 5 (chapter tag on save)
- design-spec.md, Section 5: Flow 8 (chapter filter in Clips tab)
- design-spec.md, Section 11: Decision 3
- design-spec.md, Section 12: Feedback Resolution #3

---

## NEW-7: Tiptap footnote extension for auto-citation

**Replaces/Updates:** New issue
**Type:** story
**Phase:** C
**Dependencies:** None (can start in parallel with other Phase C work)
**Effort:** L

### Story
As a developer, I need a Tiptap footnote extension that supports auto-generated footnote references when clips are inserted into the editor.

### Acceptance Criteria
- [ ] New Tiptap node type: `footnoteRef` (inline, superscript number in text)
- [ ] New Tiptap node type: `footnoteContent` (block, rendered at bottom of chapter)
- [ ] Footnotes numbered sequentially within a chapter
- [ ] Renumbering on insert/delete (if footnote 2 is deleted, footnote 3 becomes 2)
- [ ] Serialization to HTML: `<sup>[N]</sup>` for reference, `<div class="footnotes">` section at bottom
- [ ] Deserialization from HTML: correctly parses footnotes on chapter load
- [ ] Undo/redo: removing a footnoteRef also removes the footnoteContent (and vice versa)
- [ ] Footnote content format: "[N] Source Title" (simple format, not formal citation style)
- [ ] Works with Drive write-through (HTML output is valid for Google Docs import)
- [ ] No cursor positioning issues when footnote is at end of blockquote

### Technical Notes
- Follow Tiptap extension patterns from existing codebase (check `web/src/components/` for Tiptap config)
- Footnote renumbering uses ProseMirror decorations or computed node attributes
- HTML serialization must produce clean output for Drive write-through
- Consider: footnote section separated by `<hr>` at bottom of chapter content

### Design References
- design-spec.md, Section 5: Flow 6 (insert with footnote)
- design-spec.md, Section 11: Decision 9 (blockquote + footnote format)

---

## NEW-8: Remove chapter-source linking (deprecate endpoints and table)

**Replaces/Updates:** New issue
**Type:** tech-debt
**Phase:** A
**Dependencies:** None
**Effort:** S

### Story
As a developer, I need to remove the chapter-source linking feature (endpoints, hooks, UI) and deprecate the `chapter_sources` table.

### Acceptance Criteria
- [ ] Remove `GET /chapters/:chapterId/sources` endpoint
- [ ] Remove `POST /chapters/:chapterId/sources/:sourceId/link` endpoint
- [ ] Remove `DELETE /chapters/:chapterId/sources/:sourceId/link` endpoint
- [ ] Delete `useChapterSources` hook (`web/src/hooks/use-chapter-sources.ts`)
- [ ] Remove all "Link to Chapter" / "Unlink" UI from source components
- [ ] Migration 0017: document `chapter_sources` table deprecation (table preserved, no writes)
- [ ] `chapter_sources` table NOT dropped (preserved for 90-day rollback window)
- [ ] One-time notice for users who had linked sources: "Source organization has been simplified. Your sources are now available project-wide."

### Technical Notes
- Low user count in Phase 0 makes this safe
- Table preserved for data integrity; future migration drops after 90 days
- Removes 3 API routes from `workers/dc-api/src/routes/chapters.ts`

### Design References
- design-spec.md, Section 3: What Was Removed
- design-spec.md, Section 8: chapter_sources (deprecated)
- design-spec.md, Section 11: Decision 2

---

## NEW-9: Full-text search endpoint for Sources tab

**Replaces/Updates:** New issue
**Type:** story
**Phase:** A
**Dependencies:** #124 (text extraction with FTS indexing)
**Effort:** M

### Story
As a user, I want to search across my source documents by keyword in the Sources tab, finding documents that contain specific terms.

### Acceptance Criteria
- [ ] `GET /projects/:projectId/research/sources/search?q=keyword` endpoint
- [ ] Searches source titles and content using D1 FTS5
- [ ] Returns: sourceId, title, matching snippet, approximate position
- [ ] Results ordered by relevance (FTS5 rank)
- [ ] Falls back to LIKE search if FTS not available
- [ ] Returns empty array for no matches
- [ ] Query minimum 2 characters
- [ ] Frontend: Sources tab search field calls this endpoint (debounced 300ms)
- [ ] Search results replace the source list, showing matching sources with snippets

### Technical Notes
- D1 FTS5 virtual table `source_content_fts` created in Migration 0016
- FTS populated by text extraction service (#124)
- Snippet extraction: FTS5 `snippet()` function or manual extraction around match

### Design References
- design-spec.md, Section 8: source_content_fts table
- design-spec.md, Section 9: GET /research/sources/search endpoint

---

## NEW-10: Research clips CRUD API

**Replaces/Updates:** New issue
**Type:** story
**Phase:** B (save/list), C (delete)
**Dependencies:** Migration 0014 (research_clips table)
**Effort:** M

### Story
As the Research Panel frontend, I need API endpoints for creating, listing, and deleting research clips.

### Acceptance Criteria
- [ ] `POST /projects/:projectId/research/clips` -- save a clip
  - [ ] Accepts: content, sourceId, sourceTitle, sourceLocation, chapterId (all optional except content and sourceTitle)
  - [ ] Deduplication: same content + sourceId returns existing clip (200) instead of creating duplicate (201)
  - [ ] Content max 10KB (400 error for larger)
  - [ ] Returns created clip with id, timestamps
- [ ] `GET /projects/:projectId/research/clips` -- list clips
  - [ ] Optional query param: `?chapterId=xxx` for chapter filtering
  - [ ] Returns clips ordered by `created_at DESC`
  - [ ] Includes `chapterTitle` from joined chapters table
  - [ ] Clips with removed sources show `sourceId: null`, `sourceTitle` preserved
- [ ] `DELETE /research/clips/:clipId` -- delete a clip
  - [ ] Authorization: verify clip belongs to user's project
  - [ ] Returns `{ success: true }`
- [ ] All endpoints require authentication (Clerk)
- [ ] All endpoints use parameterized queries (`.bind()` for D1)

### Technical Notes
- `research_clips` table created in Migration 0014
- Dedup index: `idx_research_clips_dedup` on (project_id, source_id, content) WHERE source_id IS NOT NULL
- Routes mounted at `/research/clips` in `workers/dc-api/src/routes/research.ts` (new route file)

### Design References
- design-spec.md, Section 8: research_clips table
- design-spec.md, Section 9: Clips API endpoints

---

## Dependency Graph

```
Pre-Phase A:
  #135 (doc parsing spike)
  #137 (preview component spike)

Phase A (Foundation):
  NEW-1 (context provider) ──────────────┐
  #121 (Drive auth) ─────────────────────┤
  #128 (Research Panel) ←── NEW-1        │
  #122 (Drive browser) ←── #121, #128   │
  NEW-2 (trust messaging) ←── #122      │
  NEW-3 (first-use nudge) ←── #128      │
  #124 (text extraction) ←── #135        │
  #123 (local upload) ←── #124, #128    │
  NEW-4 (always-visible search) ←── #137 │
  NEW-8 (remove linking) ←── (none)      │
  NEW-9 (FTS endpoint) ←── #124          │
                                          │
Pre-Phase B:                              │
  #134 (prompt engineering spike)         │
  #136 (chunking strategy spike)          │
                                          │
Phase B (AI Integration):                 │
  #126 (chunking) ←── #136               │
  #127 (response parsing) ←── #134       │
  #125 (query endpoint) ←── #124, #126,  │
       #127, #134                         │
  #129 (Ask tab UI) ←── #125, #128       │
  NEW-5 (cross-tab nav) ←── #128         │
  #130 (citation links) ←── #128, #137,  │
       NEW-5                              │
  NEW-10 (clips API, save/list) ←── 0014 │
                                          │
Phase C (Board + Editor):                 │
  NEW-7 (footnote extension) ←── (none)  │
  #131 (save clips) ←── #128, NEW-6,    │
       NEW-10                             │
  #132 (clips tab) ←── #131, NEW-6,     │
       NEW-10                             │
  NEW-6 (chapter tags) ←── #131, #132   │
  #133 (insert + footnote) ←── #131,    │
       #132, NEW-7                        │
```

---

## Effort Key

| Size | Approximate Duration | Description |
|------|---------------------|-------------|
| XS | < 1 day | Trivial change, no backend |
| S | 1-3 days | Focused single-component or endpoint |
| M | 3-5 days | Multi-component or multi-endpoint |
| L | 5-10 days | Complex feature spanning frontend + backend |
| XL | 10+ days | Major system change (none in this set) |

## Phase Effort Totals

| Phase | Issue Count | Estimated Days | Calendar Weeks |
|-------|-------------|----------------|----------------|
| Pre-A Spikes | 2 | 2-4 days | Can parallel with Phase A planning |
| Phase A: Foundation | 10 issues | 10-15 days | 2-3 weeks |
| Pre-B Spikes | 2 | 2-4 days | Can parallel with Phase A dev |
| Phase B: AI Integration | 8 issues | 15-20 days | 3-4 weeks |
| Phase C: Board + Editor | 6 issues | 10-15 days | 2-3 weeks |
| **Total** | **28 issues** | **39-58 days** | **7-10 weeks** |
