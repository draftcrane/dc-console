# Library & Desk — Design Spec

## Overview

The Library panel has two tabs: **Library** and **Desk**.

- **Library** = the stacks. Browse your connected sources (Google Drive, local files), peek into documents, and tag what you need.
- **Desk** = your workspace. Tagged documents are "checked out" here. This is where you work with them — view content, run AI analysis, pull insights into your book.

## Mental Model

The metaphor is a physical library:

1. You walk into the library (browse your Drive)
2. You find books you need (scan documents)
3. You check them out (tag with the bookmark icon)
4. You bring them to your desk (they appear in the Desk tab)
5. You study them, take notes, synthesize (AI analysis)
6. When done, you return them (untag)

## Library Tab

### States

**No connections (empty):**

- Book icon
- "Add documents to reference while you write."
- "Your originals are never changed."
- Single CTA: "Add Source" → opens Source Type Picker

**Connected (default):**

- Connection header showing account email (dropdown switcher if multiple)
- Drive file browser: folders and documents
- Breadcrumb navigation for folder hierarchy
- Documents show a **bookmark icon** on the right side of each row:
  - Gray outline = not on desk
  - Filled blue = on desk
- Tap bookmark to tag/untag (no modal, no confirmation — instant with toast)
- Tap document row to peek (preview content)
- Footer: Connections section with Browse/Remove and "+ Connect a Source"

### Tagging Interaction

- Bookmark icon on every document row in browse view
- Single tap toggles tag state
- Toast confirms: "Added [name] to desk" / "Removed [name] from desk"
- Tagging = creating a SourceMaterial record (addDriveSources)
- Untagging = removing the SourceMaterial record (removeSource)
- Tagged state is derived from `sources` array matching by `driveFileId`

## Desk Tab

### States

**Empty (nothing tagged):**

- Desk icon
- "Tag documents from the Library to work with them here."
- No action button — the action is in the Library tab

**Has tagged documents:**

- Document list with checkboxes for multi-select
- "Select all" toggle at the top
- Each document row shows: checkbox, document icon, title, bookmark (untag) icon
- Below the document list: instruction area and analyze button

### Multi-Select Analysis

Users select one or more documents from their desk, write an instruction, and run analysis.
The AI receives the content of all selected documents as context.

**Use cases:**

- Analyze these docs and propose a chapter outline
- Pull all references to [topic] across these documents
- Summarize the key arguments across this research
- Suggest how these sources connect to each other

### Context Limits & Deep Analysis (Future)

When the selected documents exceed what fits in a single AI context window:

**Current behavior:**

- Allow selection of any number of documents
- For small selections (fits in context): analyze immediately with SSE streaming
- For large selections: show messaging that batch processing will be needed

**Future: Deep Analysis (map-reduce pattern):**

1. **Map phase:** Process documents in batches (e.g., 5-10 at a time). Each batch
   produces an intermediate summary/analysis against the user's instruction.
2. **Reduce phase:** Synthesize all intermediate results into one coherent output.
3. **Async execution:** Job runs in the background. User can leave and come back.
   Result is stored and waiting on their Desk.

This mirrors how humans actually do research synthesis — read a stack, take notes,
read another stack, take notes, then synthesize notes into structure.

**Product positioning:** Deep Analysis is a natural premium feature. It does real work
over real time, and the perceived value is clear.

**Technical path:**

- Async job queue (Cloudflare Queues or Durable Objects)
- Intermediate results stored in D1 or KV
- Progress tracking: "Processed 15 of 32 documents..."
- Notification when complete (in-app, optionally email)

## Vocabulary

Consistent terminology across all UI:

| Term     | Meaning                          | Usage                       |
| -------- | -------------------------------- | --------------------------- |
| Source   | A repository/provider            | Google Drive, local storage |
| Folder   | A directory within a Source      | Drive folders               |
| Document | A specific file                  | Files the user works with   |
| Library  | Browse view of connected sources | "Library" tab               |
| Desk     | Tagged documents workspace       | "Desk" tab                  |
| Tag      | Mark a document for desk use     | Bookmark icon in browse     |

Never say "research", "reference materials", "files", or "items" as synonyms for documents.

## Tab Structure

| Tab     | ID        | Component  | Purpose                                 |
| ------- | --------- | ---------- | --------------------------------------- |
| Library | `library` | LibraryTab | Browse sources, tag documents           |
| Desk    | `desk`    | DeskTab    | Work with tagged documents, AI analysis |

## Design Decisions Log

- **2026-02-24:** Renamed "Sources"/"Ask" tabs to "Library"/"Desk"
- **2026-02-24:** Library defaults to browse view when connected (no intermediate empty state)
- **2026-02-24:** Inline bookmark tagging in browse view (no modal, tap to toggle)
- **2026-02-24:** Desk tab shows tagged documents with multi-select for AI analysis
- **2026-02-24:** Deep Analysis (map-reduce) documented as future premium feature
