# Phase 3a: Detailed Interaction Design

> DraftCrane Source/Research UX Redesign
> Option B: "Research Companion" (with modifications from user feedback)
> Date: 2026-02-19

---

## Table of Contents

1. [Information Architecture](#1-information-architecture)
2. [Interaction Flows](#2-interaction-flows)
3. [Panel Layout Specifications](#3-panel-layout-specifications)
4. [Component Inventory](#4-component-inventory)
5. [State Model Changes](#5-state-model-changes)
6. [API Changes](#6-api-changes)
7. [Data Model Changes](#7-data-model-changes)
8. [Backlog Issue Mapping](#8-backlog-issue-mapping)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. Information Architecture

### Panel/Screen Inventory

The redesigned system has three primary surfaces and two secondary surfaces.

**Primary surfaces (always available):**

| Surface | Type | Purpose |
|---------|------|---------|
| **Chapter Sidebar** | Persistent left panel | Chapter navigation, word counts (unchanged) |
| **Editor** | Central content area | Tiptap rich text editor (unchanged) |
| **Research Panel** | Toggleable right panel | Three-tab container for Sources, Ask, and Clips |

**Secondary surfaces (within the Research Panel):**

| Surface | Type | Purpose |
|---------|------|---------|
| **Source Detail View** | Inline replacement within Sources tab | Full source content viewer |
| **Source Add Flow** | Inline replacement within Sources tab | Drive browser + local upload |

**Confirmation dialogs (modal):**

| Surface | Type | Purpose |
|---------|------|---------|
| **Remove Source Confirmation** | Center dialog | Confirm destructive source removal |

### Navigation Model

The Research Panel uses a **flat tab + inline drill-down** navigation model. There are exactly two levels of depth:

```
Level 0: Research Panel closed (editor takes full width)
Level 1: Research Panel open with active tab
          - Sources tab (source list with search/filter)
          - Ask tab (AI query interface)
          - Clips tab (saved snippet board)
Level 2: Sources tab only -- drill-down views
          - Source Detail View (replaces source list inline)
          - Source Add Flow (replaces source list inline)
```

Moving between Level 1 tabs is a single tap. Moving from Level 2 back to Level 1 is a single tap on the back button. No surface ever stacks on top of another. The maximum depth from the user's perspective is always 2 (panel open, then detail or add view).

```
                                          +------------------+
                                          |  Research Panel   |
                 +--- Sources tab ------> |  [Source List]    |
                 |     |                  |                   |
Toolbar -------->+     +-- Detail view -> |  [Source Content] |
[Research btn]   |     |                  |                   |
                 |     +-- Add flow ----> |  [Drive Browser]  |
                 |                        |                   |
                 +--- Ask tab ----------> |  [Query + Results]|
                 |                        |                   |
                 +--- Clips tab --------> |  [Saved Snippets] |
                                          +------------------+
```

### What Gets Removed

**Components eliminated:**

| Component | File | Reason |
|-----------|------|--------|
| `SourcesPanel` | `web/src/components/drive/sources-panel.tsx` | Replaced by `ResearchPanel` > `SourcesTab` |
| `AddSourceSheet` | `web/src/components/drive/add-source-sheet.tsx` | Merged into `SourceAddFlow` within Sources tab |
| `DriveBrowserSheet` | `web/src/components/drive/drive-browser-sheet.tsx` | Merged into `SourceAddFlow` within Sources tab |
| `SourceViewerSheet` | `web/src/components/drive/source-viewer-sheet.tsx` | Replaced by `SourceDetailView` within Sources tab |

**Concepts eliminated:**

| Concept | Reason |
|---------|--------|
| Chapter-source linking | Both personas found it confusing. Sources are project-level. Implicit references tracked when snippets are inserted into chapters. |
| Link/Unlink buttons | Eliminated with chapter-source linking. |
| Source viewer tab bar (chapter-scoped) | Eliminated. Navigation between sources is via the Sources tab list, not chapter-specific tabs. |
| Sheet stacking (z-50/z-60 layering) | Eliminated. All source interactions occur within the Research Panel's single surface area. |
| `chapter_sources` junction table (as active feature) | Table deprecated; no new writes. Data preserved for potential rollback. |
| "Sources" as standalone toolbar action | Replaced by "Research" panel toggle that contains Sources as a tab. |

**Props eliminated from EditorDialogs (~50 source-related props):**

All source-specific props are removed from `EditorDialogsProps`. The Research Panel is a self-contained component that manages its own state via a context provider. EditorDialogs receives at most 3 props related to research: `isResearchPanelOpen`, `onCloseResearchPanel`, and `projectId`.

### What Gets Added

**Components added:**

| Component | Type | Purpose |
|-----------|------|---------|
| `ResearchPanel` | Container | Tab navigation shell (Sources, Ask, Clips) with panel open/close |
| `SourcesTab` | Tab content | Source list with search, filter, and inline add/detail |
| `AskTab` | Tab content | AI natural-language query interface |
| `ClipsTab` | Tab content | Saved snippet board with insert actions |
| `SourceCard` | List item | Individual source row in the source list |
| `SourceAddFlow` | Inline view | Drive browser + local upload, replacing source list inline |
| `SourceDetailView` | Inline view | Full source content viewer, replacing source list inline |
| `QueryInput` | Input | Search/ask text field with submit and loading states |
| `ResultCard` | List item | AI search result with source citation, save, and insert actions |
| `ClipCard` | List item | Saved snippet with insert and delete actions |
| `SnippetInsertButton` | Action button | Insert clip text + auto-footnote into editor at cursor |
| `ResearchPanelProvider` | Context provider | Encapsulates all research panel state, eliminating prop threading |

**Concepts added:**

| Concept | Description |
|---------|-------------|
| Research Panel | A unified right-hand panel containing all research functionality across three tabs |
| Clips | Saved text snippets with source attribution, collected from AI results or manual selection |
| AI query against sources | Natural-language search across all project sources with cited results |
| Auto-footnote insertion | Inserting a clip creates a footnote referencing the source document |
| Source text search | Full-text search within the Sources tab (searches source titles and cached content) |
| Remove confirmation dialog | Destructive source removal now requires explicit confirmation |

---

## 2. Interaction Flows

### Flow 1: Add Source from Google Drive

**Precondition:** User has at least one Google account connected. Research Panel is open with Sources tab active.

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap [+ Add] button in Sources tab header | Sources tab | 1 |
| 2 | Source Add Flow replaces the source list inline. Shows connected accounts with "Browse Drive" and "Upload from device" options. | Source Add Flow | 0 (transition) |
| 3 | Tap a connected Google account row | Source Add Flow (account list) | 1 |
| 4 | Inline Drive browser appears (replaces account list within same view). Shows root of user's Drive. | Source Add Flow (Drive browser) | 0 (transition) |
| 5 | Navigate into target folder | Source Add Flow (Drive browser) | 1-3 per folder level |
| 6 | Tap checkbox on each Google Doc to select | Source Add Flow (Drive browser) | 1 per file |
| 7 | Tap "Add Selected" footer button | Source Add Flow (Drive browser) | 1 |
| 8 | Sources are added. View transitions back to source list showing new sources with "Processing..." status. | Sources tab | 0 (transition) |

**Total: 4-8 taps across a single surface (Sources tab with inline flow).**

**Key moments:**

```
STEP 1: Sources tab with [+ Add] button
+-----------------------------------+
|  RESEARCH                         |
|  [Sources]  Ask  Clips     [x]   |
|  ================================ |
|  [Search sources...]   [+ Add]   |
|  -------------------------------- |
|  Interview-Smith.doc              |
|    1,240 words  |  Cached 2h ago |
|  Q4-Report.doc                    |
|    3,800 words  |  Cached 1d ago |
|                                   |
|  2 sources                        |
+-----------------------------------+

STEP 2-3: Source Add Flow (account selection)
+-----------------------------------+
|  RESEARCH                         |
|  [< Sources]  Add Source          |
|  ================================ |
|                                   |
|  FROM GOOGLE DRIVE                |
|  +-------------------------------+|
|  | scott@email.com               ||
|  | Browse Google Drive       [>] ||
|  +-------------------------------+|
|  +-------------------------------+|
|  | work@company.com              ||
|  | Browse Google Drive       [>] ||
|  +-------------------------------+|
|                                   |
|  FROM DEVICE                      |
|  +-------------------------------+|
|  | Upload file (.txt .md .docx   ||
|  |   .pdf)                   [>] ||
|  +-------------------------------+|
|                                   |
|  Connect another Google account   |
+-----------------------------------+

STEP 4-7: Drive browser (inline)
+-----------------------------------+
|  RESEARCH                         |
|  [< Back]  scott@email.com       |
|  ================================ |
|  [Search files...]               |
|  -------------------------------- |
|  [folder] Research/               |
|  [folder] Interviews/             |
|  [folder] External Data/          |
|  -------------------------------- |
|  [ ] Workshop Notes March 2024    |
|  [x] Interview-Smith.doc          |
|  [x] Client-Notes.doc             |
|  [ ] Draft-Chapter3-v2.doc        |
|                                   |
|  [  Add 2 Selected  ]            |
+-----------------------------------+
```

**Error states:**
- **No Google accounts connected:** Source Add Flow shows only "Upload from device" and a prominent "Connect Google Account" button. Tapping it initiates the OAuth flow.
- **Drive API error:** An inline error banner appears within the Drive browser: "Could not access Google Drive. Please try again." with a "Retry" button. The user can tap [< Back] to return to account selection.
- **File already added:** The Drive browser shows files already in the project with a checkmark badge and disables their checkbox. Tooltip: "Already in your sources."
- **Network failure during add:** The source list shows the new sources with status "Error -- could not process." The user can tap "Retry" on the source card or "Remove" to discard.

**iPad-specific considerations:**
- All touch targets in the Drive browser are minimum 44pt height.
- Checkboxes use a 44x44pt tap area (visually 24x24px icon centered in the tap area).
- Folder rows are full-width tap targets (entire row navigates).
- The [< Back] button uses a 44x44pt tap area.
- The "Add Selected" footer button is 48pt height, full width, sticky at bottom.
- In portrait mode, the Research Panel is an overlay (see Section 3), so the Drive browser fills the overlay width.

---

### Flow 2: Add Source from Local Device

**Precondition:** Research Panel is open with Sources tab active.

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap [+ Add] button in Sources tab header | Sources tab | 1 |
| 2 | Source Add Flow appears. | Source Add Flow | 0 |
| 3 | Tap "Upload file" row | Source Add Flow | 1 |
| 4 | iOS/iPadOS file picker opens (system UI) | System file picker | 0 |
| 5 | Navigate to and select file(s) | System file picker | 2-4 |
| 6 | File picker closes. Upload begins. Source Add Flow transitions back to Sources tab showing new source with "Processing..." spinner. | Sources tab | 0 |

**Total: 4-7 taps across 2 surfaces (Sources tab + system file picker).**

**Key moment:**

```
STEP 3: Upload option
+-----------------------------------+
|  RESEARCH                         |
|  [< Sources]  Add Source          |
|  ================================ |
|                                   |
|  FROM DEVICE                      |
|  +-------------------------------+|
|  | Upload file                   ||
|  | .txt  .md  .docx  .pdf   [>] ||
|  +-------------------------------+|
|                                   |
|  FROM GOOGLE DRIVE                |
|  +-------------------------------+|
|  | scott@email.com           [>] ||
|  +-------------------------------+|
|                                   |
+-----------------------------------+

STEP 6: Processing state
+-----------------------------------+
|  RESEARCH                         |
|  [Sources]  Ask  Clips     [x]   |
|  ================================ |
|  [Search sources...]   [+ Add]   |
|  -------------------------------- |
|  Workshop-Transcript.pdf          |
|    [spinner] Processing...        |
|  Interview-Smith.doc              |
|    1,240 words  |  Cached 2h ago |
|  Q4-Report.doc                    |
|    3,800 words  |  Cached 1d ago |
|                                   |
|  3 sources                        |
+-----------------------------------+
```

**Error states:**
- **Unsupported file type:** The system file picker is configured to accept only `.txt`, `.md`, `.docx`, and `.pdf`. If the user somehow selects an unsupported file, the API returns an error and the source card shows "Unsupported file format" with a "Remove" action.
- **File too large:** API returns 413. Source card shows "File too large (max 5MB)" with "Remove" action.
- **Upload fails (network):** Source card shows "Upload failed" with "Retry" and "Remove" actions.
- **Text extraction fails:** Source card shows "Could not extract text" with status "error." User can remove and re-upload.

**iPad-specific considerations:**
- The system file picker is a native iPadOS component. It handles its own touch targets and accessibility.
- The "Upload file" row is 56pt minimum height with full-width tap target.
- Accepted file types are passed to the `accept` attribute of the hidden file input: `.txt,.md,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

---

### Flow 3: View a Source While Writing

**Precondition:** Research Panel is open with Sources tab active. At least one source exists.

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap a source card in the source list | Sources tab | 1 |
| 2 | Source Detail View replaces the source list inline. Content loads with a progress indicator. | Source Detail View | 0 (transition) |
| 3 | User reads source content. In landscape, the editor remains visible to the left. | Source Detail View + Editor | 0 (reading) |
| 4 | User taps [< Sources] back button to return to the list | Source Detail View header | 1 |

**Total: 2 taps (1 to open, 1 to return). 1 tap if user stays in the viewer.**

**Key moments:**

```
STEP 1: Tap a source card
+--------+---------------------------+-------------------+
| Sidebar| Editor                    |  RESEARCH         |
|        |                           |  [Sources] Ask Clips
|        | Chapter 4: Case Studies   |  ================ |
|        |                           |  [Search]  [+ Add]|
|        | Lorem ipsum dolor sit     |  ---------------  |
|        | amet, consectetur...      | >Interview-S.doc< |
|        |                           |    1,240w  Cached |
|        |                           |  Q4-Report.doc    |
|        |                           |    3,800w  Cached |
+--------+---------------------------+-------------------+

STEP 2: Source Detail View (inline replace)
+--------+---------------------------+-------------------+
| Sidebar| Editor                    |  RESEARCH         |
|        |                           |  [< Sources]      |
|        | Chapter 4: Case Studies   |  Interview-S.doc  |
|        |                           |  1,240w | 2h ago  |
|        | Lorem ipsum dolor sit     |  ================ |
|        | amet, consectetur...      |                   |
|        |                           |  The key insight   |
|        | adipiscing elit. Sed do   |  from our conver-  |
|        | eiusmod tempor incididunt |  sation was that   |
|        | ut labore et dolore magna |  leadership in     |
|        | aliqua.                   |  distributed teams |
|        |                           |  requires funda-   |
|        |                           |  mentally differ-  |
|        |                           |  ent approaches... |
|        |                           |                    |
|        |                           |  [Import as Ch.]   |
+--------+---------------------------+-------------------+
```

**Error states:**
- **Content not yet cached:** A loading spinner shows while content is fetched from Google Drive and cached. If the Drive API fails, an error message appears: "Could not load content. The source may have been deleted from Google Drive." with "Retry" and "Back" actions.
- **Source archived (account disconnected):** The source card shows "Account disconnected" in the list. Tapping it opens the detail view with a message: "This source's Google account has been disconnected. Reconnect to view content." with a "Reconnect" link.
- **Content very long:** The detail view is a scrollable container. For sources exceeding 10,000 words, a "Search within document" field appears at the top of the content area.

**iPad-specific considerations:**
- In landscape mode (1024pt+), the editor remains visible alongside the Research Panel. The user can see their writing while reading a source -- this is the core improvement over the current full-overlay SourceViewerSheet.
- In portrait mode, the Research Panel is an overlay. The user cannot see the editor while viewing a source. The [< Sources] back button is the primary navigation to return to the source list, and closing the panel returns to the editor.
- The source content area supports text selection via long-press. Selected text shows a contextual action: "Save to Clips" (in addition to the system Copy action). This uses the native `Selection` API with a custom floating toolbar.
- Scroll position within the source content is preserved when switching tabs (Sources to Ask to Clips and back). It is lost when navigating back to the source list.

---

### Flow 4: Search Sources with Natural Language Query

**Precondition:** Research Panel is open. At least one source exists with cached content.

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap the "Ask" tab | Research Panel tab bar | 1 |
| 2 | Ask tab shows the query input at the bottom and any previous conversation above | Ask tab | 0 |
| 3 | Tap the query input field. Keyboard appears. | Ask tab | 1 |
| 4 | Type a natural-language question. E.g., "What did my workshop notes say about psychological safety?" | Ask tab | 0 (typing) |
| 5 | Tap the Send button (or press Return on external keyboard) | Ask tab | 1 |
| 6 | Loading indicator appears. The query scrolls up and a streaming response begins appearing below it. | Ask tab | 0 (waiting) |
| 7 | AI response completes. Result cards appear with cited passages and source references. | Ask tab | 0 |

**Total: 3 taps + typing.**

**Key moments:**

```
STEP 2: Ask tab (empty state -- first visit)
+-----------------------------------+
|  RESEARCH                         |
|  Sources  [Ask]  Clips     [x]   |
|  ================================ |
|                                   |
|  Ask about your sources           |
|                                   |
|  Try asking:                      |
|  "What data do I have on..."      |
|  "Summarize my notes about..."    |
|  "Find quotes about..."           |
|                                   |
|                                   |
|                                   |
|                                   |
|  ================================ |
|  [Ask about your sources...] [->] |
+-----------------------------------+

STEP 6-7: AI response with results
+-----------------------------------+
|  RESEARCH                         |
|  Sources  [Ask]  Clips     [x]   |
|  ================================ |
|                                   |
|  You: What did my workshop notes  |
|  say about psychological safety?  |
|                                   |
|  -------------------------------- |
|  AI: I found 2 relevant passages: |
|                                   |
|  +-------------------------------+|
|  | "Psychological safety was the ||
|  | strongest predictor of team   ||
|  | performance, with 67% of     ||
|  | teams reporting measurable    ||
|  | improvement."                 ||
|  |                               ||
|  | Workshop Notes March 2024     ||
|  | [Save to Clips] [Insert]     ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | "Teams with high psychologi-  ||
|  | cal safety scores showed 2.3x ||
|  | faster decision-making..."    ||
|  |                               ||
|  | Q4-Report.doc                 ||
|  | [Save to Clips] [Insert]     ||
|  +-------------------------------+|
|                                   |
|  ================================ |
|  [Ask a follow-up...]       [->] |
+-----------------------------------+
```

**Error states:**
- **No sources in project:** The Ask tab shows an empty state: "Add source documents first. The Ask tab searches across your source materials." with a "Go to Sources" link that switches to the Sources tab.
- **No cached content:** "Your sources haven't been processed yet. Content is being extracted -- try again in a moment." (This occurs when sources are added but text extraction hasn't completed.)
- **AI query fails (API error):** The response area shows: "Something went wrong. Please try again." with a "Retry" button that resubmits the same query.
- **AI returns no results:** "I couldn't find relevant information about that in your sources. Try rephrasing your question or check that the relevant source documents have been added."
- **AI response is slow (>5s):** A skeleton loader with pulsing lines appears below the query. A subtle "Searching across N sources..." message provides feedback.
- **Streaming interrupted:** Partial response displays with a "Response was interrupted. Tap to retry." message appended.

**iPad-specific considerations:**
- The query input is positioned at the bottom of the Ask tab, above the keyboard when active. This follows the iMessage/chat pattern familiar to all iPad users.
- When the software keyboard appears, the conversation area scrolls up to keep the latest content visible. Uses `visualViewport` API to detect keyboard height.
- The Send button is 44x44pt minimum. It is disabled (grayed) when the input is empty.
- Suggested queries in the empty state are tappable full-width rows (44pt height each). Tapping one populates the input and auto-submits.
- External keyboard shortcut: Cmd+Return submits the query (matching the convention in chat apps).
- Result cards have 44pt minimum touch targets on all action buttons.

---

### Flow 5: Save a Snippet from Search Results

**Precondition:** User has received AI search results in the Ask tab.

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap "Save to Clips" on a result card | Ask tab (result card action) | 1 |
| 2 | Button changes to a checkmark with "Saved" label. The Clips tab badge increments. | Ask tab | 0 (feedback) |

**Total: 1 tap.**

**Alternative flow -- save from Source Detail View:**

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Long-press on text in the source content to select | Source Detail View | 1 (long-press) |
| 2 | Adjust selection handles if needed | Source Detail View | 0-2 (drag) |
| 3 | Floating toolbar appears with "Save to Clips" action | Source Detail View | 0 |
| 4 | Tap "Save to Clips" | Floating toolbar | 1 |
| 5 | Toast notification: "Saved to Clips" with brief animation. Clips tab badge increments. | Source Detail View | 0 |

**Total: 2-3 taps/gestures.**

**Key moments:**

```
STEP 1-2: Save from AI result
+-----------------------------------+
|  +-------------------------------+|
|  | "Psychological safety was the ||
|  | strongest predictor of team   ||
|  | performance, with 67% of     ||
|  | teams reporting measurable    ||
|  | improvement."                 ||
|  |                               ||
|  | Workshop Notes March 2024     ||
|  | [check] Saved    [Insert]    ||
|  +-------------------------------+|
|                                   |
|  Sources  Ask  [Clips (3)]  [x]  |
|  ================================ |
```

**Error states:**
- **Clip already saved:** If the same passage (matched by content + source) is already saved, the button shows "Already saved" and does nothing on tap. No error -- just a no-op with feedback.
- **Clips API fails:** Toast notification: "Could not save clip. Please try again." The button reverts to "Save to Clips."
- **Offline:** "You appear to be offline. Clip will be saved when you reconnect." (Uses optimistic local save with sync on reconnect.)

**iPad-specific considerations:**
- Long-press text selection on iPad requires careful handling. The floating toolbar must appear above the selection, not behind the Research Panel header. Position is calculated relative to the selection rect and the panel's scroll offset.
- The floating toolbar uses `position: fixed` with dynamic top/left based on `getSelection().getRangeAt(0).getBoundingClientRect()`.
- "Save to Clips" in the floating toolbar has a 44pt minimum height.
- Haptic feedback (if available) on successful save: `navigator.vibrate?.(10)` or UIKit haptic via WKWebView bridge (not available in Safari -- skip gracefully).

---

### Flow 6: Insert a Snippet into the Editor

**Precondition:** User has at least one saved clip. Editor has an active chapter with cursor positioned.

**Path A: Insert from Clips tab**

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap "Clips" tab | Research Panel tab bar | 1 |
| 2 | Tap "Insert" button on a clip card | Clips tab | 1 |
| 3 | Clip text is inserted at the current cursor position in the editor. A footnote is automatically created referencing the source document. Brief success toast: "Inserted with footnote." | Editor + Clips tab | 0 |

**Total: 2 taps.**

**Path B: Insert directly from AI result**

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap "Insert" button on a result card in the Ask tab | Ask tab | 1 |
| 2 | Text is inserted at cursor with auto-footnote. Brief success toast. | Editor + Ask tab | 0 |

**Total: 1 tap.**

**Key moments:**

```
BEFORE INSERT: Editor with cursor at position
+--------+---------------------------+-------------------+
| Sidebar| Editor                    |  RESEARCH         |
|        |                           |  Sources Ask [Clips]
|        | Chapter 4: Case Studies   |  ================ |
|        |                           |  3 clips saved    |
|        | Teams that invest in      |                   |
|        | coaching see measurable   |  "Psychological   |
|        | returns. |                |  safety was the   |
|        |                           |  strongest..."    |
|        |                           |  -- Workshop Notes|
|        |                           |  [Insert] [Delete]|
+--------+---------------------------+-------------------+

AFTER INSERT: Text + footnote added at cursor
+--------+---------------------------+-------------------+
| Sidebar| Editor                    |  RESEARCH         |
|        |                           |  Sources Ask [Clips]
|        | Chapter 4: Case Studies   |  ================ |
|        |                           |  3 clips saved    |
|        | Teams that invest in      |                   |
|        | coaching see measurable   |  "Psychological   |
|        | returns. "Psychological   |  safety was the   |
|        | safety was the strongest  |  strongest..."    |
|        | predictor of team per-    |  -- Workshop Notes|
|        | formance, with 67% of    |  [Inserted] [Del] |
|        | teams reporting meas-     |                   |
|        | urable improvement." [1]  |                   |
|        |                           |                   |
|        | ---                       |                   |
|        | [1] Workshop Notes March  |                   |
|        |     2024                  |                   |
+--------+---------------------------+-------------------+
```

**Error states:**
- **No cursor position in editor:** If the editor does not have focus or a cursor position, the insert action focuses the editor and appends the text at the end of the current chapter content. Toast: "Inserted at end of chapter."
- **Editor is read-only or loading:** The Insert button is disabled (grayed) with a tooltip: "Editor is loading..."
- **Footnote extension not loaded:** If the Tiptap footnote extension fails to load, the text is still inserted but without a footnote. Toast: "Inserted without footnote -- footnotes are not available." This is a graceful degradation.
- **Chapter not selected:** Insert button disabled. Tooltip: "Select a chapter to insert into."

**iPad-specific considerations:**
- Inserting text requires the editor to regain focus. On iPad, focusing a contenteditable element may trigger the software keyboard. The insert action should store the cursor position before the Research Panel received focus, and restore it during insertion.
- The cursor position is tracked by the editor (Tiptap's selection state) and persisted even when the user interacts with the Research Panel. This requires `editor.commands.focus()` before `editor.commands.insertContent()`.
- The inserted text is wrapped in a blockquote node (styled distinctly) with the footnote reference as a superscript link. The footnote content appears at the bottom of the chapter in a dedicated footnotes section.
- External keyboard: Cmd+Shift+V could be bound to "insert last saved clip" for power users (Phase C enhancement, not initial scope).

---

### Flow 7: Remove a Source

**Precondition:** Research Panel is open with Sources tab active. At least one source exists.

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Swipe left on a source card to reveal actions (or tap the overflow menu "..." on the card) | Sources tab | 1 |
| 2 | Tap "Remove" action (red text) | Source card action area | 1 |
| 3 | Confirmation dialog appears: "Remove [Source Title]? This removes the source from your project. The original file in Google Drive is not affected." with "Cancel" and "Remove" buttons. | Center dialog | 0 |
| 4 | Tap "Remove" in the confirmation dialog | Center dialog | 1 |
| 5 | Source is removed from the list with a fade-out animation. Any clips referencing this source retain their text but the source reference shows "[Source removed]". | Sources tab | 0 |

**Total: 3 taps (including confirmation).**

**Key moments:**

```
STEP 1: Swipe-left on source card
+-----------------------------------+
|  Interview-Smith.doc              |
|    1,240w  |  Cached 2h ago       |
|            +-------+------+------+|
|            | View  |Import|Remove||
|            +-------+------+------+|

STEP 3: Confirmation dialog
+-----------------------------------+
|                                   |
|  +-------------------------------+|
|  |  Remove "Interview-Smith.doc"?||
|  |                               ||
|  |  This removes the source from ||
|  |  your project. The original   ||
|  |  file in Google Drive is not  ||
|  |  affected.                    ||
|  |                               ||
|  |  Related clips will keep      ||
|  |  their text but lose the      ||
|  |  source link.                 ||
|  |                               ||
|  |      [Cancel]    [Remove]     ||
|  +-------------------------------+|
|                                   |
+-----------------------------------+
```

**Error states:**
- **Remove API fails:** Dialog closes. Toast: "Could not remove source. Please try again." Source remains in the list.
- **Source has clips:** Confirmation dialog includes the additional note: "N clips reference this source. They will keep their text but lose the source link." Removal proceeds if confirmed.

**iPad-specific considerations:**
- Swipe-left to reveal actions follows the standard iOS pattern (UITableView swipe actions). This is implemented with touch event handlers that track horizontal delta.
- Alternative access: a visible "..." overflow button on each source card (44x44pt tap area) that reveals the same actions in a dropdown. This ensures the actions are discoverable without requiring knowledge of swipe gestures.
- The confirmation dialog is a centered modal with a dimmed backdrop. Dialog buttons are minimum 44pt height with 16pt horizontal spacing. The "Remove" button is red; "Cancel" is default gray.
- The dialog respects `prefers-reduced-motion` by omitting the fade/scale entrance animation.

---

### Flow 8: Browse Collected Snippets on Research Board

**Precondition:** Research Panel is open. User has saved at least one clip.

| Step | Action | Surface | Taps |
|------|--------|---------|------|
| 1 | Tap "Clips" tab. Badge shows count. | Research Panel tab bar | 1 |
| 2 | Clips tab displays all saved clips, ordered by most recently saved. Each card shows the snippet text, source title, and action buttons. | Clips tab | 0 |
| 3 | User scrolls through clips to review. | Clips tab | 0 (scroll) |
| 4 | (Optional) User taps the source title link on a clip to view the full source | Clip card source link | 1 |
| 5 | Sources tab opens with the Source Detail View for that source, scrolled to the approximate location of the clip | Source Detail View | 0 (transition) |

**Total: 1 tap to view clips. 2 taps to navigate to a clip's source.**

**Key moments:**

```
STEP 2: Clips tab with saved snippets
+-----------------------------------+
|  RESEARCH                         |
|  Sources  Ask  [Clips (5)]  [x]  |
|  ================================ |
|  [Search clips...]               |
|                                   |
|  +-------------------------------+|
|  | "Psychological safety was the ||
|  | strongest predictor of team   ||
|  | performance, with 67% of     ||
|  | teams reporting measurable    ||
|  | improvement."                 ||
|  |                               ||
|  | Workshop Notes March 2024     ||
|  | Saved 2h ago                  ||
|  | [Insert]           [Delete]   ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | "Q4 results showed a 23%     ||
|  | increase in leadership        ||
|  | effectiveness scores across   ||
|  | all measured dimensions."     ||
|  |                               ||
|  | Q4-Report.doc                 ||
|  | Saved 1d ago                  ||
|  | [Insert]           [Delete]   ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | "The framework suggests three ||
|  | phases: awareness, practice,  ||
|  | and integration."             ||
|  |                               ||
|  | Client-Notes.doc              ||
|  | Saved 3d ago                  ||
|  | [Insert]           [Delete]   ||
|  +-------------------------------+|
|                                   |
|  5 clips saved                    |
+-----------------------------------+
```

**Error states:**
- **No clips saved:** Empty state: "No clips yet. Save passages from AI results or select text in source documents to build your research board." with an illustrative icon.
- **Source was removed:** Clip card shows source as "[Source removed]" in gray. The clip text remains. The source link is not tappable.
- **Clip content very long:** Clip text is truncated at 300 characters with "..." and a "Show more" toggle that expands the card inline.

**iPad-specific considerations:**
- Clip cards have generous padding (16pt) for comfortable reading and tapping.
- The search field at the top of the Clips tab searches clip text and source titles. It filters the list in real-time.
- Delete action on clips shows a brief confirmation (swipe-to-delete with "Delete" button, same pattern as Flow 7's swipe). No modal confirmation for clip deletion -- clips are lightweight and recoverable by re-saving from the Ask tab.
- Insert and Delete buttons are minimum 44pt height.
- Clip cards do not use drag-and-drop for insertion (drag-and-drop is unreliable on iPad Safari). The Insert button is the sole insertion mechanism. Drag-and-drop is reserved as a Phase C+ enhancement when iPad support improves.

---

## 3. Panel Layout Specifications

### Landscape iPad (1024pt+ wide)

```
+--------+------------------------------------------+------------------+
| Sidebar| Editor                                   | Research Panel   |
| 260pt  | flex (min 400pt)                         | 340pt            |
+--------+------------------------------------------+------------------+
```

| Element | Width | Constraints |
|---------|-------|-------------|
| Chapter Sidebar | 260pt fixed | Collapsible to 0pt via toggle. When collapsed, editor expands. |
| Editor | Flex (remaining space) | **Minimum 400pt.** If Research Panel would push editor below 400pt, the panel cannot open as side-by-side -- it opens as overlay instead. |
| Research Panel | 340pt fixed | Opens from right. Pushes editor left (does not overlay). |

**Panel open/close behavior:**
- Opening: Research Panel slides in from the right edge over 200ms (`ease-out`). The editor width shrinks by 340pt. The editor content reflows (Tiptap re-wraps text).
- Closing: Research Panel slides out to the right over 150ms (`ease-in`). Editor expands back to full width.
- `prefers-reduced-motion`: Panel appears/disappears instantly (no slide animation). Width change is still animated at 0ms (effectively instant).

**Width calculation for common devices:**

| Device | Orientation | Viewport | Sidebar | Editor | Research | Viable? |
|--------|-------------|----------|---------|--------|----------|---------|
| iPad Air 11" | Landscape | 1180pt | 260pt | 580pt | 340pt | Yes (580 > 400) |
| iPad Air 11" | Portrait | 820pt | 260pt | 220pt | 340pt | **No** -- overlay mode |
| iPad Pro 13" | Landscape | 1366pt | 260pt | 766pt | 340pt | Yes |
| iPad Pro 13" | Portrait | 1024pt | 260pt | 424pt | 340pt | Yes (424 > 400) |
| iPad Mini 6 | Landscape | 1133pt | 260pt | 533pt | 340pt | Yes |
| iPad Mini 6 | Portrait | 744pt | 260pt | 144pt | 340pt | **No** -- overlay mode |

**Sidebar collapse interaction:**
When the Research Panel is open and the sidebar is also visible, if the editor width falls below 400pt, the sidebar auto-collapses. When the Research Panel closes, the sidebar returns to its previous state.

### Portrait iPad (768pt-1023pt wide)

```
+--------+------------------------------------------+
| Sidebar| Editor                                   |
| 260pt  | flex                                     |
+--------+----------+-----------+-------------------+
                     |           |
                     | Research  |  <- Overlay panel
                     | Panel     |     from right
                     | 85% width |
                     |           |
                     +-----------+
```

| Element | Width | Behavior |
|---------|-------|----------|
| Research Panel | 85% of viewport | Slides in from right as an overlay. Editor is dimmed behind but remains in DOM (no unmount). |
| Backdrop | 15% visible on left | Tapping the backdrop strip closes the panel. Provides a visual "peek" at the editor. |

**Panel open/close behavior:**
- Opening: Panel slides in from right edge over 200ms. A semi-transparent backdrop (`bg-black/30`) fades in over the editor/sidebar.
- Closing: Panel slides out, backdrop fades out.
- Swipe-right on the panel: Dismisses the panel (tracks horizontal touch delta > 60pt). This mimics the iOS sheet dismissal gesture.
- `prefers-reduced-motion`: Instant appear/disappear, no slide.

**Portrait mode does NOT support side-by-side viewing.** The Research Panel is explicitly an overlay. This is a deliberate constraint to maintain readable editor width (< 400pt side-by-side on most portrait iPads).

### Desktop (1200pt+ wide)

```
+--------+--------------------------------------------------+------------------+
| Sidebar| Editor                                            | Research Panel   |
| 260pt  | flex (typically 600-900pt)                        | 340pt            |
+--------+--------------------------------------------------+------------------+
```

Identical behavior to landscape iPad, but with more editor space. No additional desktop-specific patterns.

| Element | Width | Constraints |
|---------|-------|-------------|
| Chapter Sidebar | 260pt fixed | Same as iPad |
| Editor | Flex | Minimum 400pt, typically 600-900pt on desktop |
| Research Panel | 340pt fixed | Same as iPad |

**Resizable panel (desktop only, future enhancement):** On desktop with pointer devices, a drag handle on the left edge of the Research Panel allows resizing between 300pt (min) and 480pt (max). This is a Phase C+ enhancement and is NOT part of the initial implementation. The handle is hidden on touch devices.

### Safe Area Handling

All panel positioning uses `env(safe-area-inset-*)`:

```css
.research-panel {
  padding-right: env(safe-area-inset-right, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.research-panel-overlay {
  /* Full height minus safe areas */
  height: 100dvh;
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

The panel uses `100dvh` (dynamic viewport height), NOT `100vh`, to account for Safari's collapsible address bar.

---

## 4. Component Inventory

### ResearchPanel

- **Name:** `ResearchPanel`
- **Type:** New
- **Location:** `web/src/components/research/research-panel.tsx`
- **Purpose:** Top-level container for the Research Panel. Manages tab navigation and panel open/close.

```typescript
interface ResearchPanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Callback when a clip is inserted -- editor integration */
  onInsertSnippet: (text: string, sourceTitle: string, sourceId: string | null) => void;
  /** Whether the editor has focus/cursor for insertion */
  canInsert: boolean;
}
```

**States:**
- Closed (not rendered / hidden)
- Open with Sources tab active
- Open with Ask tab active
- Open with Clips tab active

**Accessibility:**
- `role="complementary"` with `aria-label="Research panel"`
- Tab bar uses `role="tablist"` with `role="tab"` on each tab and `aria-selected`
- Tab panels use `role="tabpanel"` with `aria-labelledby` pointing to the tab
- Escape key closes the panel
- Focus trap when in overlay mode (portrait)

---

### SourcesTab

- **Name:** `SourcesTab`
- **Type:** New
- **Location:** `web/src/components/research/sources-tab.tsx`
- **Purpose:** Source list with search, filter, and inline drill-down to detail/add views.

```typescript
interface SourcesTabProps {
  projectId: string;
  /** Navigate to source detail view */
  onViewSource: (sourceId: string) => void;
}
```

**States:**
- List view (default): Shows all sources with search field
- Detail view: Shows full content of a single source (inline replacement)
- Add view: Shows Drive browser / upload options (inline replacement)
- Loading: Initial source list loading
- Empty: No sources added yet
- Error: Failed to load sources

**Accessibility:**
- Source list uses `role="list"` with `role="listitem"` on each card
- Search field has `aria-label="Search sources"` and announces result count changes via `aria-live="polite"`
- In-list search filters update immediately (no submit required)

---

### AskTab

- **Name:** `AskTab`
- **Type:** New
- **Location:** `web/src/components/research/ask-tab.tsx`
- **Purpose:** AI natural-language query interface with streaming results.

```typescript
interface AskTabProps {
  projectId: string;
  onSaveClip: (clip: { content: string; sourceId: string | null; sourceTitle: string; sourceLocation: string | null }) => Promise<void>;
  onInsertSnippet: (text: string, sourceTitle: string, sourceId: string | null) => void;
  canInsert: boolean;
}
```

**States:**
- Empty (first visit): Shows suggested queries
- Input focused: Keyboard open, ready to type
- Loading: Query submitted, waiting for AI response (streaming)
- Results: AI response with result cards
- Conversation: Multiple query/response pairs (scrollable history)
- Error: Query failed
- No sources: Sources required but none exist

**Accessibility:**
- Query input has `aria-label="Ask about your sources"`
- Submit button has `aria-label="Submit query"`
- AI responses are announced via `aria-live="polite"` region
- Result cards are focusable with action buttons reachable via Tab key
- Loading state has `aria-busy="true"` on the results container

---

### ClipsTab

- **Name:** `ClipsTab`
- **Type:** New
- **Location:** `web/src/components/research/clips-tab.tsx`
- **Purpose:** Saved snippet board with search, insert, and delete actions.

```typescript
interface ClipsTabProps {
  projectId: string;
  onInsertSnippet: (text: string, sourceTitle: string, sourceId: string | null) => void;
  canInsert: boolean;
}
```

**States:**
- Empty: No clips saved
- List: Clips displayed, most recent first
- Searching: Filter active on clip text or source title

**Accessibility:**
- Clips list uses `role="list"` with `role="listitem"` on each card
- Search field has `aria-label="Search clips"`
- Delete action requires confirmation (swipe or button, announced to screen readers)
- Insert button has `aria-label="Insert into chapter with footnote"`

---

### SourceCard

- **Name:** `SourceCard`
- **Type:** New (replaces `SourceRow` in current `sources-panel.tsx`)
- **Location:** `web/src/components/research/source-card.tsx`
- **Purpose:** Individual source row in the source list.

```typescript
interface SourceCardProps {
  source: SourceMaterial;
  onTap: () => void;
  onRemove: () => void;
  onImportAsChapter: () => void;
}
```

**States:**
- Normal: Title, word count, cached time
- Processing: Source added but text extraction in progress
- Error: Text extraction failed
- Archived: Drive account disconnected

**Accessibility:**
- Card is a `button` element (entire card is tappable to open detail)
- Overflow menu (swipe actions or "..." button) uses `aria-haspopup="menu"`
- Status (processing, error, archived) announced via `aria-describedby`
- Minimum height 56pt; minimum tap target 44pt

---

### SourceAddFlow

- **Name:** `SourceAddFlow`
- **Type:** New (replaces `AddSourceSheet` + `DriveBrowserSheet`)
- **Location:** `web/src/components/research/source-add-flow.tsx`
- **Purpose:** Inline flow for adding sources from Drive or local device. Replaces the source list within the Sources tab.

```typescript
interface SourceAddFlowProps {
  projectId: string;
  driveAccounts: DriveAccount[];
  onSourcesAdded: () => void;
  onBack: () => void;
  onConnectAccount: () => void;
}
```

**States:**
- Account selection: Choose Drive account or upload
- Drive browsing: Navigate Drive folders, select files
- Uploading: Local file upload in progress
- Adding: Selected Drive files being added

**Accessibility:**
- Back button has `aria-label="Back to sources"`
- Drive file checkboxes have `aria-label` including the file name
- "Add N Selected" button announces selection count
- Folder navigation announces the current path

---

### SourceDetailView

- **Name:** `SourceDetailView`
- **Type:** New (replaces `SourceViewerSheet`)
- **Location:** `web/src/components/research/source-detail-view.tsx`
- **Purpose:** Full source content viewer displayed inline within the Sources tab.

```typescript
interface SourceDetailViewProps {
  sourceId: string;
  title: string;
  onBack: () => void;
  onImportAsChapter: (sourceId: string) => void;
  onSaveClip: (clip: { content: string; sourceId: string; sourceTitle: string; sourceLocation: string | null }) => Promise<void>;
}
```

**States:**
- Loading: Content being fetched
- Loaded: Content displayed, scrollable
- Error: Content fetch failed
- Search active: In-document search field visible (for long documents)

**Accessibility:**
- Back button has `aria-label="Back to source list"`
- Content area has `role="document"` with `aria-label="Source content: [title]"`
- Text selection and "Save to Clips" action is keyboard-accessible (Cmd+Shift+S)
- In-document search has `aria-label="Search within document"`

---

### QueryInput

- **Name:** `QueryInput`
- **Type:** New
- **Location:** `web/src/components/research/query-input.tsx`
- **Purpose:** Text input field for AI queries and source search.

```typescript
interface QueryInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
}
```

**States:**
- Empty: Placeholder visible
- Focused: Cursor active, keyboard open on iPad
- Has value: Submit button enabled
- Loading: Input disabled, spinner on submit button
- Disabled: Input grayed out (no sources, etc.)

**Accessibility:**
- Input has `aria-label` matching the `placeholder` text
- Submit button has `aria-label="Submit"` when not loading, `aria-label="Searching..."` when loading
- Input is `type="text"` with `enterkeyhint="send"` for mobile keyboards
- Minimum height 48pt for the input container
- Minimum 16px font size (prevents iOS zoom on focus)

---

### ResultCard

- **Name:** `ResultCard`
- **Type:** New
- **Location:** `web/src/components/research/result-card.tsx`
- **Purpose:** Displays a single AI search result with source citation and actions.

```typescript
interface ResultCardProps {
  content: string;
  sourceTitle: string;
  sourceId: string | null;
  sourceLocation: string | null;
  onSaveToClips: () => void;
  onInsert: () => void;
  isSaved: boolean;
  canInsert: boolean;
}
```

**States:**
- Default: Content visible with Save and Insert actions
- Saved: "Save to Clips" becomes "Saved" checkmark
- Insert disabled: Editor not ready

**Accessibility:**
- Card has `role="article"` with `aria-label="Search result from [sourceTitle]"`
- Action buttons have descriptive `aria-label` values
- Source title link has `aria-label="View source: [sourceTitle]"`
- Content text is selectable

---

### ClipCard

- **Name:** `ClipCard`
- **Type:** New
- **Location:** `web/src/components/research/clip-card.tsx`
- **Purpose:** Displays a saved snippet with source reference and actions.

```typescript
interface ClipCardProps {
  clip: ResearchClip;
  onInsert: () => void;
  onDelete: () => void;
  onViewSource: () => void;
  canInsert: boolean;
}
```

**States:**
- Default: Snippet text, source reference, Insert/Delete actions
- Expanded: Full text visible (for truncated clips)
- Inserted: Visual indicator that this clip has been inserted into a chapter
- Source removed: Source reference shows "[Source removed]"

**Accessibility:**
- Card has `role="article"` with `aria-label` including truncated clip text
- Delete requires confirmation (swipe or button tap)
- Insert button has `aria-label="Insert into chapter with footnote"`
- Source link has `aria-label="View source: [sourceTitle]"` or is `aria-disabled` if removed

---

### SnippetInsertButton

- **Name:** `SnippetInsertButton`
- **Type:** New
- **Location:** `web/src/components/research/snippet-insert-button.tsx`
- **Purpose:** Reusable button component for inserting text into the editor with auto-footnote.

```typescript
interface SnippetInsertButtonProps {
  text: string;
  sourceTitle: string;
  sourceId: string | null;
  onInsert: (text: string, sourceTitle: string, sourceId: string | null) => void;
  disabled?: boolean;
  variant?: "default" | "compact";
}
```

**States:**
- Default: "Insert" label
- Disabled: Grayed out (no cursor, editor loading)
- Success: Brief "Inserted" feedback (1.5s, then reverts)

**Accessibility:**
- `aria-label="Insert quote into chapter with footnote"`
- `aria-disabled` when disabled (not `disabled` attribute, to allow tooltip)
- Minimum 44pt tap target

---

### ResearchPanelProvider

- **Name:** `ResearchPanelProvider`
- **Type:** New
- **Location:** `web/src/components/research/research-panel-provider.tsx`
- **Purpose:** React context provider that encapsulates all Research Panel state, eliminating prop threading through EditorDialogs.

```typescript
interface ResearchPanelContextValue {
  // Panel state
  isOpen: boolean;
  activeTab: "sources" | "ask" | "clips";
  openPanel: (tab?: "sources" | "ask" | "clips") => void;
  closePanel: () => void;
  setActiveTab: (tab: "sources" | "ask" | "clips") => void;

  // Sources
  sources: SourceMaterial[];
  isSourcesLoading: boolean;
  sourcesError: string | null;
  fetchSources: () => Promise<void>;
  removeSource: (sourceId: string) => Promise<void>;

  // Source detail
  sourcesView: "list" | "detail" | "add";
  activeSourceId: string | null;
  viewSource: (sourceId: string) => void;
  backToSourceList: () => void;
  startAddFlow: () => void;

  // Clips
  clips: ResearchClip[];
  isClipsLoading: boolean;
  saveClip: (clip: Omit<ResearchClip, "id" | "createdAt">) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  clipCount: number;
}
```

---

## 5. State Model Changes

### Hooks to Modify or Replace

**`use-source-actions.ts` -- Replaced by `useResearchPanel`**

The current `useSourceActions` hook manages 6+ boolean state variables and returns 30+ values. It is replaced by `useResearchPanel`, which uses a state machine pattern.

Current hook is archived (not deleted) for reference. The new hook:

```typescript
// web/src/hooks/use-research-panel.ts

type SourcesView = "list" | "detail" | "add";
type ResearchTab = "sources" | "ask" | "clips";

interface ResearchPanelState {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Currently active tab */
  activeTab: ResearchTab;
  /** Sources tab sub-view */
  sourcesView: SourcesView;
  /** Active source ID (for detail view) */
  activeSourceId: string | null;
  /** Drive connection ID (for add flow) */
  driveConnectionId: string | null;
}

type ResearchPanelAction =
  | { type: "OPEN_PANEL"; tab?: ResearchTab }
  | { type: "CLOSE_PANEL" }
  | { type: "SET_TAB"; tab: ResearchTab }
  | { type: "VIEW_SOURCE"; sourceId: string }
  | { type: "BACK_TO_LIST" }
  | { type: "START_ADD_FLOW" }
  | { type: "SET_DRIVE_CONNECTION"; connectionId: string }
  | { type: "FINISH_ADD" };
```

The reducer enforces valid state transitions:

```typescript
function researchPanelReducer(
  state: ResearchPanelState,
  action: ResearchPanelAction
): ResearchPanelState {
  switch (action.type) {
    case "OPEN_PANEL":
      return {
        ...state,
        isOpen: true,
        activeTab: action.tab ?? state.activeTab,
        // Reset sources sub-view when opening
        sourcesView: action.tab === "sources" ? "list" : state.sourcesView,
      };
    case "CLOSE_PANEL":
      return {
        ...state,
        isOpen: false,
        // Reset all sub-views on close
        sourcesView: "list",
        activeSourceId: null,
        driveConnectionId: null,
      };
    case "SET_TAB":
      return {
        ...state,
        activeTab: action.tab,
        // Reset sources sub-view when switching away
        sourcesView: action.tab === "sources" ? state.sourcesView : "list",
      };
    case "VIEW_SOURCE":
      return {
        ...state,
        sourcesView: "detail",
        activeSourceId: action.sourceId,
      };
    case "BACK_TO_LIST":
      return {
        ...state,
        sourcesView: "list",
        activeSourceId: null,
        driveConnectionId: null,
      };
    case "START_ADD_FLOW":
      return {
        ...state,
        sourcesView: "add",
      };
    case "SET_DRIVE_CONNECTION":
      return {
        ...state,
        driveConnectionId: action.connectionId,
      };
    case "FINISH_ADD":
      return {
        ...state,
        sourcesView: "list",
        driveConnectionId: null,
      };
    default:
      return state;
  }
}
```

**Valid state space (6 states vs current 64 theoretical combinations):**

| State | isOpen | activeTab | sourcesView | activeSourceId |
|-------|--------|-----------|-------------|----------------|
| Closed | false | (any) | list | null |
| Sources List | true | sources | list | null |
| Source Detail | true | sources | detail | non-null |
| Source Add | true | sources | add | null |
| Ask | true | ask | (irrelevant) | null |
| Clips | true | clips | (irrelevant) | null |

**`use-chapter-sources.ts` -- Removed**

This hook is deleted entirely. The `chapter_sources` table is deprecated. No chapter-level source linking exists in the new design.

All references to `useChapterSources` in the editor page are removed. The `linkedSources`, `onLinkSource`, and `onUnlinkSource` props are removed from `EditorDialogs`.

**New hooks:**

```typescript
// web/src/hooks/use-research-clips.ts
export function useResearchClips(projectId: string) {
  // Returns: clips, isLoading, error, saveClip, deleteClip, fetchClips
}

// web/src/hooks/use-ai-research.ts
export function useAIResearch(projectId: string) {
  // Returns: query, setQuery, submitQuery, isQuerying, results,
  //          conversation, error, clearConversation
}
```

### State Shape

```typescript
/** Full state model for the Research Panel system */
interface ResearchPanelFullState {
  // Panel UI state (managed by useReducer)
  panel: ResearchPanelState;

  // Sources data (managed by useSources -- existing hook, unchanged)
  sources: SourceMaterial[];
  isSourcesLoading: boolean;
  sourcesError: string | null;

  // Source content (managed by useSourceContent -- existing hook, unchanged)
  viewerContent: string;
  viewerWordCount: number;
  isContentLoading: boolean;
  contentError: string | null;

  // AI research (managed by useAIResearch -- new hook)
  conversation: ConversationEntry[];
  isQuerying: boolean;
  queryError: string | null;

  // Clips (managed by useResearchClips -- new hook)
  clips: ResearchClip[];
  isClipsLoading: boolean;
  clipsError: string | null;
}

interface ConversationEntry {
  id: string;
  type: "query" | "response";
  content: string;
  /** For responses: structured results with citations */
  results?: AISearchResult[];
  timestamp: string;
}

interface AISearchResult {
  content: string;
  sourceId: string | null;
  sourceTitle: string;
  sourceLocation: string | null;
  /** Whether this result has been saved as a clip */
  isSaved: boolean;
}

interface ResearchClip {
  id: string;
  projectId: string;
  sourceId: string | null;
  sourceTitle: string;
  content: string;
  sourceLocation: string | null;
  createdAt: string;
}
```

---

## 6. API Changes

### Existing Endpoints -- Disposition

| Endpoint | Disposition | Notes |
|----------|-------------|-------|
| `POST /projects/:projectId/sources` | **Keep** | Add Drive sources. No changes needed. |
| `POST /projects/:projectId/sources/upload` | **Modify** | Expand accepted types to include `.docx` and `.pdf` (requires #124 text extraction). |
| `GET /projects/:projectId/sources` | **Keep** | List project sources. No changes needed. |
| `GET /sources/:sourceId/content` | **Keep** | Get cached content. No changes needed. |
| `DELETE /sources/:sourceId` | **Modify** | Add: when deleting a source, set `source_id = NULL` on any `research_clips` that reference it (cascade behavior). |
| `POST /sources/:sourceId/import-as-chapter` | **Keep** | Import source as chapter. No changes needed. |
| `GET /chapters/:chapterId/sources` | **Remove** | Chapter-source linking eliminated. |
| `POST /chapters/:chapterId/sources/:sourceId/link` | **Remove** | Chapter-source linking eliminated. |
| `DELETE /chapters/:chapterId/sources/:sourceId/link` | **Remove** | Chapter-source linking eliminated. |

### New Endpoints

#### POST /projects/:projectId/research/query

Natural-language query against project sources. Returns structured results with source citations.

```typescript
// Request
interface ResearchQueryRequest {
  query: string;
  /** Optional: limit search to specific source IDs */
  sourceIds?: string[];
}

// Response (SSE stream)
// Content-Type: text/event-stream
//
// event: result
// data: {"content":"...","sourceId":"...","sourceTitle":"...","sourceLocation":"..."}
//
// event: result
// data: {"content":"...","sourceId":"...","sourceTitle":"...","sourceLocation":"..."}
//
// event: done
// data: {"resultCount":2}
//
// event: error
// data: {"error":"..."}

// Non-streaming fallback (Accept: application/json)
interface ResearchQueryResponse {
  results: Array<{
    content: string;
    sourceId: string;
    sourceTitle: string;
    sourceLocation: string | null;
  }>;
  /** Summary text generated by the AI */
  summary: string;
  /** Query processing time in ms */
  processingTimeMs: number;
}
```

**Implementation notes:**
- Collects all source content for the project (from R2 cache).
- Chunks content per the chunking strategy (see #126, #136).
- Sends chunks + query to LLM (Workers AI or OpenAI depending on tier).
- Parses structured response into individual results with citations.
- Streams results as SSE events for responsive UI.
- Rate limited: 20 queries per minute per user.

#### GET /projects/:projectId/research/clips

List saved clips for a project.

```typescript
// Response
interface ClipsListResponse {
  clips: Array<{
    id: string;
    projectId: string;
    sourceId: string | null;
    sourceTitle: string;
    content: string;
    sourceLocation: string | null;
    createdAt: string;
  }>;
}
```

#### POST /projects/:projectId/research/clips

Save a new clip.

```typescript
// Request
interface SaveClipRequest {
  content: string;
  sourceId?: string;
  sourceTitle: string;
  sourceLocation?: string;
}

// Response (201)
interface SaveClipResponse {
  clip: {
    id: string;
    projectId: string;
    sourceId: string | null;
    sourceTitle: string;
    content: string;
    sourceLocation: string | null;
    createdAt: string;
  };
}
```

**Deduplication:** If a clip with identical `content` + `sourceId` already exists for the project, return the existing clip with 200 (not 201). No duplicate created.

#### DELETE /research/clips/:clipId

Remove a saved clip.

```typescript
// Response (200)
interface DeleteClipResponse {
  success: boolean;
}
```

**Authorization:** Clip ownership verified via project membership (clip's `projectId` matched against user's project access).

#### GET /projects/:projectId/research/sources/search

Full-text search across source content (for the Sources tab search field). Distinct from the AI query endpoint -- this is a simpler keyword search.

```typescript
// Query params: ?q=keyword
// Response
interface SourceSearchResponse {
  results: Array<{
    sourceId: string;
    title: string;
    /** Matching snippet from content */
    snippet: string;
    /** Approximate position in the source */
    position: number;
  }>;
}
```

**Implementation:** Uses D1 FTS5 full-text search on source content stored in a new `source_content_fts` virtual table (see Data Model section). Falls back to LIKE search if FTS is not available.

---

## 7. Data Model Changes

### New Tables

#### research_clips

Stores saved snippets from AI results or manual text selection.

```sql
-- Migration: 0014_create_research_clips.sql

CREATE TABLE research_clips (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES source_materials(id) ON DELETE SET NULL,
  source_title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_location TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_research_clips_project ON research_clips(project_id);
CREATE INDEX idx_research_clips_source ON research_clips(source_id);

-- Dedup: same content + source within a project
CREATE UNIQUE INDEX idx_research_clips_dedup
  ON research_clips(project_id, source_id, content)
  WHERE source_id IS NOT NULL;
```

**Key decisions:**
- `source_id` uses `ON DELETE SET NULL` -- when a source is removed, the clip retains its text and `source_title` but loses the source link. This matches the user expectation from Flow 7.
- `source_title` is stored redundantly (not just as a FK to `source_materials.title`) so that clips display the title even after source removal.
- `content` is the full snippet text. Maximum size enforced at the API level (10KB per clip).
- `source_location` stores a human-readable location reference (e.g., "Section 3" or "Near beginning") -- not a byte offset or page number, since source content is plain text extracted from various formats.

#### research_queries (Phase B)

Stores query history for conversation continuity and analytics.

```sql
-- Migration: 0015_create_research_queries.sql

CREATE TABLE research_queries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_research_queries_project ON research_queries(project_id);
```

**Key decisions:**
- Query results are NOT stored in D1. They are ephemeral -- regenerated on each query. This avoids stale results as source content changes.
- Only the query text and metadata are stored, for conversation history display and analytics.
- No `response` column -- AI responses are streamed and not persisted. Users save specific results as clips.

#### source_content_fts (Phase A)

Full-text search index for source content.

```sql
-- Migration: 0016_create_source_content_fts.sql

CREATE VIRTUAL TABLE source_content_fts USING fts5(
  source_id,
  title,
  content,
  tokenize='porter unicode61'
);

-- Populated by a trigger on source_materials content caching
-- (or explicitly after text extraction completes)
```

**Key decisions:**
- D1 supports FTS5 virtual tables. This enables fast keyword search in the Sources tab without requiring a vector database.
- The FTS table is populated when source content is cached (after text extraction). It is rebuilt when content is refreshed.
- This is NOT used for AI queries -- AI queries use the full source text sent to the LLM. FTS is for the simpler Sources tab search.

### Modifications to Existing Tables

#### source_materials

No schema changes to `source_materials`. However, the text extraction service (issue #124) will populate `r2_key` and `cached_at` for `.docx` and `.pdf` files in addition to the existing Google Docs support.

#### chapter_sources (deprecated)

```sql
-- Migration: 0017_deprecate_chapter_sources.sql

-- No schema changes. Table is preserved for data integrity and potential rollback.
-- Application code stops writing to this table.
-- A future migration (after 90 days) can DROP the table.

-- Add a comment column to mark deprecation
-- (SQLite doesn't support table comments, so this is documentation only)
```

The `chapter_sources` table is **not dropped** in the initial migration. The table remains with its existing data. The three API endpoints that read/write it are removed. After 90 days with no issues, a follow-up migration drops the table.

### R2 Storage Patterns

| Data | Storage | Key Pattern | Notes |
|------|---------|-------------|-------|
| Source content (cached) | R2 (`dc-exports`) | `sources/{sourceId}/content.html` | Existing pattern, unchanged |
| Source content (plain text for AI) | R2 (`dc-exports`) | `sources/{sourceId}/content.txt` | New: plain text version for AI queries and FTS |
| Uploaded local files (original) | R2 (`dc-exports`) | `sources/{sourceId}/original.{ext}` | Existing for .txt/.md, extended for .docx/.pdf |

**Key decisions:**
- Source content is stored in R2 in two formats: HTML (for display in the viewer) and plain text (for AI queries and FTS indexing). The plain text version is generated during text extraction.
- Clips are stored in D1 only (text content). They do not use R2 since they are short text excerpts (< 10KB).
- AI query results are not stored in R2. They are ephemeral.

---

## 8. Backlog Issue Mapping

### Issue #121: Authorize Google Drive access for source file reading

- **Disposition:** Keep
- **Phase:** Phase A (Foundation)
- **Notes:** Existing Drive OAuth flow is unchanged. The Research Panel's Sources tab uses the same `useDriveAccounts` hook. No modifications needed to this issue.

### Issue #122: Select specific Google Drive folders/files for AI search scope

- **Disposition:** Rewrite
- **Phase:** Phase A (Foundation)
- **New title:** "Select Google Drive files as project sources via inline Drive browser"
- **New description:** As a user, I want to browse my Google Drive within the Research Panel's Sources tab and select files to add as project sources. The Drive browser appears inline within the Sources tab (not as a separate sheet), replacing the source list while browsing. I can navigate folders, select multiple files via checkboxes, and add them in a single action.
- **New ACs:**
  - [ ] "Add" button in Sources tab header opens inline add flow
  - [ ] Add flow shows connected Drive accounts and "Upload from device" option
  - [ ] Selecting a Drive account opens an inline folder browser
  - [ ] Folder browser shows folders (navigable) and Google Docs (selectable via checkbox)
  - [ ] "Add N Selected" button adds all checked files as project sources
  - [ ] After adding, view returns to source list showing new sources
  - [ ] Files already in the project show a "Already added" indicator and disabled checkbox
  - [ ] All touch targets minimum 44pt
  - [ ] Back navigation at every level (no dead ends)
- **Dependencies:** #121 (Drive auth)

### Issue #123: Upload local files for AI search scope

- **Disposition:** Rewrite
- **Phase:** Phase A (Foundation)
- **New title:** "Upload local files (.txt, .md, .docx, .pdf) as project sources"
- **New description:** As a user, I want to upload files from my device as project sources via the Research Panel's Sources tab add flow. The upload option appears alongside Drive accounts in the add flow. Selecting it opens the system file picker. Uploaded files are processed and appear in the source list.
- **New ACs:**
  - [ ] "Upload from device" option in the Source Add Flow
  - [ ] System file picker accepts `.txt`, `.md`, `.docx`, `.pdf`
  - [ ] Uploaded file appears in source list with "Processing..." status
  - [ ] After text extraction completes, source shows word count and "Cached" status
  - [ ] File size limit: 5MB (error message for larger files)
  - [ ] Unsupported file types show clear error message
- **Dependencies:** #124 (text extraction for .docx/.pdf)

### Issue #124: Backend text extraction service for .docx, .pdf, .txt

- **Disposition:** Keep
- **Phase:** Phase A (Foundation)
- **Notes:** Unchanged. This is backend infrastructure required for local file upload (.docx, .pdf) and for generating plain-text versions of all sources for AI queries. Add requirement: extracted text must also be stored in R2 as `.txt` alongside the HTML version, and indexed in `source_content_fts`.
- **New dependency note:** FTS indexing is part of this issue (populate `source_content_fts` after extraction).

### Issue #125: API endpoint for natural language queries against source documents

- **Disposition:** Rewrite
- **Phase:** Phase B (AI Integration)
- **New title:** "POST /projects/:projectId/research/query -- AI natural language query endpoint"
- **New description:** As the Ask tab frontend, I need a secure API endpoint that accepts a user's natural language query and returns structured results with source citations, streamed as SSE events. The endpoint collects all project source content, chunks it, sends it with the query to the LLM, and parses the response into individual cited results.
- **New ACs:**
  - [ ] Endpoint accepts `{ query: string, sourceIds?: string[] }`
  - [ ] Collects source content from R2 (plain text versions)
  - [ ] Applies chunking strategy per #126
  - [ ] Sends to LLM (Workers AI or OpenAI per project tier setting)
  - [ ] Streams results as SSE events (`event: result`, `event: done`, `event: error`)
  - [ ] Each result includes `content`, `sourceId`, `sourceTitle`, `sourceLocation`
  - [ ] Rate limited: 20 queries/minute/user
  - [ ] Saves query metadata to `research_queries` table
  - [ ] Returns 400 if project has no sources with cached content
  - [ ] Non-streaming fallback for `Accept: application/json`
- **Dependencies:** #124 (text extraction), #126 (chunking), #134 (prompt engineering spike)

### Issue #126: Chunk source text and build effective LLM prompts

- **Disposition:** Keep
- **Phase:** Phase B (AI Integration)
- **Notes:** Unchanged. The chunking strategy feeds directly into the research query endpoint (#125). Output of spike #136 informs the approach.
- **Dependencies:** #136 (chunking strategy spike)

### Issue #127: Parse LLM responses into structured snippet list with source references

- **Disposition:** Keep
- **Phase:** Phase B (AI Integration)
- **Notes:** Unchanged. The structured parsing is used by the research query endpoint to produce `ResultCard`-ready data. Output of spike #134 informs the prompt/response format.
- **Dependencies:** #134 (prompt engineering spike)

### Issue #128: Research Assistant side panel with toolbar toggle

- **Disposition:** Rewrite
- **Phase:** Phase A (Foundation) -- panel infrastructure ships first; Ask tab content ships in Phase B
- **New title:** "Research Panel with tab navigation and toolbar toggle"
- **New description:** As a user, I want a Research icon in the editor toolbar that toggles a right-hand panel containing three tabs: Sources, Ask, and Clips. In landscape orientation (1024pt+), the panel opens as a side-by-side view alongside the editor (340pt wide). In portrait orientation, it opens as an 85% overlay from the right. The panel replaces the current SourcesPanel, AddSourceSheet, DriveBrowserSheet, and SourceViewerSheet.
- **New ACs:**
  - [ ] Research icon in editor toolbar toggles panel open/close
  - [ ] Panel has three tabs: Sources, Ask, Clips
  - [ ] Keyboard shortcut: Cmd+Shift+R toggles panel
  - [ ] Escape closes panel
  - [ ] Landscape: panel is 340pt, pushes editor (editor min 400pt)
  - [ ] Portrait: panel is 85% overlay with backdrop
  - [ ] Panel uses `100dvh` and `env(safe-area-inset-*)`
  - [ ] Tab state persists while panel is open (switching tabs doesn't reset)
  - [ ] `prefers-reduced-motion` disables slide animations
  - [ ] Panel does not break editor auto-save
  - [ ] All text minimum 16px
  - [ ] `ResearchPanelProvider` context encapsulates all panel state
  - [ ] EditorDialogsProps reduced by ~50 source-related props
- **Dependencies:** None (pure frontend infrastructure)

### Issue #129: Research query input with loading state and result cards

- **Disposition:** Rewrite
- **Phase:** Phase B (AI Integration)
- **New title:** "Ask tab with query input, streaming results, and result cards"
- **New description:** As a user, I want a text input in the Ask tab where I can type natural-language questions about my source documents. After submitting, I see a loading state followed by streaming result cards with cited passages. Each result card has "Save to Clips" and "Insert" actions.
- **New ACs:**
  - [ ] Query input at bottom of Ask tab (chat-pattern layout)
  - [ ] Send button (44pt minimum) and Cmd+Return keyboard shortcut
  - [ ] Empty state shows suggested queries (tappable)
  - [ ] Loading state: skeleton loader with "Searching across N sources..."
  - [ ] Results stream in as SSE events
  - [ ] Each ResultCard shows: passage text, source title (tappable), source location
  - [ ] "Save to Clips" action on each card (updates to "Saved" checkmark)
  - [ ] "Insert" action on each card (inserts at editor cursor with footnote)
  - [ ] Error state: "Something went wrong" with Retry button
  - [ ] No-results state: helpful message with suggestions
  - [ ] Conversation history persists within session (multiple Q&A pairs)
  - [ ] Input minimum 16px font size (prevents iOS zoom)
- **Dependencies:** #125 (query endpoint), #128 (panel infrastructure)

### Issue #130: Click source filename to preview original document at snippet location

- **Disposition:** Rewrite
- **Phase:** Phase B (AI Integration)
- **New title:** "Tappable source citations in AI results and clips that navigate to source detail"
- **New description:** As a user, when I see a source title in an AI result card or a clip card, I want to tap it and be taken to the full source document in the Sources tab, ideally scrolled near the cited passage.
- **New ACs:**
  - [ ] Source title in ResultCard and ClipCard is a tappable link
  - [ ] Tapping navigates to Sources tab > Source Detail View for that source
  - [ ] If `sourceLocation` is available, the detail view scrolls to the approximate position
  - [ ] If `sourceLocation` is null, the detail view opens at the top
  - [ ] Back navigation returns to the previous tab (Ask or Clips)
  - [ ] Minimum 44pt tap target on source title link
- **Dependencies:** #128 (panel infrastructure), #137 (preview component)

### Issue #131: Add selected snippets to Research Board

- **Disposition:** Rewrite
- **Phase:** Phase C (Board + Editor)
- **New title:** "Save snippets to Clips from AI results and source text selection"
- **New description:** As a user, I want to save useful passages to my Clips collection from two paths: (1) tapping "Save to Clips" on an AI result card, and (2) selecting text in the Source Detail View and choosing "Save to Clips" from a floating toolbar.
- **New ACs:**
  - [ ] "Save to Clips" button on each AI ResultCard
  - [ ] Button changes to "Saved" checkmark after saving
  - [ ] Duplicate detection: same content + source does not create a second clip
  - [ ] Long-press text selection in Source Detail View shows "Save to Clips" floating action
  - [ ] Saved clip includes: content, sourceId, sourceTitle, sourceLocation
  - [ ] Clips tab badge updates to show new count
  - [ ] Toast notification on successful save
  - [ ] API: POST /projects/:projectId/research/clips
- **Dependencies:** #128 (panel infrastructure), #125 (for AI result saving path)

### Issue #132: View and manage collected snippets on Research Board

- **Disposition:** Rewrite
- **Phase:** Phase C (Board + Editor)
- **New title:** "Clips tab for viewing, searching, and managing saved snippets"
- **New description:** As a user, I want to view all my saved clips in the Clips tab, search across them, and delete clips I no longer need. Clips are displayed as cards with their text, source reference, and action buttons.
- **New ACs:**
  - [ ] Clips tab shows all saved clips, most recent first
  - [ ] Each ClipCard shows: snippet text (truncated at 300 chars with "Show more"), source title (tappable), save date
  - [ ] Search field filters clips by text content and source title
  - [ ] Delete action with swipe-left or overflow menu (no modal confirmation for clips)
  - [ ] Empty state: "No clips yet" with guidance text
  - [ ] Source title tappable -- navigates to Sources tab > detail view
  - [ ] Clips with removed sources show "[Source removed]" in gray
  - [ ] API: GET /projects/:projectId/research/clips, DELETE /research/clips/:clipId
- **Dependencies:** #131 (save clips)

### Issue #133: Drag-and-drop snippets from Research Board into editor with auto-footnotes

- **Disposition:** Rewrite
- **Phase:** Phase C (Board + Editor)
- **New title:** "Insert clips into editor with automatic footnote creation"
- **New description:** As a user, I want to insert a saved clip into my chapter at the current cursor position. The inserted text is wrapped in a blockquote, and a footnote is automatically created referencing the source document. Insertion is via an "Insert" button on the clip card (not drag-and-drop, which is unreliable on iPad Safari).
- **New ACs:**
  - [ ] "Insert" button on each ClipCard and ResultCard
  - [ ] Tapping Insert: focuses editor, inserts blockquote at cursor position
  - [ ] Footnote auto-created with source title as reference text
  - [ ] If no cursor position, text appended to end of chapter
  - [ ] Success toast: "Inserted with footnote"
  - [ ] Insert button disabled when no chapter selected or editor loading
  - [ ] Tiptap footnote extension created (new Tiptap node type)
  - [ ] Footnotes rendered at bottom of chapter content
  - [ ] Undo (Cmd+Z) removes the inserted blockquote and footnote together
  - [ ] Inserted text participates in Drive write-through (auto-saves normally)
  - [ ] **NOT** drag-and-drop (iPad Safari limitation). Button-only insertion.
- **Dependencies:** #131, #132, Tiptap footnote extension (new sub-task)

### Issue #134: SPIKE: LLM prompt engineering for structured snippet output

- **Disposition:** Keep
- **Phase:** Pre-Phase B (spike)
- **Notes:** Unchanged. Output directly informs #125 and #127.
- **Dependencies:** None

### Issue #135: SPIKE: Document parsing library evaluation for .pdf and .docx

- **Disposition:** Keep
- **Phase:** Pre-Phase A (spike)
- **Notes:** Unchanged. Output directly informs #124.
- **Dependencies:** None

### Issue #136: SPIKE: Content chunking strategy and context window management

- **Disposition:** Keep
- **Phase:** Pre-Phase B (spike)
- **Notes:** Unchanged. Output directly informs #126.
- **Dependencies:** None

### Issue #137: SPIKE: File preview UI component with scroll-to-position

- **Disposition:** Rewrite
- **Phase:** Phase A (Foundation)
- **New title:** "SPIKE: Source content renderer with scroll-to-position for Research Panel"
- **New description:** Build a proof-of-concept for the Source Detail View component that renders source content (extracted text/HTML) within the Research Panel's 340pt width, supports text selection, and can scroll to an approximate text position. Test with real source content of varying lengths (500 - 10,000+ words). Evaluate performance on iPad Safari.
- **New ACs:**
  - [ ] Renders HTML content in a scrollable container
  - [ ] Supports programmatic scroll to a text position (for #130 citation links)
  - [ ] Text selection works on iPad (long-press)
  - [ ] Performance acceptable for 10,000+ word documents on iPad Safari
  - [ ] In-document search field (Cmd+F equivalent) for long documents
  - [ ] Minimum 16px text size
- **Dependencies:** None

### Phase Assignment Summary

| Issue | Phase | Disposition |
|-------|-------|-------------|
| #121 | A | Keep |
| #122 | A | Rewrite |
| #123 | A | Rewrite |
| #124 | A | Keep (extend) |
| #125 | B | Rewrite |
| #126 | B | Keep |
| #127 | B | Keep |
| #128 | A | Rewrite |
| #129 | B | Rewrite |
| #130 | B | Rewrite |
| #131 | C | Rewrite |
| #132 | C | Rewrite |
| #133 | C | Rewrite |
| #134 | Pre-B | Keep |
| #135 | Pre-A | Keep |
| #136 | Pre-B | Keep |
| #137 | A | Rewrite |

---

## 9. Implementation Phases

### Phase A: Foundation (Sources Tab + Panel Infrastructure)

**What ships:**
The Research Panel with full Sources tab functionality. The panel replaces all existing source management UI. The Ask tab and Clips tab exist as tabs but show "Coming soon" placeholder content. This phase delivers immediate value by fixing the sheet-stacking UX, eliminating chapter-source linking confusion, and providing the panel infrastructure for Phases B and C.

**Components:**
- `ResearchPanel` (container + tab navigation)
- `ResearchPanelProvider` (context)
- `SourcesTab` (source list + search)
- `SourceCard` (source row)
- `SourceAddFlow` (inline Drive browser + upload)
- `SourceDetailView` (inline content viewer)
- `QueryInput` (reusable -- used for source search in Phase A, AI query in Phase B)
- Ask tab placeholder ("Coming soon" with description of what it will do)
- Clips tab placeholder ("Coming soon" with description of what it will do)

**API changes:**
- Remove 3 chapter-source endpoints
- Add `GET /projects/:projectId/research/sources/search` (source text search)
- Modify `POST /projects/:projectId/sources/upload` to accept `.docx` and `.pdf` (depends on #124)
- Modify `DELETE /sources/:sourceId` to handle future clip references (add `ON DELETE SET NULL` readiness)

**Database changes:**
- Migration 0014: `research_clips` table (created early, used in Phase C)
- Migration 0016: `source_content_fts` virtual table
- Migration 0017: `chapter_sources` deprecation note

**What the user sees:**
- A "Research" button in the toolbar replaces the current "Sources" action
- Tapping it opens a right-hand panel with three tabs
- Sources tab: same source list as before, but with search, inline Drive browser, and inline content viewer -- no more sheet stacking
- Ask and Clips tabs: placeholder content explaining what's coming
- All chapter-source link/unlink UI is gone
- Source viewing works side-by-side with the editor in landscape

**Estimated scope:** 2-3 weeks for one developer
- Week 1: ResearchPanel, ResearchPanelProvider, SourcesTab (list + search), SourceCard. Remove old components. Remove chapter-source endpoints. Migrate EditorDialogs.
- Week 2: SourceAddFlow (inline Drive browser), SourceDetailView (inline viewer). Source content FTS. Panel layout (landscape side-by-side, portrait overlay).
- Week 3: Polish, iPad testing, accessibility audit, edge cases.

**Risks:**
- The SourceAddFlow (inline Drive browser) reuses the existing `useDriveBrowser` hook but renders inline instead of as a sheet. The hook may need minor adjustments for the inline context.
- Removing chapter-source linking is a breaking change for any users who have linked sources. Since this is Phase 0 with very few users, the risk is acceptable. A migration note should be displayed to affected users.

---

### Phase B: AI Integration (Ask Tab)

**What ships:**
The Ask tab becomes functional with AI-powered natural-language queries across project sources. Users can ask questions and receive structured results with source citations. "Save to Clips" is available on result cards (creates the clip but the Clips tab gets full functionality in Phase C). Source citation links navigate to the Source Detail View.

**Components:**
- `AskTab` (full implementation)
- `ResultCard` (AI search result display)
- `SnippetInsertButton` (reusable insert action)

**API changes:**
- Add `POST /projects/:projectId/research/query` (AI query with SSE streaming)
- Add `POST /projects/:projectId/research/clips` (save clip -- simple version)
- Add `GET /projects/:projectId/research/clips` (list clips -- for Clips tab badge count)
- Migration 0015: `research_queries` table

**Database changes:**
- Migration 0015: `research_queries` table

**Dependencies on spikes:**
- #134 (prompt engineering) must be completed. The prompt format and expected response structure inform the query endpoint implementation.
- #135 (document parsing) must be completed. AI queries require plain-text source content.
- #136 (chunking strategy) must be completed. The chunking approach determines how source content is prepared for the LLM context window.

**What the user sees:**
- Ask tab is now functional (replaces "Coming soon" placeholder)
- User types a question, sees a loading state, then receives results with source citations
- Each result shows the relevant passage and which source document it came from
- "Save to Clips" button on each result
- Source titles are tappable and navigate to the full source document
- Conversation history within the session (multiple queries)
- Clips tab badge shows count of saved clips (full Clips tab UI ships in Phase C)

**Estimated scope:** 3-4 weeks for one developer
- Week 1: Research query endpoint (chunking + LLM integration + response parsing). SSE streaming.
- Week 2: AskTab UI (QueryInput, ResultCard, conversation view). Empty states, error states, loading states.
- Week 3: Save-to-clips API + frontend integration. Source citation navigation (link from ResultCard to SourceDetailView).
- Week 4: Polish, performance testing (query latency), iPad testing, edge cases (large source libraries, long responses).

**Risks:**
- AI query quality is the existential risk. Both personas identified this as the deal-breaker. If results are inaccurate, incorrectly cited, or hallucinated, users will abandon the feature. The spike outputs (#134, #136) must produce reliable approaches before Phase B begins.
- SSE streaming on Cloudflare Workers has specific constraints (no long-lived connections). The endpoint must stream and close within Workers' execution time limits.
- Performance with large source libraries (Marcus's 100+ docs) requires testing. The chunking strategy must handle this scale within LLM context window limits.

---

### Phase C: Board + Editor Integration (Clips Tab)

**What ships:**
The Clips tab becomes fully functional. Users can view, search, and manage their saved clips. The "Insert" action on clips and AI results inserts text into the editor with automatic footnote creation. The Tiptap footnote extension is built.

**Components:**
- `ClipsTab` (full implementation)
- `ClipCard` (saved snippet display)
- `SnippetInsertButton` (full implementation with editor integration)
- Tiptap footnote extension (new Tiptap node type for footnotes)
- Footnote rendering in chapter content

**API changes:**
- Add `DELETE /research/clips/:clipId` (delete clip)
- The save and list endpoints were added in Phase B

**Database changes:**
- None (all tables created in earlier phases)

**What the user sees:**
- Clips tab is now functional (replaces placeholder)
- All saved clips displayed as cards with text, source reference, and timestamp
- Search field filters clips
- Delete action removes clips
- "Insert" button inserts clip text as a blockquote with an automatic footnote
- Footnotes appear at the bottom of the chapter
- Undo removes the inserted content and footnote together
- Insert works from both Clips tab and Ask tab result cards

**Estimated scope:** 2-3 weeks for one developer
- Week 1: ClipsTab UI (ClipCard, search, delete). Tiptap footnote extension (new node type).
- Week 2: Insert action (editor focus, cursor position, blockquote + footnote insertion). Undo integration. Drive write-through compatibility.
- Week 3: Polish, iPad testing (especially text selection and insertion flow), accessibility audit, edge cases.

**Risks:**
- The Tiptap footnote extension is non-trivial. Footnotes must be rendered in the editor, survive serialization to HTML (for Drive write-through), and participate in undo/redo. This may require 1-2 additional days of investigation.
- Cursor position management between the editor and the Research Panel is tricky on iPad. The editor must track its last cursor position even when focus moves to the Research Panel. Tiptap's `editor.state.selection` provides this, but it must be tested thoroughly on iPad Safari.
- Insert action must not break the three-tier save architecture (local, R2, Drive). The inserted content is just Tiptap content and flows through the existing save pipeline, but the footnote node type must be handled in the HTML serializer.

---

## Appendix: Design Constraints Checklist

| Constraint | How Addressed |
|------------|---------------|
| iPad Safari is primary test target | All layouts tested at iPad Air, Pro, and Mini dimensions. Portrait/landscape both specified. |
| 44pt minimum touch targets | All buttons, checkboxes, tap areas specified at minimum 44pt. Source cards 56pt height. |
| No hover-dependent interactions | All actions use tap/press. Swipe-to-reveal has button fallback. No tooltips as sole discovery mechanism. |
| `100dvh` not `100vh` | Panel and overlay use `100dvh` for Safari address bar compatibility. |
| `env(safe-area-inset-*)` | Panel positioning uses safe area insets. Specified in CSS section. |
| Editor content area >= 400pt | Enforced in layout spec. If panel would violate, portrait overlay mode is used instead of side-by-side. |
| Portrait mode: overlay, not side-by-side | Explicitly specified. Portrait < 1024pt triggers overlay mode. |
| External keyboard shortcuts | Cmd+Shift+R (panel toggle), Escape (close), Cmd+Return (submit query). Specified per flow. |
| All text >= 16px | Input fields, card content, source content all minimum 16px. Prevents iOS auto-zoom. |
| `prefers-reduced-motion` | All slide/fade animations disabled. Instant transitions. Specified per component. |
| Three-tier save architecture | Insert action produces standard Tiptap content. Footnotes serialize to HTML. No new save paths needed. |
