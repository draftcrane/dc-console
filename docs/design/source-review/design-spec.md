# DraftCrane Source/Research UX: Final Design Specification

> **Status:** Authoritative design document
> **Mental Model:** Option B -- "Research Companion"
> **Date:** 2026-02-19
> **Updated:** 2026-02-23 (Source Type Picker, empty state spec)
> **Derived from:** Multi-phase design review (research, analysis, user reactions, detailed design, stress test)
> **Parent PRD:** `docs/pm/prd-app.md` — Section 6.3 (Cloud File Integration), Section 6.6 (Source Intelligence)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Principles](#2-design-principles)
3. [Information Architecture](#3-information-architecture)
4. [Mental Model](#4-mental-model)
5. [Interaction Flows](#5-interaction-flows)
6. [Panel Specifications](#6-panel-specifications)
7. [Component Specifications](#7-component-specifications)
8. [Data Model Changes](#8-data-model-changes)
9. [API Specification](#9-api-specification)
10. [Implementation Phases](#10-implementation-phases)
11. [Decisions Log](#11-decisions-log)
12. [Appendix: User Feedback Resolution Tracker](#12-appendix-user-feedback-resolution-tracker)

---

## 1. Executive Summary

### Chosen Mental Model

**Option B: "Research Companion"** -- a unified right-hand panel with three tabs (Sources, Ask, Clips) that serves as the author's research workspace alongside the writing editor.

Both personas (Diane Mercer, first-time nonfiction author; Marcus Chen, experienced academic with 100+ documents) independently selected Option B. It was chosen over Option A ("Polished Library," which lacked AI search) and Option C ("Integrated Research Assistant," which buried source browsing behind a settings submenu and placed an all-or-nothing bet on AI quality).

### Key Decisions Made During the Review

1. **Chapter-source linking is eliminated.** The link/unlink concept confused both personas and provided invisible outcomes. Sources are project-level. Implicit references are tracked when snippets are inserted.
2. **Sheet stacking is eliminated.** The current 4-layer chain (SourcesPanel > AddSourceSheet > DriveBrowserSheet > SourceViewerSheet) is replaced by inline view replacement within a single panel.
3. **AI-powered search is the primary differentiator.** The Ask tab -- not the source browser -- is what makes DraftCrane more valuable than Google Drive tabs. Both personas identified this as the breakthrough capability.
4. **Clips support chapter-level tagging.** The stress test exposed that a flat clip list is RED for Marcus at scale. Clips can be optionally tagged to chapters, with a chapter filter in the Clips tab.
5. **A trust line is shown during source addition.** "Your originals are never changed" appears in the Source Add Flow to address Drive modification anxiety.
6. **In-document search is always visible.** The original 10,000-word threshold was too high. Search is always available in the Source Detail View.
7. **A first-use nudge surfaces the Research Panel.** A one-time tooltip on the Research toolbar button bridges the discoverability gap.

### One-Paragraph Summary

The current source management UX -- a 4-layer sheet stack with confusing chapter-source linking and a 133-line props interface -- is replaced by a single right-hand Research Panel containing three tabs. The Sources tab provides a project-level source list with inline Drive browsing and content viewing. The Ask tab enables natural-language queries across all project sources with AI-powered, cited results. The Clips tab collects useful passages with source attribution and supports one-tap insertion into the editor with automatic footnotes. The design ships in three phases: Foundation (panel + Sources tab, 2-3 weeks), AI Integration (Ask tab, 3-4 weeks), and Board + Editor (Clips tab + footnotes, 2-3 weeks).

---

## 2. Design Principles

### Principle 1: One Panel, One Purpose

**This means:** All research functionality lives in a single right-hand panel. The panel uses tabs for distinct activities (browse, ask, collect), and inline view replacement for drill-downs. No surface ever stacks on top of another. Maximum depth is 2 levels (panel open, then detail or add view).

**This does NOT mean:** Cramming unrelated features into the panel. The panel is for research -- source management, AI queries, and snippet collection. Project settings, chapter management, and AI rewrite remain separate surfaces.

### Principle 2: Ask First, Browse When Needed

**This means:** The AI query interface (Ask tab) is the primary way users find information in their sources. It handles the "needle in a haystack" problem across 10-100+ documents that no human can browse efficiently. Manual source browsing (Sources tab) exists as a first-class alternative for users who know exactly which document they want or who need to survey their research landscape.

**This does NOT mean:** Hiding or demoting source browsing. The Sources tab is the default tab. Users who prefer browsing over asking are fully supported. The Ask tab is an addition, not a replacement.

### Principle 3: Your Files Are Yours

**This means:** Trust messaging is explicit at every moment where users might worry about their Google Drive files. The Source Add Flow shows "Your originals are never changed." The remove confirmation says "The original file in Google Drive is not affected." Source content is cached and read-only. DraftCrane never writes to, modifies, or deletes files in the user's Google Drive.

**This does NOT mean:** Excessive warnings or confirmation dialogs for non-destructive actions. Viewing a source, saving a clip, or asking a question require zero confirmations.

### Principle 4: Clips Carry Their Provenance

**This means:** Every clip (saved passage) permanently records its source document title and location. When a clip is inserted into the editor, the footnote is created automatically. The author never needs to manually track where a quote came from. Even if the source is later removed from the project, the clip retains its text and source title.

**This does NOT mean:** Enforcing formal citation styles. Footnotes use a simple "[N] Source Title" format. Formal Chicago/APA/MLA citation formatting is a future enhancement, not Phase 0 scope.

### Principle 5: iPad-First Means Constraint-First

**This means:** Every interaction is designed for touch on a 10.9" iPad Air in both orientations. Landscape enables side-by-side (editor + panel). Portrait uses a full overlay. All touch targets are 44pt minimum. No hover states, no floating windows, no drag-and-drop (unreliable on iPad Safari). The software keyboard is accounted for in every input flow.

**This does NOT mean:** Degrading the desktop experience. Desktop gets the same panel layout with more editor space. Desktop-specific enhancements (panel resizing, keyboard shortcuts) are layered on top, never required.

---

## 3. Information Architecture

### Screen/Panel Inventory

**Primary surfaces (always available):**

| Surface         | Type                                   | Purpose                                     | Status    |
| --------------- | -------------------------------------- | ------------------------------------------- | --------- |
| Chapter Sidebar | Persistent left panel (260pt)          | Chapter navigation, word counts             | Unchanged |
| Editor          | Central content area (flex, min 400pt) | Tiptap rich text editor                     | Unchanged |
| Research Panel  | Toggleable right panel (340pt)         | Three-tab container for Sources, Ask, Clips | **New**   |

**Secondary surfaces (within Research Panel):**

| Surface            | Type                                  | Purpose                                               | Status  |
| ------------------ | ------------------------------------- | ----------------------------------------------------- | ------- |
| Source Detail View | Inline replacement within Sources tab | Full source content viewer with always-visible search | **New** |
| Source Add Flow    | Inline replacement within Sources tab | Drive browser + local upload with trust messaging     | **New** |

**Confirmation dialogs (modal):**

| Surface                    | Type          | Purpose                            | Status  |
| -------------------------- | ------------- | ---------------------------------- | ------- |
| Remove Source Confirmation | Center dialog | Confirm destructive source removal | **New** |

**First-use elements:**

| Surface              | Type                               | Purpose                                  | Status  |
| -------------------- | ---------------------------------- | ---------------------------------------- | ------- |
| Research Panel Nudge | One-time tooltip on toolbar button | Bridge discoverability gap for new users | **New** |

### Navigation Model

```
Level 0: Research Panel closed (editor takes full width)

Level 1: Research Panel open with active tab
          - Sources tab (source list with search/filter)
          - Ask tab (AI query interface)
          - Clips tab (saved snippet board with chapter filter)

Level 2: Sources tab only -- drill-down views
          - Source Detail View (replaces source list inline)
          - Source Add Flow (replaces source list inline)

Cross-tab navigation:
          - Tapping a source title in Ask or Clips navigates to
            Sources tab > Source Detail View, with a "Back to [Ask/Clips]"
            breadcrumb for return navigation
```

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

### What Was Removed

| Component/Concept                           | File(s)                                            | Reason                                               |
| ------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| `SourcesPanel`                              | `web/src/components/drive/sources-panel.tsx`       | Replaced by `ResearchPanel` > `SourcesTab`           |
| `AddSourceSheet`                            | `web/src/components/drive/add-source-sheet.tsx`    | Merged into `SourceAddFlow` within Sources tab       |
| `DriveBrowserSheet`                         | `web/src/components/drive/drive-browser-sheet.tsx` | Merged into `SourceAddFlow` within Sources tab       |
| `SourceViewerSheet`                         | `web/src/components/drive/source-viewer-sheet.tsx` | Replaced by `SourceDetailView` within Sources tab    |
| `useChapterSources` hook                    | `web/src/hooks/use-chapter-sources.ts`             | Chapter-source linking eliminated entirely           |
| Chapter-source linking (concept)            | All link/unlink UI and endpoints                   | Both personas found it confusing; invisible outcomes |
| Sheet stacking (z-50/z-60 layering)         | `editor-dialogs.tsx`                               | Replaced by inline view replacement within panel     |
| ~50 EditorDialogsProps source-related props | `editor-dialogs.tsx`                               | Replaced by `ResearchPanelProvider` context          |

### What Was Added

| Component/Concept         | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| Research Panel            | Unified right-hand panel with tab navigation                     |
| Sources tab               | Source list, search, inline add flow, inline detail view         |
| Ask tab                   | AI natural-language query with streaming cited results           |
| Clips tab                 | Saved snippet board with chapter tagging and insertion           |
| Trust messaging           | "Your originals are never changed" during source addition        |
| First-use nudge           | One-time tooltip on Research toolbar button                      |
| Always-visible search     | Search field in Source Detail View regardless of document length |
| Chapter tag on clips      | Optional chapter association when saving clips                   |
| Back-to-origin breadcrumb | "Back to Ask" / "Back to Clips" after cross-tab navigation       |
| `ResearchPanelProvider`   | Context provider encapsulating all panel state                   |

---

## 4. Mental Model

### The User's Words

**How Diane describes what this does:**

> "The right panel is my research workspace. The Sources tab is my bookshelf -- all my Google Docs are there and I can open any of them to read alongside my writing. The Ask tab is my research assistant -- I type a question and it finds the answer in my documents and tells me exactly where it came from. The Clips tab is my sticky notes -- passages I've saved from my research that I can drop into my chapter with one tap, and it adds the footnote for me."

**How Marcus describes what this does:**

> "It's a three-part research pipeline. Sources are raw materials -- I browse and add documents from my Drive. Ask is the query interface -- I search across all my documents at once, which I couldn't do before without opening each one individually. Clips are curated outputs -- the useful excerpts I've pulled from my research, tagged by chapter so I can find them when I'm writing each section."

### Technical Mapping

| User's mental model                    | Technical component                         | Data store                                                   |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| "My bookshelf" (Sources tab)           | `SourcesTab` + `SourceCard` list            | `source_materials` table (D1) + content cache (R2)           |
| "Open a document" (Source Detail View) | `SourceDetailView` reading from R2          | `sources/{sourceId}/content.html` (R2)                       |
| "Add from my Drive" (Source Add Flow)  | `SourceAddFlow` using Drive API             | Google Drive API + `source_materials` (D1)                   |
| "Ask a question" (Ask tab)             | `AskTab` > `POST /research/query`           | Source content (R2) > LLM > SSE stream                       |
| "It found the answer" (Result card)    | `ResultCard` displaying parsed LLM response | Ephemeral (not stored; query metadata in `research_queries`) |
| "Save for later" (Save to Clips)       | `POST /research/clips`                      | `research_clips` table (D1)                                  |
| "My sticky notes" (Clips tab)          | `ClipsTab` + `ClipCard` list                | `research_clips` table (D1)                                  |
| "Drop it in with a footnote" (Insert)  | `SnippetInsertButton` > Tiptap commands     | Tiptap blockquote node + footnote node > Drive write-through |
| "Tag it for Chapter 4" (Chapter tag)   | `chapter_id` field on `research_clips`      | `research_clips.chapter_id` (D1)                             |

---

## 5. Interaction Flows

All flows revised based on stress test feedback. YELLOW resolutions are called out explicitly.

### Flow 1: Add Source from Google Drive

**Precondition:** Research Panel is open with Sources tab active.

| Step | Action                                                                                                                                                                   | Surface            | Taps           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | -------------- |
| 1    | Tap [+ Add] button in Sources tab header (or "Add Source" in empty state)                                                                                                | Sources tab        | 1              |
| 2    | **Source Type Picker** replaces source list. **Trust line visible.** Shows source types: Google Drive, Local Files, plus coming-soon types (iCloud Drive, Dropbox, etc.) | Source Type Picker | 0 (transition) |
| 3    | Tap "Google Drive" row                                                                                                                                                   | Source Type Picker | 1              |
| 3a   | **If 0 Google accounts connected:** OAuth flow initiates. On return, Drive browser opens automatically.                                                                  | OAuth / Browser    | 0 (redirect)   |
| 3b   | **If 1 Google account connected:** Drive browser opens immediately for that account.                                                                                     | Source Add Flow    | 0 (transition) |
| 3c   | **If 2+ Google accounts connected:** Account picker appears. User taps an account, then Drive browser opens. A "Connect another Google account" option is available.     | Source Add Flow    | 1              |
| 4    | Inline Drive browser appears. Shows root of user's Drive.                                                                                                                | Source Add Flow    | 0 (transition) |
| 5    | Navigate into target folder                                                                                                                                              | Source Add Flow    | 1-3 per level  |
| 6    | Tap checkbox on each Google Doc to select                                                                                                                                | Source Add Flow    | 1 per file     |
| 7    | Tap "Add N Selected" footer button                                                                                                                                       | Source Add Flow    | 1              |
| 8    | View transitions back to source list showing new sources with "Processing..." status                                                                                     | Sources tab        | 0 (transition) |

**Total: 5-9 taps across a single surface.**

**The Source Type Picker is the entry point for ALL source addition.** It is never bypassed. Whether the user clicks "Add Source" from the empty state or "+ Add" from a populated library, they always see the Source Type Picker first. See [Sources Tab Empty State & Source Type Picker](#sources-tab-empty-state--source-type-picker-settled) for the full specification.

**Stress test resolution -- Trust line (YELLOW from Scenario A, Top 3 Change #1):** Step 2 includes the trust message "Your originals are never changed" visible above the source type list. This is always present, not just on first use.

```
STEP 2: Source Type Picker with trust messaging
+-----------------------------------+
|  SOURCES                          |
|  [< Library]  Add Source          |
|  ================================ |
|  DraftCrane reads your files to   |
|  help you search and reference    |
|  them. Your originals are never   |
|  changed.                         |
|  -------------------------------- |
|  Choose a source type:            |
|                                   |
|  +-------------------------------+|
|  | 🔵 Google Drive               ||
|  | Browse and add documents      ||
|  | from your Google Drive    [>] ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | 📁 Local Files                ||
|  | Upload documents from         ||
|  | this device              [>] ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | ☁️  iCloud Drive        SOON  ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | 📦 Dropbox              SOON  ||
|  +-------------------------------+|
+-----------------------------------+
```

**Error states:**

- **Drive API error:** Inline error banner: "Could not access Google Drive. Please try again." with Retry.
- **File already added:** Checkmark badge, disabled checkbox, "Already in your sources" label.
- **Network failure during add:** Source card shows "Error -- could not process" with Retry/Remove.

**iPad notes:**

- All touch targets minimum 44pt height.
- Checkboxes: 44x44pt tap area (visually 24x24px icon).
- Folder rows: full-width tap targets.
- "Add Selected" footer: 48pt height, full width, sticky at bottom.

---

### Flow 2: Add Source from Local Device

**Precondition:** Research Panel is open with Sources tab active.

| Step | Action                                                             | Surface            | Taps |
| ---- | ------------------------------------------------------------------ | ------------------ | ---- |
| 1    | Tap [+ Add] in Sources tab header (or "Add Source" in empty state) | Sources tab        | 1    |
| 2    | Source Type Picker appears with trust line                         | Source Type Picker | 0    |
| 3    | Tap "Local Files" row                                              | Source Type Picker | 1    |
| 4    | iOS/iPadOS file picker opens (system UI)                           | System file picker | 0    |
| 5    | Navigate to and select file(s)                                     | System file picker | 2-4  |
| 6    | File picker closes. Source appears with "Processing..." spinner.   | Sources tab        | 0    |

**Total: 5-8 taps across 2 surfaces (Sources tab + system file picker).**

**Error states:**

- **Unsupported file type:** "Unsupported file format" with Remove action.
- **File too large:** "File too large (max 5MB)" with Remove action.
- **Upload fails:** "Upload failed" with Retry and Remove.
- **Text extraction fails:** "Could not extract text" with Remove.

---

### Flow 3: View a Source While Writing

**Precondition:** Research Panel open, Sources tab active, at least one source.

| Step | Action                                                                                          | Surface                     | Taps           |
| ---- | ----------------------------------------------------------------------------------------------- | --------------------------- | -------------- |
| 1    | Tap a source card in the source list                                                            | Sources tab                 | 1              |
| 2    | Source Detail View replaces source list. Content loads. **Search field always visible at top.** | Source Detail View          | 0 (transition) |
| 3    | User reads source content. In landscape, editor visible to left.                                | Source Detail View + Editor | 0              |
| 4    | Tap [< Sources] to return to list                                                               | Source Detail View          | 1              |

**Total: 2 taps.**

**Stress test resolution -- Always-visible search (Top 3 Change #2):** The original design showed a search field only for documents over 10,000 words. The stress test found this too high -- users wanted search at 2,000-3,000 words. The search field is now always visible in the Source Detail View header, regardless of document length. It performs instant-filter search within the displayed content.

```
STEP 2: Source Detail View with always-visible search
+--------+---------------------------+-------------------+
| Sidebar| Editor                    |  RESEARCH         |
|        |                           |  [< Sources]      |
|        | Chapter 4: Case Studies   |  Interview-S.doc  |
|        |                           |  1,240w | 2h ago  |
|        | Lorem ipsum dolor sit     |  [Search in doc.] |
|        | amet, consectetur...      |  ================ |
|        |                           |                   |
|        | adipiscing elit. Sed do   |  The key insight   |
|        | eiusmod tempor incididunt |  from our conver-  |
|        | ut labore et dolore magna |  sation was that   |
|        | aliqua.                   |  leadership in     |
|        |                           |  distributed teams |
|        |                           |  requires funda-   |
|        |                           |  mentally differ-  |
|        |                           |  ent approaches... |
|        |                           |                    |
|        |                           |  [Import as Ch.]   |
+--------+---------------------------+-------------------+
```

**Error states:**

- **Content not cached:** Loading spinner; if Drive API fails, "Could not load content" with Retry/Back.
- **Account disconnected:** "This source's Google account has been disconnected. Reconnect to view content."

**iPad notes:**

- Landscape: editor visible alongside panel. Core value proposition.
- Portrait: panel is overlay. User cannot see editor while viewing source. [< Sources] and panel close are primary navigation.
- Text selection via long-press. Selected text shows "Save to Clips" in floating toolbar.
- Scroll position preserved when switching tabs; lost when navigating back to list.

---

### Flow 4: Search Sources with Natural Language Query

**Precondition:** Research Panel open, at least one source with cached content.

| Step | Action                                                                        | Surface                | Taps       |
| ---- | ----------------------------------------------------------------------------- | ---------------------- | ---------- |
| 1    | Tap "Ask" tab                                                                 | Research Panel tab bar | 1          |
| 2    | Ask tab shows input at bottom and suggested queries (or conversation history) | Ask tab                | 0          |
| 3    | Tap input field. Keyboard appears.                                            | Ask tab                | 1          |
| 4    | Type natural-language question                                                | Ask tab                | 0 (typing) |
| 5    | Tap Send (or Cmd+Return)                                                      | Ask tab                | 1          |
| 6    | Loading: "Searching across N sources..."                                      | Ask tab                | 0          |
| 7    | AI response streams in. Result cards appear with cited passages.              | Ask tab                | 0          |

**Total: 3 taps + typing.**

```
STEP 7: AI response with result cards
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

- **No sources in project:** "Add source documents first." with "Go to Sources" link.
- **No cached content:** "Your sources haven't been processed yet. Try again in a moment."
- **AI query fails:** "Something went wrong. Please try again." with Retry.
- **No results:** "I couldn't find relevant information about that in your sources. Try rephrasing."
- **Slow (>5s):** Skeleton loader with "Searching across N sources..."
- **Streaming interrupted:** Partial response with "Response was interrupted. Tap to retry."

**iPad notes:**

- Input at bottom (iMessage/chat pattern). Keyboard pushes conversation up via `visualViewport` API.
- Send button: 44x44pt minimum. Disabled when input empty.
- Suggested queries: tappable full-width rows (44pt height). Tap populates input and auto-submits.
- External keyboard: Cmd+Return submits.
- Result card action buttons: 44pt minimum touch targets.

---

### Flow 5: Save a Snippet from Search Results

**Path A: Save from AI result (1 tap)**

| Step | Action                                                                                              | Surface         | Taps |
| ---- | --------------------------------------------------------------------------------------------------- | --------------- | ---- |
| 1    | Tap "Save to Clips" on a result card                                                                | Ask tab         | 1    |
| 2    | **Optional chapter tag popup: "Save to: [All] [Ch. 1] [Ch. 2]..."** Defaults to "All" if dismissed. | Inline dropdown | 0-1  |
| 3    | Button changes to checkmark "Saved." Clips tab badge increments.                                    | Ask tab         | 0    |

**Path B: Save from Source Detail View (2-3 taps)**

| Step | Action                                                                                                        | Surface            | Taps |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------ | ---- |
| 1    | Long-press on text to select                                                                                  | Source Detail View | 1    |
| 2    | Adjust selection handles                                                                                      | Source Detail View | 0-2  |
| 3    | **Floating toolbar appears with "Copy" and "Save to Clips" -- both prominently labeled, full-height buttons** | Floating toolbar   | 0    |
| 4    | Tap "Save to Clips"                                                                                           | Floating toolbar   | 1    |
| 5    | Toast: "Saved to Clips." Clips badge increments.                                                              | Source Detail View | 0    |

**Stress test resolution -- Text selection discoverability (YELLOW, Flow 5):** The floating toolbar now uses full-height (44pt) labeled buttons rather than small text links. "Save to Clips" is visually prominent alongside the system "Copy" action. Additionally, the Source Detail View shows a subtle hint below the content: "Tip: Select text to save passages to Clips." This hint appears only on the first 3 source views, then disappears.

**Stress test resolution -- Chapter tagging for power users (YELLOW from Flow 8, Marcus RED):** When saving a clip, an optional chapter tag dropdown appears briefly. It defaults to "All chapters" and auto-dismisses after 2 seconds if not interacted with. Users who want to tag (Marcus) can tap a chapter; users who want simplicity (Diane) can ignore it.

**Error states:**

- **Clip already saved:** Button shows "Already saved" -- no-op with feedback.
- **API fails:** Toast: "Could not save clip. Please try again." Button reverts.

---

### Flow 6: Insert a Snippet into the Editor

**Path A: Insert from Clips tab (2 taps)**

| Step | Action                                                                           | Surface                | Taps |
| ---- | -------------------------------------------------------------------------------- | ---------------------- | ---- |
| 1    | Tap "Clips" tab                                                                  | Research Panel tab bar | 1    |
| 2    | Tap "Insert" on a clip card                                                      | Clips tab              | 1    |
| 3    | Text inserted at cursor. Footnote auto-created. Toast: "Inserted with footnote." | Editor + Clips tab     | 0    |

**Path B: Insert from AI result (1 tap)**

| Step | Action                                                                  | Surface          | Taps |
| ---- | ----------------------------------------------------------------------- | ---------------- | ---- |
| 1    | Tap "Insert" on a result card                                           | Ask tab          | 1    |
| 2    | Text inserted at cursor with footnote. Toast: "Inserted with footnote." | Editor + Ask tab | 0    |

**Stress test resolution -- iPad cursor position uncertainty (YELLOW, Flow 6):** The editor stores its last known cursor position in a ref (`lastSelectionRef`) that persists even when the editor loses focus to the Research Panel. On insert:

1. If the editor has a valid stored selection, insert at that position.
2. If no stored selection exists, append to the end of the chapter content with a toast: "Inserted at end of chapter."
3. The insert action calls `editor.commands.focus()` **without** triggering the software keyboard. On iPad, this uses `editor.commands.focus(null, { scrollIntoView: true })` with a `requestAnimationFrame` wrapper to prevent viewport jumping.
4. The blockquote + footnote insertion is a single Tiptap transaction, ensuring undo removes both together.

**Fallback for no cursor:** If no chapter is selected, the Insert button is disabled with tooltip "Select a chapter to insert into."

```
AFTER INSERT:
+--------+---------------------------+-------------------+
| Sidebar| Editor                    |  RESEARCH         |
|        |                           |  Sources Ask [Clips]
|        | Chapter 4: Case Studies   |  ================ |
|        |                           |                   |
|        | Teams that invest in      |  "Psychological   |
|        | coaching see measurable   |  safety was the   |
|        | returns. "Psychological   |  strongest..."    |
|        | safety was the strongest  |  -- Workshop Notes|
|        | predictor of team per-    |  [Inserted] [Del] |
|        | formance, with 67% of    |                   |
|        | teams reporting meas-     |                   |
|        | urable improvement." [1]  |                   |
|        |                           |                   |
|        | ---                       |                   |
|        | [1] Workshop Notes March  |                   |
|        |     2024                  |                   |
+--------+---------------------------+-------------------+
```

---

### Flow 7: Remove a Source

| Step | Action                                                                                                                                                                                            | Surface                 | Taps |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---- |
| 1    | Swipe left on source card (or tap "..." overflow)                                                                                                                                                 | Sources tab             | 1    |
| 2    | Tap "Remove" (red text)                                                                                                                                                                           | Source card action area | 1    |
| 3    | Confirmation dialog: "Remove [Title]? This removes the source from your project. The original file in Google Drive is not affected. Related clips will keep their text but lose the source link." | Center dialog           | 0    |
| 4    | Tap "Remove" in dialog                                                                                                                                                                            | Center dialog           | 1    |
| 5    | Source fades out. Clips retain text with "[Source removed]" reference.                                                                                                                            | Sources tab             | 0    |

**Total: 3 taps (including confirmation).**

---

### Flow 8: Browse Collected Snippets on Research Board

| Step | Action                                                                                                                | Surface                | Taps |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---- |
| 1    | Tap "Clips" tab. Badge shows count.                                                                                   | Research Panel tab bar | 1    |
| 2    | Clips tab shows all saved clips. **Chapter filter dropdown at top: "All Chapters" / "Chapter 1" / "Chapter 2" / ...** | Clips tab              | 0    |
| 3    | Scroll and review clips.                                                                                              | Clips tab              | 0    |
| 4    | (Optional) Tap source title on a clip                                                                                 | Clip card              | 1    |
| 5    | **Sources tab opens with Source Detail View. A "Back to Clips" breadcrumb appears at top.**                           | Source Detail View     | 0    |
| 6    | Tap "Back to Clips" to return                                                                                         | Source Detail View     | 1    |

**Stress test resolution -- Flat clip list scaling (YELLOW, Flow 8; RED for Marcus):** Two changes:

1. **Chapter filter:** A dropdown at the top of the Clips tab filters clips by chapter tag. Options: "All Chapters" (default), then each chapter in the project. This gives Marcus the chapter-level organization he needs without adding complexity for Diane (who can leave it on "All").

2. **Cross-tab breadcrumb:** When navigating from Clips to a source detail, a "Back to Clips" breadcrumb replaces the standard "< Sources" back button. This eliminates the cross-tab disorientation identified in the stress test. The breadcrumb returns the user to the Clips tab with their previous filter and scroll position preserved.

```
STEP 2: Clips tab with chapter filter
+-----------------------------------+
|  RESEARCH                         |
|  Sources  Ask  [Clips (12)]  [x] |
|  ================================ |
|  [All Chapters  v]               |
|  [Search clips...]               |
|                                   |
|  +-------------------------------+|
|  | "Psychological safety was the ||
|  | strongest predictor of team   ||
|  | performance..."               ||
|  |                               ||
|  | Workshop Notes March 2024     ||
|  | Ch. 4 | Saved 2h ago          ||
|  | [Insert]           [Delete]   ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | "Q4 results showed a 23%     ||
|  | increase in leadership        ||
|  | effectiveness scores..."      ||
|  |                               ||
|  | Q4-Report.doc                 ||
|  | Ch. 6 | Saved 1d ago          ||
|  | [Insert]           [Delete]   ||
|  +-------------------------------+|
+-----------------------------------+
```

**Stress test resolution -- Research session organization (YELLOW, Scenario C):** The chapter filter, combined with the chapter tag on save (Flow 5), enables organized research sessions. Marcus can filter to "Chapter 4," see only clips tagged for that chapter, and work systematically through his research for each section.

---

### First-Use Experience

**Stress test resolution -- Panel discoverability gap (YELLOW, Scenario A; Top 3 Change #3):**

When a user first opens a project that has no sources, a one-time tooltip appears on the Research toolbar button:

```
+--------------------------------------------------+
| Editor toolbar:  B  I  U  ...  [Research]        |
|                                      |            |
|                                 +----v---------+ |
|                                 | Have research | |
|                                 | files? Tap    | |
|                                 | here to bring | |
|                                 | them in.      | |
|                                 +---------------+ |
+--------------------------------------------------+
```

The tooltip:

- Appears once per project, only when the project has zero sources.
- Dismisses on tap anywhere, or after 8 seconds.
- Uses a pulsing dot indicator on the Research button that persists until the panel is opened for the first time.
- Is stored in `localStorage` per project: `research-nudge-dismissed-{projectId}`.

Additionally, the Sources tab empty state provides clear guidance:

> "No sources yet. Add your Google Docs, PDFs, or other research files to search and reference them while you write."

### Sources Tab Empty State & Source Type Picker (SETTLED)

**This is a settled design decision. Do not deviate.**

When the Library tab has no documents, the empty state shows a single **"Add Source"** CTA. This CTA opens the **Source Type Picker** — the first step of the Source Add Flow. The empty state does NOT show "Connect Google Drive" as a hardcoded primary action. It does NOT show individual source types inline. It shows one button: "Add Source."

**Why:** DraftCrane supports multiple source types today (Google Drive, Local Files) and will support more in the future (iCloud Drive, Dropbox, Box, OneDrive). Hardcoding "Connect Google Drive" in the empty state:

1. Creates a Google Drive-centric UX that ignores Local Files as a first-class source type
2. Makes adding future source types a UI redesign instead of a list addition
3. Confuses users who don't use Google Drive

**Empty state wireframe:**

```
+-----------------------------------+
|  SOURCES                          |
|  Library  Review  Assist     [x]  |
|  ================================ |
|                                   |
|          📖                       |
|                                   |
|   Add documents to help with      |
|   your writing                    |
|                                   |
|   Bring in Google Docs, PDFs,     |
|   or other files to search and    |
|   reference while you write.      |
|                                   |
|      [ Add Source ]               |
|                                   |
+-----------------------------------+
```

Tapping "Add Source" opens the Source Type Picker:

```
+-----------------------------------+
|  SOURCES                          |
|  [< Library]  Add Source          |
|  ================================ |
|  DraftCrane reads your files to   |
|  help you search and reference    |
|  them. Your originals are never   |
|  changed.                         |
|  -------------------------------- |
|  Choose a source type:            |
|                                   |
|  +-------------------------------+|
|  | 🔵 Google Drive               ||
|  | Browse and add documents      ||
|  | from your Google Drive    [>] ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | 📁 Local Files                ||
|  | Upload documents from         ||
|  | this device              [>] ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | ☁️  iCloud Drive        SOON  ||
|  +-------------------------------+|
|                                   |
|  +-------------------------------+|
|  | 📦 Dropbox              SOON  ||
|  +-------------------------------+|
|                                   |
+-----------------------------------+
```

**Source Type Picker rules:**

1. **Supported types** (Google Drive, Local Files) are tappable full-width rows with icon, label, description, and chevron.
2. **Coming soon types** (iCloud Drive, Dropbox, Box, OneDrive) are visually distinct (grayed out, "SOON" badge). They are not tappable. They signal extensibility without false promises.
3. **Google Drive** row: if the user already has a connected Google account, tapping goes straight to the Drive browser for that account. If 2+ accounts, shows account picker. If 0 accounts, initiates OAuth.
4. **Local Files** row: tapping opens the system file picker directly.
5. Adding a new source type in the future means adding one row to this list. No empty-state redesign, no new flow.

**Source Type data model (frontend only):**

```typescript
interface SourceType {
  id: string; // "google-drive" | "local-files" | "icloud" | "dropbox" | "box" | "onedrive"
  label: string; // "Google Drive"
  description: string; // "Browse and add documents from your Google Drive"
  icon: ReactElement;
  status: "available" | "coming_soon";
  onSelect: () => void; // Only for "available" types
}
```

**After connecting a Google Drive account (or after adding any source):**

The Library tab shows the project's documents list with an "+ Add" button in the header. Tapping "+ Add" reopens the Source Type Picker — not a hardcoded Drive browser.

**This replaces the hardcoded "Connect Google Drive" / "Upload from this device" two-button pattern in the current implementation.** Any code that renders the empty state with provider-specific buttons is wrong and must be updated to show the single "Add Source" CTA → Source Type Picker flow.

---

## 6. Panel Specifications

### Landscape Layout (1024pt+ viewport width)

```
+--------+------------------------------------------+------------------+
| Sidebar| Editor                                   | Research Panel   |
| 260pt  | flex (min 400pt)                         | 340pt            |
+--------+------------------------------------------+------------------+
```

| Element         | Width            | Constraints                                                                         |
| --------------- | ---------------- | ----------------------------------------------------------------------------------- |
| Chapter Sidebar | 260pt fixed      | Collapsible to 0pt. When collapsed, editor expands.                                 |
| Editor          | Flex (remaining) | **Minimum 400pt.** If panel would push below 400pt, panel opens as overlay instead. |
| Research Panel  | 340pt fixed      | Opens from right. Pushes editor left (does not overlay).                            |

**Device-specific viability:**

| Device       | Orientation | Viewport | Sidebar | Editor | Research | Mode         |
| ------------ | ----------- | -------- | ------- | ------ | -------- | ------------ |
| iPad Air 11" | Landscape   | 1180pt   | 260pt   | 580pt  | 340pt    | Side-by-side |
| iPad Air 11" | Portrait    | 820pt    | 260pt   | 220pt  | 340pt    | **Overlay**  |
| iPad Pro 13" | Landscape   | 1366pt   | 260pt   | 766pt  | 340pt    | Side-by-side |
| iPad Pro 13" | Portrait    | 1024pt   | 260pt   | 424pt  | 340pt    | Side-by-side |
| iPad Mini 6  | Landscape   | 1133pt   | 260pt   | 533pt  | 340pt    | Side-by-side |
| iPad Mini 6  | Portrait    | 744pt    | 260pt   | 144pt  | 340pt    | **Overlay**  |

**Sidebar auto-collapse:** When the Research Panel is open and the sidebar is also visible, if the editor width falls below 400pt, the sidebar auto-collapses. When the panel closes, the sidebar restores.

### Portrait Layout (768pt-1023pt viewport width)

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

| Element        | Width               | Behavior                                          |
| -------------- | ------------------- | ------------------------------------------------- |
| Research Panel | 85% of viewport     | Overlay from right. Editor dimmed behind.         |
| Backdrop       | 15% visible on left | Tapping dismisses panel. Visual "peek" at editor. |

**Overlay behavior:**

- Slides in from right over 200ms (`ease-out`). Backdrop fades in (`bg-black/30`).
- Closes: slides out over 150ms (`ease-in`). Backdrop fades out.
- Swipe-right on panel (delta > 60pt) dismisses.
- `prefers-reduced-motion`: instant appear/disappear.

### Desktop Layout (1200pt+)

Identical to landscape iPad but with more editor space. No additional desktop-specific patterns in initial implementation. Panel resizing (300pt-480pt drag handle) is a Phase C+ enhancement, hidden on touch devices.

### Responsive Breakpoints

| Breakpoint     | Behavior                                                     |
| -------------- | ------------------------------------------------------------ |
| < 768pt        | Research Panel always overlay (full-screen). Sidebar hidden. |
| 768pt - 1023pt | Research Panel overlay (85% width). Sidebar visible.         |
| 1024pt+        | Research Panel side-by-side (340pt). Sidebar visible.        |

### Animation Specifications

| Animation                                | Duration      | Easing                 | Reduced Motion |
| ---------------------------------------- | ------------- | ---------------------- | -------------- |
| Panel slide open                         | 200ms         | `ease-out`             | Instant (0ms)  |
| Panel slide close                        | 150ms         | `ease-in`              | Instant (0ms)  |
| Backdrop fade in                         | 200ms         | `ease-out`             | Instant        |
| Backdrop fade out                        | 150ms         | `ease-in`              | Instant        |
| Inline view transition (list <-> detail) | 150ms         | `ease-in-out`          | Instant        |
| Source card fade-out (on remove)         | 200ms         | `ease-out`             | Instant        |
| Toast appear/disappear                   | 150ms / 300ms | `ease-out` / `ease-in` | Instant        |

### Safe Area Handling

```css
.research-panel {
  padding-right: env(safe-area-inset-right, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.research-panel-overlay {
  height: 100dvh; /* NOT 100vh -- accounts for Safari address bar */
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

---

## 7. Component Specifications

### ResearchPanel

- **Name:** `ResearchPanel`
- **Type:** New
- **Location:** `web/src/components/research/research-panel.tsx`
- **Purpose:** Top-level container. Tab navigation shell + panel open/close.

```typescript
interface ResearchPanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (text: string, sourceTitle: string, sourceId: string | null) => void;
  canInsert: boolean;
}
```

**States:** Closed, Open/Sources, Open/Ask, Open/Clips

**Accessibility:**

- `role="complementary"` with `aria-label="Research panel"`
- Tab bar: `role="tablist"`, tabs: `role="tab"` with `aria-selected`
- Tab panels: `role="tabpanel"` with `aria-labelledby`
- Escape closes panel
- Focus trap in overlay mode (portrait)

---

### SourcesTab

- **Name:** `SourcesTab`
- **Type:** New
- **Location:** `web/src/components/research/sources-tab.tsx`
- **Purpose:** Source list with search, inline add flow, inline detail view.

```typescript
interface SourcesTabProps {
  projectId: string;
}
```

**States:** List (default), Detail view, Add view, Loading, Empty, Error

**Accessibility:**

- `role="list"` with `role="listitem"` per card
- Search: `aria-label="Search sources"`, `aria-live="polite"` for result count
- Empty state with guidance text

---

### AskTab

- **Name:** `AskTab`
- **Type:** New
- **Location:** `web/src/components/research/ask-tab.tsx`
- **Purpose:** AI natural-language query with streaming results.

```typescript
interface AskTabProps {
  projectId: string;
  onSaveClip: (clip: {
    content: string;
    sourceId: string | null;
    sourceTitle: string;
    sourceLocation: string | null;
    chapterId?: string;
  }) => Promise<void>;
  onInsertSnippet: (text: string, sourceTitle: string, sourceId: string | null) => void;
  canInsert: boolean;
}
```

**States:** Empty (suggested queries), Input focused, Loading, Results, Conversation (multi-Q&A), Error, No sources

**Accessibility:**

- Query input: `aria-label="Ask about your sources"`
- Submit: `aria-label="Submit query"` / `aria-label="Searching..."`
- Responses: `aria-live="polite"`
- Loading: `aria-busy="true"`

---

### ClipsTab

- **Name:** `ClipsTab`
- **Type:** New
- **Location:** `web/src/components/research/clips-tab.tsx`
- **Purpose:** Saved snippet board with chapter filter, search, insert, delete.

```typescript
interface ClipsTabProps {
  projectId: string;
  chapters: Array<{ id: string; title: string }>;
  onInsertSnippet: (text: string, sourceTitle: string, sourceId: string | null) => void;
  canInsert: boolean;
}
```

**States:** Empty, List, Searching, Chapter-filtered

**Accessibility:**

- `role="list"` with `role="listitem"` per card
- Chapter filter: `aria-label="Filter clips by chapter"`
- Search: `aria-label="Search clips"`
- Insert: `aria-label="Insert into chapter with footnote"`

---

### SourceCard

- **Name:** `SourceCard`
- **Type:** New (replaces current source rows)
- **Location:** `web/src/components/research/source-card.tsx`

```typescript
interface SourceCardProps {
  source: SourceMaterial;
  onTap: () => void;
  onRemove: () => void;
  onImportAsChapter: () => void;
}
```

**States:** Normal, Processing, Error, Archived (account disconnected)

**Accessibility:** Card is `button` (entire card tappable). Overflow: `aria-haspopup="menu"`. Min height 56pt, min tap target 44pt.

---

### SourceAddFlow

- **Name:** `SourceAddFlow`
- **Type:** New (replaces `AddSourceSheet` + `DriveBrowserSheet`)
- **Location:** `web/src/components/research/source-add-flow.tsx`

```typescript
interface SourceAddFlowProps {
  projectId: string;
  driveAccounts: DriveAccount[];
  onSourcesAdded: () => void;
  onBack: () => void;
  onConnectAccount: () => void;
}
```

**States:** Source type selection (with trust message), Account selection (Google Drive, 2+ accounts), Drive browsing, Uploading, Adding

**The first state is always Source Type Picker.** This is the entry point for all source addition — from the empty state "Add Source" button and from the populated library "+ Add" button. The Source Type Picker shows all supported source types (Google Drive, Local Files) and coming-soon types (iCloud Drive, Dropbox, Box, OneDrive).

**Key requirement:** Trust message "DraftCrane reads your files to help you search and reference them. Your originals are never changed." visible in the Source Type Picker view (above the type list).

---

### SourceDetailView

- **Name:** `SourceDetailView`
- **Type:** New (replaces `SourceViewerSheet`)
- **Location:** `web/src/components/research/source-detail-view.tsx`

```typescript
interface SourceDetailViewProps {
  sourceId: string;
  title: string;
  onBack: () => void;
  /** Custom back label for cross-tab navigation */
  backLabel?: string;
  onImportAsChapter: (sourceId: string) => void;
  onSaveClip: (clip: {
    content: string;
    sourceId: string;
    sourceTitle: string;
    sourceLocation: string | null;
  }) => Promise<void>;
  /** Optional: scroll to this text position on load */
  scrollToPosition?: number;
}
```

**States:** Loading, Loaded, Error, Search active

**Key requirement:** Search field always visible in header (no word-count threshold). `backLabel` prop enables "Back to Clips" / "Back to Ask" breadcrumbs for cross-tab navigation.

---

### QueryInput

- **Name:** `QueryInput`
- **Type:** New
- **Location:** `web/src/components/research/query-input.tsx`

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

**States:** Empty, Focused, Has value, Loading, Disabled

**Key requirements:** `enterkeyhint="send"`, minimum 16px font size, 48pt container height.

---

### ResultCard

- **Name:** `ResultCard`
- **Type:** New
- **Location:** `web/src/components/research/result-card.tsx`

```typescript
interface ResultCardProps {
  content: string;
  sourceTitle: string;
  sourceId: string | null;
  sourceLocation: string | null;
  onSaveToClips: () => void;
  onInsert: () => void;
  onViewSource: () => void;
  isSaved: boolean;
  canInsert: boolean;
}
```

**States:** Default, Saved ("Save to Clips" becomes checkmark), Insert disabled

**Key requirement:** Source title is a tappable link (navigates to Source Detail View). Text is selectable.

---

### ClipCard

- **Name:** `ClipCard`
- **Type:** New
- **Location:** `web/src/components/research/clip-card.tsx`

```typescript
interface ClipCardProps {
  clip: ResearchClip;
  onInsert: () => void;
  onDelete: () => void;
  onViewSource: () => void;
  canInsert: boolean;
}
```

**States:** Default, Expanded (full text), Inserted indicator, Source removed

**Key requirement:** Shows chapter tag if assigned. Source title tappable. Truncated at 300 chars with "Show more."

---

### SnippetInsertButton

- **Name:** `SnippetInsertButton`
- **Type:** New
- **Location:** `web/src/components/research/snippet-insert-button.tsx`

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

**States:** Default ("Insert"), Disabled, Success ("Inserted" -- 1.5s, then reverts)

**Key requirement:** 44pt minimum tap target. `aria-label="Insert quote into chapter with footnote"`.

---

### ResearchPanelProvider

- **Name:** `ResearchPanelProvider`
- **Type:** New
- **Location:** `web/src/components/research/research-panel-provider.tsx`

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

  // Source navigation
  sourcesView: "list" | "detail" | "add";
  activeSourceId: string | null;
  viewSource: (sourceId: string) => void;
  backToSourceList: () => void;
  startAddFlow: () => void;

  // Cross-tab navigation
  returnTab: "ask" | "clips" | null;
  navigateToSourceFromTab: (sourceId: string, returnTo: "ask" | "clips") => void;
  returnToPreviousTab: () => void;

  // Clips
  clips: ResearchClip[];
  isClipsLoading: boolean;
  saveClip: (clip: Omit<ResearchClip, "id" | "createdAt">) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  clipCount: number;
}
```

---

### FirstUseNudge

- **Name:** `FirstUseNudge`
- **Type:** New
- **Location:** `web/src/components/research/first-use-nudge.tsx`

```typescript
interface FirstUseNudgeProps {
  projectId: string;
  hasAnySources: boolean;
  isResearchPanelOpen: boolean;
  targetRef: React.RefObject<HTMLButtonElement>;
}
```

**Purpose:** Shows tooltip on Research toolbar button when project has no sources and panel has never been opened. Persists pulsing dot until first panel open.

**Storage:** `localStorage` key: `research-nudge-dismissed-{projectId}`

---

## 8. Data Model Changes

### New Tables

#### research_clips

```sql
-- Migration: 0014_create_research_clips.sql

CREATE TABLE research_clips (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES source_materials(id) ON DELETE SET NULL,
  source_title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_location TEXT,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_research_clips_project ON research_clips(project_id);
CREATE INDEX idx_research_clips_source ON research_clips(source_id);
CREATE INDEX idx_research_clips_chapter ON research_clips(chapter_id);

-- Dedup: same content + source within a project
CREATE UNIQUE INDEX idx_research_clips_dedup
  ON research_clips(project_id, source_id, content)
  WHERE source_id IS NOT NULL;
```

**Key decisions:**

- `source_id` uses `ON DELETE SET NULL` -- removing a source preserves the clip text and title.
- `source_title` stored redundantly so clips display the title even after source removal.
- `chapter_id` is nullable -- clips can be untagged ("All chapters") or tagged to a specific chapter. Uses `ON DELETE SET NULL` so deleting a chapter unlinks but preserves the clip.
- `content` max 10KB enforced at API level.
- `source_location` is a human-readable reference ("Section 3", "Near beginning"), not a byte offset.

#### research_queries (Phase B)

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

- AI responses are NOT stored. They are ephemeral/streamed. Users save what they want as clips.
- Only query text and metadata stored for conversation history and analytics.

#### source_content_fts (Phase A)

```sql
-- Migration: 0016_create_source_content_fts.sql

CREATE VIRTUAL TABLE source_content_fts USING fts5(
  source_id,
  title,
  content,
  tokenize='porter unicode61'
);
```

**Key decisions:**

- D1 supports FTS5. Enables fast keyword search in Sources tab without a vector database.
- Populated when source content is cached (after text extraction). Rebuilt on content refresh.
- NOT used for AI queries (AI uses full source text via LLM). FTS is for the Sources tab search.

### Modified Tables

#### source_materials

No schema changes. The text extraction service (#124) will populate `r2_key` and `cached_at` for `.docx` and `.pdf` in addition to existing Google Docs. A plain-text version (`sources/{sourceId}/content.txt`) is also generated for AI queries and FTS indexing.

### Deprecated Tables

#### chapter_sources

```sql
-- Migration: 0017_deprecate_chapter_sources.sql

-- Table preserved for data integrity and potential rollback.
-- Application code stops reading/writing to this table.
-- After 90 days with no issues, a follow-up migration drops the table.
-- No schema changes in this migration.
```

### R2 Storage Patterns

| Data                                      | Key Pattern                         | Notes                                          |
| ----------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| Source content (HTML, for viewer)         | `sources/{sourceId}/content.html`   | Existing, unchanged                            |
| Source content (plain text, for AI + FTS) | `sources/{sourceId}/content.txt`    | **New:** generated during text extraction      |
| Uploaded local files (original)           | `sources/{sourceId}/original.{ext}` | Existing for .txt/.md, extended for .docx/.pdf |

### KV Cache Patterns

No new KV patterns. Existing rate-limit patterns apply to the new research query endpoint (KV sliding window, 20 queries/min/user).

---

## 9. API Specification

### Existing Endpoints -- Disposition

| Endpoint                                             | Disposition | Notes                                                              |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `POST /projects/:projectId/sources`                  | **Keep**    | Add Drive sources. No changes.                                     |
| `POST /projects/:projectId/sources/upload`           | **Modify**  | Expand accepted types to `.docx`, `.pdf`.                          |
| `GET /projects/:projectId/sources`                   | **Keep**    | List project sources. No changes.                                  |
| `GET /sources/:sourceId/content`                     | **Keep**    | Get cached content. No changes.                                    |
| `DELETE /sources/:sourceId`                          | **Modify**  | On delete, set `source_id = NULL` on referencing `research_clips`. |
| `POST /sources/:sourceId/import-as-chapter`          | **Keep**    | No changes.                                                        |
| `GET /chapters/:chapterId/sources`                   | **Remove**  | Chapter-source linking eliminated.                                 |
| `POST /chapters/:chapterId/sources/:sourceId/link`   | **Remove**  | Chapter-source linking eliminated.                                 |
| `DELETE /chapters/:chapterId/sources/:sourceId/link` | **Remove**  | Chapter-source linking eliminated.                                 |

### New Endpoints

#### POST /projects/:projectId/research/query

Natural-language query against project sources. Streams structured results with source citations.

```typescript
// Request
interface ResearchQueryRequest {
  query: string;
  /** Optional: limit search to specific source IDs */
  sourceIds?: string[];
}

// Response (SSE stream, Content-Type: text/event-stream)
//
// event: result
// data: {"content":"...","sourceId":"...","sourceTitle":"...","sourceLocation":"..."}
//
// event: result
// data: {"content":"...","sourceId":"...","sourceTitle":"...","sourceLocation":"..."}
//
// event: done
// data: {"resultCount":2,"processingTimeMs":2340}
//
// event: error
// data: {"error":"...","code":"QUERY_FAILED"}

// Non-streaming fallback (Accept: application/json)
interface ResearchQueryResponse {
  results: Array<{
    content: string;
    sourceId: string;
    sourceTitle: string;
    sourceLocation: string | null;
  }>;
  summary: string;
  processingTimeMs: number;
}
```

**Rate limit:** 20 queries/minute/user (KV sliding window).

**Error codes:**

| Code             | HTTP | Description                                |
| ---------------- | ---- | ------------------------------------------ |
| `NO_SOURCES`     | 400  | Project has no sources with cached content |
| `QUERY_TOO_LONG` | 400  | Query exceeds 1000 characters              |
| `RATE_LIMITED`   | 429  | Exceeded 20 queries/minute                 |
| `AI_UNAVAILABLE` | 503  | LLM service unavailable                    |
| `QUERY_FAILED`   | 500  | Internal error during query processing     |

#### GET /projects/:projectId/research/clips

List saved clips for a project. Supports chapter filtering.

```typescript
// Query params: ?chapterId=xxx (optional, filters by chapter tag)
interface ClipsListResponse {
  clips: Array<{
    id: string;
    projectId: string;
    sourceId: string | null;
    sourceTitle: string;
    content: string;
    sourceLocation: string | null;
    chapterId: string | null;
    chapterTitle: string | null;
    createdAt: string;
  }>;
}
```

#### POST /projects/:projectId/research/clips

Save a new clip.

```typescript
interface SaveClipRequest {
  content: string;
  sourceId?: string;
  sourceTitle: string;
  sourceLocation?: string;
  chapterId?: string;
}

// Response (201 Created, or 200 if duplicate)
interface SaveClipResponse {
  clip: {
    id: string;
    projectId: string;
    sourceId: string | null;
    sourceTitle: string;
    content: string;
    sourceLocation: string | null;
    chapterId: string | null;
    createdAt: string;
  };
}
```

**Deduplication:** If identical `content` + `sourceId` exists for the project, returns existing clip with 200.

#### DELETE /research/clips/:clipId

```typescript
// Response (200)
interface DeleteClipResponse {
  success: boolean;
}
```

**Authorization:** Clip ownership verified via project membership.

#### GET /projects/:projectId/research/sources/search

Full-text search across source content. For Sources tab search field.

```typescript
// Query params: ?q=keyword
interface SourceSearchResponse {
  results: Array<{
    sourceId: string;
    title: string;
    snippet: string;
    position: number;
  }>;
}
```

**Implementation:** D1 FTS5 on `source_content_fts`. Falls back to LIKE if FTS unavailable.

### TypeScript Interfaces (Complete)

```typescript
// === Core Types ===

interface SourceMaterial {
  id: string;
  projectId: string;
  title: string;
  driveFileId: string | null;
  driveConnectionId: string | null;
  mimeType: string;
  wordCount: number | null;
  r2Key: string | null;
  cachedAt: string | null;
  status: "pending" | "processing" | "cached" | "error";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ResearchClip {
  id: string;
  projectId: string;
  sourceId: string | null;
  sourceTitle: string;
  content: string;
  sourceLocation: string | null;
  chapterId: string | null;
  chapterTitle?: string | null;
  createdAt: string;
}

interface AISearchResult {
  content: string;
  sourceId: string | null;
  sourceTitle: string;
  sourceLocation: string | null;
  isSaved: boolean;
}

interface ConversationEntry {
  id: string;
  type: "query" | "response";
  content: string;
  results?: AISearchResult[];
  timestamp: string;
}

interface DriveAccount {
  connectionId: string;
  email: string;
  provider: "google";
}

// === State Types ===

type ResearchTab = "sources" | "ask" | "clips";
type SourcesView = "list" | "detail" | "add";

interface ResearchPanelState {
  isOpen: boolean;
  activeTab: ResearchTab;
  sourcesView: SourcesView;
  activeSourceId: string | null;
  driveConnectionId: string | null;
  returnTab: "ask" | "clips" | null;
}

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

---

## 10. Implementation Phases

### Phase A: Foundation (Sources Tab + Panel Infrastructure)

**Estimated effort:** 2-3 weeks, one developer.

**What ships:** The Research Panel with full Sources tab. Panel replaces all existing source management UI. Ask and Clips tabs show "Coming soon" placeholders. Immediate value: fixes sheet stacking, eliminates chapter-source linking confusion, provides panel infrastructure.

**Components built:**

- `ResearchPanel`, `ResearchPanelProvider`
- `SourcesTab`, `SourceCard`
- `SourceAddFlow` (inline Drive browser + upload + trust message)
- `SourceDetailView` (inline viewer + always-visible search)
- `QueryInput` (reusable -- source search in Phase A, AI query in Phase B)
- `FirstUseNudge`
- Ask/Clips tab placeholders

**Components removed:**

- `SourcesPanel`, `AddSourceSheet`, `DriveBrowserSheet`, `SourceViewerSheet`
- `useChapterSources` hook
- ~50 source-related props from `EditorDialogsProps`

**API changes:**

- Remove 3 chapter-source endpoints
- Add `GET /projects/:projectId/research/sources/search`
- Modify `POST /projects/:projectId/sources/upload` for `.docx`, `.pdf`
- Modify `DELETE /sources/:sourceId` for clip cascade

**DB changes:**

- Migration 0014: `research_clips` table (created early, used in Phase C)
- Migration 0016: `source_content_fts` virtual table
- Migration 0017: `chapter_sources` deprecation

**Ship criteria:**

- [ ] Research Panel opens/closes correctly in landscape and portrait on iPad Air, Pro, Mini
- [ ] Sources tab shows all project sources with search
- [ ] Inline Drive browser works (navigate, select, add)
- [ ] Source Detail View renders content with always-visible search
- [ ] Trust message visible in add flow
- [ ] First-use nudge appears for projects with no sources
- [ ] All touch targets >= 44pt
- [ ] No sheet stacking
- [ ] EditorDialogsProps reduced to <= 5 research-related props
- [ ] Existing auto-save and Drive write-through unaffected

**Risks:**

- `SourceAddFlow` reuses `useDriveBrowser` hook but renders inline. Minor hook adjustments may be needed.
- Removing chapter-source linking is a breaking change for existing users. Phase 0 user count is very low; display a one-time notice.

### Phase B: AI Integration (Ask Tab)

**Estimated effort:** 3-4 weeks, one developer.

**Prerequisite spikes:** #134 (prompt engineering), #135 (doc parsing), #136 (chunking strategy) must complete before Phase B begins.

**What ships:** Ask tab becomes functional. Users type questions, receive streaming AI results with citations. "Save to Clips" on results. Source citation links navigate to Source Detail View.

**Components built:**

- `AskTab` (full implementation)
- `ResultCard`
- `SnippetInsertButton` (basic version -- full editor integration in Phase C)

**API changes:**

- Add `POST /projects/:projectId/research/query` (SSE streaming)
- Add `POST /projects/:projectId/research/clips` (save clip)
- Add `GET /projects/:projectId/research/clips` (for badge count)

**DB changes:**

- Migration 0015: `research_queries` table

**Ship criteria:**

- [ ] Ask tab accepts natural-language queries
- [ ] Results stream in with source citations
- [ ] "Save to Clips" works on result cards
- [ ] Source title links navigate to Source Detail View with "Back to Ask" breadcrumb
- [ ] Suggested queries appear on first visit
- [ ] Error/empty/loading states all handled
- [ ] Query latency < 5s for projects with up to 20 sources
- [ ] Rate limiting enforced (20 queries/min)
- [ ] iPad keyboard handling correct in Ask tab

**Risks:**

- AI query quality is the existential risk. Bad answers = product failure. Spike outputs must produce reliable approaches.
- SSE streaming on Workers has execution time limits.
- Performance at scale (100+ docs) requires testing. Chunking must handle large libraries.

### Phase C: Board + Editor Integration (Clips Tab + Footnotes)

**Estimated effort:** 2-3 weeks, one developer.

**What ships:** Clips tab fully functional. Chapter filter, search, delete. Insert action creates blockquote + footnote in editor. Tiptap footnote extension built.

**Components built:**

- `ClipsTab` (full implementation with chapter filter)
- `ClipCard`
- `SnippetInsertButton` (full editor integration)
- Tiptap footnote extension (new node type)
- Footnote rendering in chapter content

**API changes:**

- Add `DELETE /research/clips/:clipId`
- Clip save/list endpoints already exist from Phase B

**Ship criteria:**

- [ ] Clips tab shows all clips with chapter filter
- [ ] Search filters clips by text and source title
- [ ] Delete works (swipe or button)
- [ ] Insert places blockquote at cursor with auto-footnote
- [ ] Footnotes render at bottom of chapter
- [ ] Undo removes blockquote + footnote together
- [ ] Insert works from both Clips tab and Ask tab
- [ ] Chapter tag dropdown appears when saving clips
- [ ] Cross-tab navigation with "Back to Clips" breadcrumb works
- [ ] Footnotes survive Drive write-through (HTML serialization)

**Risks:**

- Tiptap footnote extension is non-trivial. Must handle serialization, undo/redo, and Drive write-through.
- Cursor position management between editor and Research Panel on iPad requires thorough testing.
- Insert must not break three-tier save (local, R2, Drive).

---

## 11. Decisions Log

### Decision 1: Option B over Option A and Option C

**Decided:** Option B ("Research Companion") with three tabs.

**Why:** Both personas independently selected it. Option A lacked AI search, which both identified as the breakthrough capability. Option C's all-or-nothing AI bet was too risky -- both personas wanted manual browsing as a first-class alternative.

**Dissenting opinions:** None from personas. Option C's "ask-first" philosophy was admired but premature without proven AI quality.

### Decision 2: Eliminate chapter-source linking

**Decided:** Remove the link/unlink concept entirely. Sources are project-level.

**Why:** The current state analysis (02a) found the action had invisible outcomes, the term "link" was overloaded and confusing, and neither persona used the feature as intended. Diane would "tap it, see nothing changed, tap again to unlink, give up." Marcus wanted the underlying concept (associate sources with chapters) but not the UI.

**Resolution:** Implicit tracking via clip chapter tags replaces explicit linking. When a clip is tagged to a chapter, that's the chapter-source relationship.

### Decision 3: Chapter tag on clips instead of chapter-source links

**Decided:** Clips have an optional `chapter_id` field. Clips tab has a chapter filter dropdown.

**Why:** The stress test rated Marcus's clip management as RED for the flat list. Marcus needs chapter-level organization. Rather than re-introducing chapter-source linking (which failed), the organization lives at the clip level, which is where it provides the most value: "these are the passages I've collected for Chapter 4."

**Dissenting opinions:** Diane did not ask for this. The design makes it optional (default: "All chapters") so it adds zero complexity for users who don't need it.

### Decision 4: Always-visible search in Source Detail View

**Decided:** Search field is always visible, regardless of document length.

**Why:** The original 10,000-word threshold was too high. Diane's stress test noted that scrolling through a 3,000-5,000 word document looking for one sentence was tedious. "Ctrl+F should always be available."

**Dissenting opinions:** None.

### Decision 5: Trust messaging in Source Add Flow

**Decided:** Display "DraftCrane reads your files to help you search and reference them. Your originals are never changed." in the Source Add Flow, always visible.

**Why:** The stress test identified Drive modification anxiety as a YELLOW trust issue. Both personas' deepest concern with any tool touching their Drive is "will it change my files?" The removal dialog already says "Drive is not affected," but the trust barrier is at the connection point.

**Dissenting opinions:** None. Deemed zero-cost to implement with outsized trust impact.

### Decision 6: First-use nudge for Research Panel

**Decided:** One-time tooltip + pulsing dot on the Research toolbar button when project has zero sources.

**Why:** The stress test rated Scenario A (first-time experience) as YELLOW specifically because "the Research Panel is hidden by default" and "without guidance, a new user might not find it for days." The entire value proposition requires users to add sources. Discoverability is a funnel problem.

**Dissenting opinions:** None. One-time, non-intrusive, targeted.

### Decision 7: Cross-tab breadcrumb for source navigation

**Decided:** When navigating from Clips or Ask to a source detail, show "Back to Clips" / "Back to Ask" instead of "< Sources."

**Why:** The stress test rated Flow 8 as YELLOW partly due to cross-tab navigation confusion. "I went from Clips to Sources without explicitly choosing to switch tabs. That's logical but disorienting." The breadcrumb preserves the user's mental context.

**Dissenting opinions:** None.

### Decision 8: Button-only insertion, no drag-and-drop

**Decided:** Clips are inserted via "Insert" button, not drag-and-drop.

**Why:** Drag-and-drop is unreliable on iPad Safari. The industry research (01-research) confirmed this. Button insertion is reliable, predictable, and accessible.

**Dissenting opinions:** Marcus might prefer drag-and-drop on desktop. Reserved as a Phase C+ enhancement for pointer devices only.

### Decision 9: Blockquote + footnote insertion format

**Decided:** Inserted clips are wrapped in a Tiptap blockquote node with a superscript footnote reference. Footnotes render at bottom of chapter.

**Why:** The stress test identified automatic footnotes as a "moment of delight." Diane: "I hate doing footnotes. The fact that tapping Insert creates a properly formatted footnote automatically -- that's magical."

**Dissenting opinions:** Diane noted she sometimes wants to insert text without blockquote formatting (for paraphrasing). Future enhancement: "Insert as quote" vs. "Insert citation only."

### Decision 10: Sources tab as default tab (not Ask)

**Decided:** Sources tab is the default when the panel opens.

**Why:** The Sources tab is the simplest, most concrete tab. It shows files the user recognizes. The Ask tab requires the user to formulate a question, which is a higher cognitive bar for first-time users. Starting with Sources builds familiarity before introducing AI.

**Dissenting opinions:** Diane said she'd "live in the Ask tab" after learning it. But for onboarding, Sources-first is safer. Users can easily switch.

---

## 12. Appendix: User Feedback Resolution Tracker

| #   | Finding                                                         | Source                   | Rating      | Resolution                                                                                                               | Section                                                              |
| --- | --------------------------------------------------------------- | ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | Text selection discoverability for custom clips                 | Flow 5, Path B           | YELLOW      | Full-height labeled buttons in floating toolbar + "Tip: Select text to save passages" hint on first 3 views              | [Flow 5](#flow-5-save-a-snippet-from-search-results)                 |
| 2   | iPad cursor position uncertainty on insert                      | Flow 6                   | YELLOW      | `lastSelectionRef` stores position; `requestAnimationFrame` wrapper prevents viewport jumping; fallback to append-to-end | [Flow 6](#flow-6-insert-a-snippet-into-the-editor)                   |
| 3   | Flat clip list doesn't scale for Marcus (100+ docs)             | Flow 8, Marcus RED       | YELLOW/RED  | Chapter filter dropdown in Clips tab; optional chapter tag when saving clips                                             | [Flow 8](#flow-8-browse-collected-snippets-on-research-board)        |
| 4   | Panel discoverability gap for new users                         | Scenario A               | YELLOW      | One-time tooltip + pulsing dot on Research toolbar button; clear Sources tab empty state                                 | [First-Use Experience](#first-use-experience)                        |
| 5   | Flat clip list doesn't support research session organization    | Scenario C               | YELLOW      | Chapter filter + chapter tag enable per-chapter clip organization                                                        | [Flow 8](#flow-8-browse-collected-snippets-on-research-board)        |
| 6   | Trust line needed during source addition                        | Top 3 Change #1          | Requested   | "Your originals are never changed" in Source Add Flow                                                                    | [Flow 1](#flow-1-add-source-from-google-drive)                       |
| 7   | In-document search threshold too high (10,000 words)            | Top 3 Change #2          | Requested   | Always-visible search in Source Detail View                                                                              | [Flow 3](#flow-3-view-a-source-while-writing)                        |
| 8   | First-use nudge for Research Panel                              | Top 3 Change #3          | Requested   | Tooltip + pulsing dot for projects with zero sources                                                                     | [First-Use Experience](#first-use-experience)                        |
| 9   | Cross-tab navigation confusion (Clips to Sources)               | Flow 8, Scenario concern | YELLOW      | "Back to Clips" / "Back to Ask" breadcrumb in Source Detail View                                                         | [Flow 8](#flow-8-browse-collected-snippets-on-research-board)        |
| 10  | "Cached" terminology unclear                                    | Terminology review       | Observation | Changed to "Updated Xh ago" in display text                                                                              | [Component Specs: SourceCard](#sourcecard)                           |
| 11  | Clips terminology slightly confusing at first                   | Terminology review       | Observation | Clear empty state: "Save passages from your sources to reference them later"                                             | [Component Specs: ClipsTab](#clipstab)                               |
| 12  | Portrait mode: 15% editor strip may be wasted space             | iPad-specific concern    | YELLOW      | Maintained as visual context cue. Full-screen with "Back to editor" is a future option if testing confirms.              | [Panel Specifications](#portrait-layout-768pt-1023pt-viewport-width) |
| 13  | Marcus wants "select entire folder" for bulk add                | Flow 1, Marcus YELLOW    | Observation | Deferred to post-Phase A. Current design handles folder-by-folder addition.                                              | [Decisions Log](#decisions-log)                                      |
| 14  | Blockquote-only insertion; sometimes want plain text + citation | Flow 6, Diane note       | Observation | Deferred. Future: "Insert as quote" vs. "Insert citation only" options.                                                  | [Decision 9](#decision-9-blockquote--footnote-insertion-format)      |

---

## Export Manager

### Overview

The Export Manager handles destination selection, folder browsing within cloud sources, and remembered defaults for export delivery. It ensures no file leaves the server without explicit user consent while reducing friction for repeat exports.

### Destination Picker (Bottom Sheet)

Shown after every export unless a remembered default is set.

```
┌─────────────────────────────────────────┐
│  Save Export                         ✕  │
│  My Book - 2026-02-23.pdf               │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ↓  This Device                     ││
│  │    Save to your Downloads folder   ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ △  Google Drive                    ││
│  │    scott@gmail.com                 ││
│  │    My Book / _exports              ││
│  │    [Change folder...]              ││
│  └─────────────────────────────────────┘│
│                                         │
│  ☐ Always save exports here             │
│                                         │
│           [ Save ]                      │
└─────────────────────────────────────────┘
```

**States:**

- **Selection** — user picks a destination; "Save" dispatches to parent
- **Edit mode** — opened from "Export destination..." menu; shows current default with "Clear default" option
- **Error** — stale default detected ("Your default destination is no longer available.")

### Folder Browser (within Picker)

When user taps "Change folder..." on a Drive destination, a sub-view slides in.

- Shows **only folders** (no documents) — backend filters with `foldersOnly` param
- Breadcrumb navigation (same pattern as existing DriveBrowser)
- "Create New Folder" action
- "Select This Folder" button at any level
- Returns `{ folderId, folderPath }` to parent picker

### Confirmation Toast (Default Set)

When a remembered default exists, exports auto-deliver and show a compact toast:

```
┌──────────────────────────────────────┐
│ ✓ Saved to Google Drive              │
│   My Book / _exports                 │
│   [Change]                       ✕   │
└──────────────────────────────────────┘
```

- "Change" opens the destination picker to update or clear the default

### Export Menu Addition

```
Export Book as PDF
Export Book as EPUB
─────────────────
Export This Chapter as PDF
Export This Chapter as EPUB
─────────────────
Export destination...     ← NEW
Save to Files
```

"Export destination..." opens the picker in edit mode (shows current default, "Clear default" option).

### Persistence

- One export preference row per project per user
- `destination_type`: `'device'` or `'drive'`
- Drive preferences store `drive_connection_id`, `drive_folder_id`, and `drive_folder_path` (display string, cosmetic — folder ID is the functional key)
- `ON DELETE SET NULL` on drive_connection_id: staleness detected at export time

### Edge Cases

| Scenario                                  | Behavior                                                       |
| ----------------------------------------- | -------------------------------------------------------------- |
| No Drive connected, no default            | Picker shown with "This Device" as the only option             |
| Default Drive but connection disconnected | Detect null `drive_connection_id` → picker with error          |
| Default Drive but folder deleted          | Drive API 404 on upload → picker with error                    |
| New source connected                      | Appears as new destination in picker                           |
| Multiple rapid exports                    | Rate limit (5/min); preference check is fast (single DB query) |
| Picker dismissed while export ready       | "Export ready" toast with link to reopen picker                |
