# Current State Analysis + Mental Model Proposals

> DraftCrane Source/Research UX Design Review
> Phase 2a: UX Designer Analysis
> Date: 2026-02-19

## Table of Contents

1. [Current State Analysis](#part-1-current-state-analysis)
   - [1.1 User Action Path Map](#11-user-action-path-map)
   - [1.2 Sheet-Stacking Problem](#12-sheet-stacking-problem)
   - [1.3 Link/Unlink Confusion](#13-linkunlink-confusion)
   - [1.4 "10-Second Test" Failures](#14-10-second-test-failures)
   - [1.5 Architecture Signal](#15-architecture-signal)
2. [Mental Model Proposals](#part-2-three-mental-model-proposals)
   - [Option A: "Polished Library"](#option-a-polished-library)
   - [Option B: "Research Companion"](#option-b-research-companion)
   - [Option C: "Integrated Research Assistant"](#option-c-integrated-research-assistant)

---

## Part 1: Current State Analysis

### 1.1 User Action Path Map

#### Add a source from Google Drive

| Step | Action                                               | Surface                                | Taps          |
| ---- | ---------------------------------------------------- | -------------------------------------- | ------------- |
| 1    | Tap "Sources" in toolbar menu                        | EditorToolbar (settings/overflow menu) | 1             |
| 2    | SourcesPanel slides in from right                    | SourcesPanel (z-50, max-w-md)          | 0 (animation) |
| 3    | Tap "Add" button in panel header                     | SourcesPanel header                    | 1             |
| 4    | AddSourceSheet slides up from bottom                 | AddSourceSheet (z-50, max-h-[70vh])    | 0 (animation) |
| 5    | Tap a connected Google account row                   | AddSourceSheet account list            | 1             |
| 6    | AddSourceSheet closes, DriveBrowserSheet slides up   | DriveBrowserSheet (z-50, max-h-[80vh]) | 0 (animation) |
| 7    | Navigate into target folder (1 tap per folder level) | DriveBrowserSheet folder list          | 1-5           |
| 8    | Tap checkbox on each Google Doc to select            | DriveBrowserSheet doc list             | 1+            |
| 9    | Tap "Add to Sources" button                          | DriveBrowserSheet footer               | 1             |

**Total: 6-12 taps across 4 distinct surfaces (toolbar, panel, sheet, sheet).**

The minimum path for a user who has one Drive account and files at the root level is 6 taps. For Marcus with his 12 subfolders, reaching a deeply nested document could take 10+ taps. Each surface has its own close/dismiss affordance, creating confusion about how to "go back."

#### Add a source from local device

| Step | Action                                   | Surface             | Taps |
| ---- | ---------------------------------------- | ------------------- | ---- |
| 1    | Open SourcesPanel (via toolbar)          | EditorToolbar       | 1    |
| 2    | Tap "Add" button                         | SourcesPanel header | 1    |
| 3    | AddSourceSheet slides up                 | AddSourceSheet      | 0    |
| 4    | Tap "Upload from device"                 | AddSourceSheet      | 1    |
| 5    | iOS file picker opens                    | System file picker  | 0    |
| 6    | Navigate to and select file              | System file picker  | 2-4  |
| 7    | File uploads, AddSourceSheet auto-closes | AddSourceSheet      | 0    |

**Total: 5-7 taps across 3 surfaces (toolbar, panel, sheet + system picker).**

Notably simpler than the Drive path because the system file picker replaces the DriveBrowserSheet. However, the upload only supports `.txt` and `.md` files -- not `.docx` or `.pdf` -- which limits practical utility for Diane, who has Google Docs in Drive, not local text files.

#### View a source while writing

| Step | Action                                           | Surface                                   | Taps |
| ---- | ------------------------------------------------ | ----------------------------------------- | ---- |
| 1    | Open SourcesPanel (via toolbar)                  | EditorToolbar                             | 1    |
| 2    | Tap "View" button on a source row                | SourcesPanel source list                  | 1    |
| 3    | SourceViewerSheet slides in from right at z-[60] | SourceViewerSheet (overlays SourcesPanel) | 0    |

**Total: 2 taps to reach the content viewer.**

This is the most efficient path in the current design. However, once the viewer is open, the user cannot see the editor at all -- the SourceViewerSheet is full-height, full-width (max-w-lg) at z-[60], overlaying everything. The user must close the viewer to write, then reopen it to check the source. There is no side-by-side capability.

If the user wants to switch to a different source, they must:

- Close the SourceViewerSheet (1 tap on X, or swipe)
- The SourcesPanel is now visible again behind it
- Tap "View" on a different source (1 tap)
- New SourceViewerSheet opens (0 taps)

So switching between sources while referencing costs 2 taps per switch, but each switch loses scroll position in the previous source.

The tab bar in SourceViewerSheet only appears when multiple sources are linked to the current chapter. If no sources are linked (the likely default state for a new user), there are no tabs, and the user must go back to the panel to switch sources.

#### Link/unlink a source to current chapter

| Step | Action                               | Surface                             | Taps     |
| ---- | ------------------------------------ | ----------------------------------- | -------- |
| 1    | Open SourcesPanel (via toolbar)      | EditorToolbar                       | 1        |
| 2    | Find the source in the list          | SourcesPanel source list            | 0 (scan) |
| 3    | Tap "Link to [Chapter Title]" button | SourcesPanel, per-source action row | 1        |

**Total: 2 taps.**

Unlinking follows the same path but the button reads "Linked" (toggled state). The cost is low in taps, but the conceptual cost is high -- see section 1.3.

#### Remove a source

| Step | Action                          | Surface                  | Taps |
| ---- | ------------------------------- | ------------------------ | ---- |
| 1    | Open SourcesPanel (via toolbar) | EditorToolbar            | 1    |
| 2    | Tap "Remove" on the source row  | SourcesPanel source list | 1    |

**Total: 2 taps.** There is no confirmation dialog. The source is removed immediately from the project. This is destructive and irreversible from the UI perspective (the file still exists in Drive, but the DraftCrane association, any chapter links, and cached content are deleted).

#### Import a source as chapter

| Step | Action                                   | Surface                      | Taps |
| ---- | ---------------------------------------- | ---------------------------- | ---- |
| 1    | Open SourcesPanel (via toolbar)          | EditorToolbar                | 1    |
| 2    | Tap "Import as Chapter" on a source row  | SourcesPanel source list     | 1    |
| --   | OR from the viewer:                      | --                           | --   |
| 1    | Open SourcesPanel, then open viewer      | EditorToolbar + SourcesPanel | 2    |
| 2    | Tap "Import as Chapter" in viewer header | SourceViewerSheet header     | 1    |

**Total: 2-3 taps.** Both paths work. The import creates a new chapter with the source content and navigates to it, closing the SourcesPanel. This path is reasonably well-designed, though the lack of confirmation before a potentially large content import is worth noting.

---

### 1.2 Sheet-Stacking Problem

#### Z-Index Layer Map

```
z-index    Surface                    Type              Trigger
-------    -------                    ----              -------
z-[60]     SourceViewerSheet          Right slide-in    "View" button in SourcesPanel
z-50       SourcesPanel               Right slide-in    Toolbar "Sources" action
z-50       AddSourceSheet             Bottom sheet      "Add" button in SourcesPanel
z-50       DriveBrowserSheet          Bottom sheet      Account row in AddSourceSheet
z-50       AccountsSheet              Bottom sheet      "Manage Accounts" in toolbar
z-50       DriveFilesSheet            Bottom sheet      "Drive Files" in toolbar
z-50       AIRewriteSheet             Bottom sheet      AI rewrite action
(below)    Editor + Sidebar + Toolbar  Base layer        Always present
```

#### What happens when multiple sheets are open

The worst-case stacking scenario occurs during the "Add a source from Drive" flow:

```
Layer 4 (top):    DriveBrowserSheet (z-50, bottom sheet, max-h-[80vh])
Layer 3:          AddSourceSheet (z-50, bottom sheet, max-h-[70vh])
Layer 2:          SourcesPanel (z-50, right panel, max-w-md)
Layer 1 (base):   Editor + Sidebar + Toolbar
```

All three source-related surfaces are open simultaneously. Each has its own backdrop (`bg-black/30`), creating a compounding dimming effect on the editor below. The DriveBrowserSheet and AddSourceSheet both use z-50, which means their stacking is determined by DOM order -- the DriveBrowserSheet renders after AddSourceSheet in EditorDialogs, so it visually overlays it.

When the SourceViewerSheet is open alongside the SourcesPanel:

```
Layer 3 (top):    SourceViewerSheet (z-[60], right panel, max-w-lg)
Layer 2:          SourcesPanel (z-50, right panel, max-w-md)
Layer 1 (base):   Editor + Sidebar + Toolbar
```

The SourceViewerSheet is wider (max-w-lg vs max-w-md) and at a higher z-index, so it completely covers the SourcesPanel. The user cannot interact with the SourcesPanel while the viewer is open. They must close the viewer first.

#### How the user navigates back through layers

There is no unified back navigation. Each surface has its own dismiss mechanism:

- **SourcesPanel:** X button in header, or tap the backdrop, or press Escape
- **AddSourceSheet:** Tap the backdrop (no explicit close button beyond the backdrop)
- **DriveBrowserSheet:** X button in header, tap the backdrop, or the "Back" button (for folder navigation, not sheet dismissal)
- **SourceViewerSheet:** X button in header, tap the backdrop, or press Escape

On iPad, the swipe-from-left-edge gesture in Safari navigates the browser back, not the app's sheet stack. A user swiping to "go back" from the DriveBrowserSheet will navigate away from the editor entirely, losing all sheet state. This is a significant iPad-specific usability failure.

The AddSourceSheet automatically closes when the user selects a Drive account (line 72-75 of add-source-sheet.tsx: `onClose()` is called after `onSelectDriveAccount`). This means the transition from AddSourceSheet to DriveBrowserSheet is actually a close-then-open, not a push. The user cannot easily return to the AddSourceSheet from the DriveBrowserSheet -- they must close the DriveBrowserSheet and re-open AddSourceSheet via the "Add" button.

#### iPad-specific issues

1. **Keyboard interaction.** None of these sheets handle the iPad software keyboard. If the DriveBrowserSheet were to add a search field (a reasonable future enhancement), the keyboard would push the sheet up or obscure the content, depending on how the fixed positioning interacts with the viewport resize.

2. **Touch targets.** The checkbox in DriveBrowserSheet (`h-4 w-4` = 16x16px) is significantly below the 44pt minimum touch target specified in the PRD. Folder navigation buttons in DriveBrowserSheet have sufficient height (`px-3 py-2`) but are not explicitly sized to 44pt. The "Back" button in DriveBrowserSheet (`h-9 w-9` = 36x36px) is also below the 44pt minimum.

3. **Scroll containment.** Each sheet has `overflow-auto` on its content area, but when the sheets stack, touch events for scrolling can leak to underlying sheets. The backdrops intercept clicks but not scroll events. On iPad, inertial scrolling in the foreground sheet can "pass through" to the background panel.

4. **Landscape vs portrait.** The SourcesPanel (`max-w-md` = 28rem = 448px) consumes 55% of screen width on an iPad Air in portrait (820px viewport). In landscape (1180px viewport), it consumes 38% -- more reasonable but still leaves no visible editor. The SourceViewerSheet (`max-w-lg` = 32rem = 512px) is even wider, consuming 62% in portrait and 43% in landscape.

---

### 1.3 Link/Unlink Confusion

#### What "Link to Chapter 3" actually does technically

Calling `linkSource(sourceId)` in `use-chapter-sources.ts` (line 54-71) sends a `POST` to `/chapters/{chapterId}/sources/{sourceId}/link`. The backend creates a row in the `chapter_sources` junction table:

```sql
INSERT INTO chapter_sources (id, chapter_id, source_id, status, sort_order)
VALUES (?, ?, ?, 'active', ?)
```

This creates a many-to-many association between a chapter and a source. The association has a `status` field (active/archived) and a `sort_order` field, but these are not currently exposed in the UI.

The visible effects of linking a source to a chapter are:

1. The source's button changes from "Link to Chapter 3" to "Linked" (blue highlight) in the SourcesPanel.
2. When the SourceViewerSheet is opened, linked sources appear as tabs in a tab bar, allowing the user to switch between them without returning to the SourcesPanel.
3. The `GET /chapters/{chapterId}/sources` endpoint returns only linked sources, not all project sources.

Unlinking sends a `DELETE` to `/chapters/{chapterId}/sources/{sourceId}/link`, which removes the junction table row. The source remains in the project; only the chapter association is removed.

#### What mental model it assumes the user has

The link/unlink system assumes the user understands:

1. That sources exist at two levels: project-level (visible in SourcesPanel) and chapter-level (the link relationship).
2. That "linking" creates a metadata association, not a content connection -- linking a source to a chapter does not insert any content from the source into the chapter.
3. That the tab bar in the viewer is populated by chapter-level links, so you must link sources before you can tab between them.
4. That the "Link to Chapter 3" label changes based on which chapter is currently active in the editor -- the same source row shows different link states depending on context outside the SourcesPanel.

This is a database-centric mental model. It assumes the user thinks of sources as entities that can be "associated with" chapters through an explicit relationship. This is the Notion relational-database pattern that the Phase 1 research identified as an anti-pattern for non-technical users.

#### Why this confuses non-technical users

The confusion stems from three sources:

1. **"Link" is an overloaded term.** In a web context, "link" means a URL or hyperlink. In a file-management context, "link" means a shortcut or alias. In a social-media context, "link" means to share. None of these meanings map to "create a metadata association between two entities." The word provides no affordance for what will happen.

2. **The action has no visible outcome.** After tapping "Link to Chapter 3," the button changes to "Linked" -- but nothing else changes. The chapter content is unchanged. The source content is unchanged. The only visible effect is a button label change and, eventually, a tab in the viewer. The action-to-feedback loop is broken.

3. **The context dependency is invisible.** The button says "Link to Chapter 3" because Chapter 3 is the active chapter in the editor. But the SourcesPanel does not show which chapter is active -- the `activeChapterTitle` is passed as a prop and appears only in the button label. If the user doesn't realize that linking is chapter-specific, they may think they're linking the source to the entire project.

#### What would Diane think "Link" means?

Diane would most likely interpret "Link to Chapter 3" as one of:

- "Insert a hyperlink to this source document in Chapter 3" (web mental model)
- "Move this source into Chapter 3" (file-organization mental model)
- "Open this source next to Chapter 3" (side-by-side viewing mental model)

All three interpretations lead to an expectation of visible change in the chapter. When tapping "Link" produces only a button label change, Diane would likely:

1. Tap it.
2. Look at the chapter to see what changed.
3. See nothing changed.
4. Assume it didn't work.
5. Tap it again (which unlinks it).
6. Give up on the feature.

This is the "invisible action" anti-pattern. The feature requires the user to understand a concept (metadata association) that has no visual representation in their primary workspace (the editor).

---

### 1.4 "10-Second Test" Failures

The PRD mandates: "A management consultant should be able to figure out any screen in 10 seconds without instructions."

#### Failure 1: AddSourceSheet purpose is unclear

When the AddSourceSheet slides up, it shows:

- A list of connected Google accounts (email addresses with "Browse Google Drive" subtitle)
- An "Upload from device" option
- A "Connect another Google account" option

A new user (Diane) who has never connected a Google account sees only "Upload from device" and "Connect another Google account." The sheet title is "Add Source" with subtitle "Select files from Google Drive or upload from your device."

**What fails the test:** The term "source" is not defined anywhere in the UI. Diane does not think of her Google Docs as "sources." She thinks of them as "my notes" or "my research" or "that doc I wrote." The entire SourcesPanel header says "Sources" -- a term borrowed from academic citation workflows (Zotero, bibliography management) that does not match how Diane or Marcus think about their reference materials.

**Time to understand: 15-20 seconds.** The user must infer that "source" means "a Google Doc I want to reference while writing."

#### Failure 2: Link/Unlink button intention

See section 1.3. The "Link to Chapter 3" button fails the 10-second test because:

- The purpose of linking is not explained.
- The outcome of tapping is not visible.
- The chapter-specific context is not obvious.

**Time to understand: Never (without external explanation).** This is not a 10-second failure; it is a comprehension failure. The feature's purpose cannot be deduced from the UI alone.

#### Failure 3: SourceViewerSheet tab bar context

When the SourceViewerSheet opens with tabs (only when linked sources exist for the current chapter), the tab bar shows source titles. But there is no indication of what these tabs represent or why certain sources appear as tabs and others do not.

A user who linked three sources to Chapter 3 and then navigates to Chapter 5 would see different tabs (or no tabs). The reason for the change is invisible -- the tabs are driven by chapter-source links, which are chapter-specific, but the viewer does not explain this.

**Time to understand: 30+ seconds.** The user would need to switch chapters and observe the tab bar changing to understand the relationship.

#### Failure 4: DriveBrowserSheet vs system file picker

DraftCrane implements its own Google Drive browser (DriveBrowserSheet) rather than using the Google Picker API (which `useGooglePicker` wraps but is not used in the current flow). The custom browser shows folders and Google Docs with checkboxes.

A management consultant is familiar with Google Drive's own UI. The DriveBrowserSheet does not match Google Drive's visual language -- it uses DraftCrane's own styling, different icons, a different folder structure presentation. The user must mentally map "this is my Drive, but it looks different."

**Time to understand: 10-15 seconds.** The user recognizes the content (their folders) but must adjust to the unfamiliar presentation.

#### Failure 5: "Import as Chapter" vs "Add as Source"

Both the SourcesPanel and the SourceViewerSheet show "Import as Chapter" buttons. This action converts a source into a chapter -- a fundamentally different operation from "Add to Sources" (which keeps the document as reference material). But the two actions are presented at the same visual weight and proximity.

A user who wants to "use this document" has two buttons that both seem like they accomplish that goal. The difference -- "reference it" vs "turn it into a chapter" -- requires understanding the project's content model.

**Time to understand: 20+ seconds.** The user must understand the difference between a "source" (reference material) and a "chapter" (manuscript content) to choose correctly.

---

### 1.5 Architecture Signal

The `EditorDialogsProps` interface in `editor-dialogs.tsx` spans 133 lines and defines approximately 100 props. Of these, roughly 50 props are source-related (SourcesPanel, AddSourceSheet, DriveBrowserSheet, SourceViewerSheet, AccountsSheet, and their associated state and callbacks).

#### Why this is a problem beyond code quality

The 133-line props interface is not just a code smell. It is a direct measurement of UX complexity. Every prop in that interface represents a piece of state or behavior that the editor page must track, wire, and coordinate. The size of this interface tells us:

**1. The UX has no encapsulated subsystems.**

A well-designed UX creates self-contained interaction units. A source browser should be a self-contained experience: the user enters it, accomplishes their goal, and exits. The implementation should reflect this -- a single component or context provider with internal state.

Instead, the source management UX is shattered across 6 components (SourcesPanel, AddSourceSheet, DriveBrowserSheet, SourceViewerSheet, AccountsSheet, DriveFilesSheet) with all state lifted to the editor page and threaded through EditorDialogs. This means the source management UX is not a subsystem -- it is 50+ tendrils of state entangled with the rest of the editor.

This architectural fragmentation mirrors the UX fragmentation. The user experiences 4 distinct surfaces (panel, add-sheet, browser-sheet, viewer) because the implementation creates 4 distinct components with no shared context. Each surface was built as an independent component, and the "integration" happened by wiring them together through props in the editor page.

**2. The number of boolean state variables reveals modal complexity.**

The source system manages 6 boolean state variables in `useSourceActions`:

- `isSourcesPanelOpen`
- `isViewerOpen`
- `isAddSourceSheetOpen`
- `isDriveBrowserOpen`
- (plus `activeSource` and `driveConnectionId`)

Six booleans create a theoretical state space of 64 combinations, most of which are invalid. The code prevents some invalid states (e.g., `closeSourcesPanel` also sets `isViewerOpen` to false), but there is no state machine enforcing valid transitions. The state management is ad hoc, with each `close*` callback manually resetting related states.

This is a design problem, not just a code problem. Each boolean represents a surface the user might see. Six surfaces, each independently open/closeable, means the user cannot form a reliable mental model of "where am I in this flow?" Compare this to a well-designed state machine with 3-4 states: "closed", "browsing sources", "viewing a source", "adding a source."

**3. The props interface width predicts future regression risk.**

Every new feature that touches sources must thread new props through EditorDialogs. The planned Research Assistant (#128-130) and Research Board (#131-133) would each add 10-20 more props to this interface. At the current trajectory, EditorDialogsProps would exceed 200 props, making the editor page essentially unmaintainable.

More critically, the prop-threading architecture makes it impossible to develop source features in isolation. Any change to a source component requires touching the editor page, EditorDialogs, and the relevant hooks. This coupling slows development and increases the risk of regressions in unrelated features.

**4. The architecture reveals an absence of design intent.**

The current source management UX was built incrementally: SourcesPanel was added, then AddSourceSheet was added to handle the "Add" flow, then DriveBrowserSheet was added because the Google Picker API had limitations, then SourceViewerSheet was added for content preview, then chapter-source linking was added. Each addition was a reasonable individual decision, but the cumulative result is a UX with no coherent mental model.

The 133-line props interface is the architectural manifestation of "we added features without designing an experience." The redesign must start from a mental model, not from a feature list.

---

## Part 2: Three Mental Model Proposals

### Option A: "Polished Library"

#### Mental model in one sentence

**"Your sources are a library shelf next to your writing desk -- always there when you need to glance over, organized by project, not by chapter."**

This option preserves the fundamental concept of a project-level source library accessed through a right-hand panel, but eliminates the complexity layers: no chapter linking, no sheet stacking, no multi-step add flow.

#### ASCII layout diagram (landscape iPad, 1180px)

```
+---------------------------+----------------------------------+-------------------+
|                           |                                  |                   |
|  SIDEBAR (240px)          |  EDITOR (580px)                  |  SOURCES (360px)  |
|                           |                                  |                   |
|  Ch 1  The Problem   820w |  [Chapter Title]                 |  [Search]  [+ Add]|
|  Ch 2  Why It Matt.. 1.2k |                                  |  ---------------  |
|> Ch 3  The Framework  640w|  Lorem ipsum dolor sit amet,     |  Interview-S.doc  |
|  Ch 4  Case Studies  920w |  consectetur adipiscing elit.    |  1,240 words      |
|  Ch 5  Conclusion    410w |  Sed do eiusmod tempor           |                   |
|                           |  incididunt ut labore et         |  Q4-Report.doc    |
|                           |  dolore magna aliqua. Ut enim    |  3,800 words      |
|                           |  ad minim veniam, quis nostrud   |                   |
|                           |  exercitation ullamco laboris    |  Client-Notes.doc |
|                           |  nisi ut aliquip ex ea commodo   |  2,100 words      |
|                           |  consequat.                      |                   |
|                           |                                  |  Meeting-Tr.txt   |
|                           |  Duis aute irure dolor in        |  890 words        |
|                           |  reprehenderit in voluptate      |                   |
|                           |  velit esse cillum dolore eu     |                   |
|                           |  fugiat nulla pariatur.          |                   |
|                           |                                  |                   |
|  Total: 4,990 words       |  640 words                       |  4 sources        |
+---------------------------+----------------------------------+-------------------+
```

**Portrait iPad (820px):** The sources panel is hidden by default. A "Sources" button in the toolbar opens the panel as a full-screen overlay (not a partial sheet). Tapping a source opens its content in the same overlay, replacing the list view with a detail view and a back button.

**Source detail view (replaces the list in the same panel):**

```
+-------------------------------------------+
|  [< Back]   Interview-Smith.doc    [Close] |
|  1,240 words  |  Cached 2h ago             |
|  -------------------------------------------
|                                            |
|  The key insight from our conversation     |
|  was that leadership in distributed teams  |
|  requires fundamentally different...       |
|                                            |
|  [Import as Chapter]                       |
+-------------------------------------------+
```

#### Tap-count analysis

| Task                                                   | Taps    | Path                                                                                                                                     |
| ------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Task 1:** Add a new source from Google Drive         | **3-6** | Tap [+ Add] in panel header (1) > unified Drive browser opens inline in panel: navigate folders (1-3) > check files (1+) > tap "Add" (1) |
| **Task 2:** View source content while writing          | **1**   | Tap source row in panel (panel is already visible in landscape)                                                                          |
| **Task 3:** Find a specific fact from source materials | **2-4** | Type in search field at top of panel (1) > scan filtered results (0) > tap source (1) > scroll to find fact (manual)                     |
| **Task 4:** Save a useful passage for later            | **N/A** | Not supported. Option A does not include a snippet/clipboard feature. User must copy-paste manually.                                     |
| **Task 5:** Insert a sourced quote into the editor     | **N/A** | Not supported natively. User must manually copy from viewer, paste into editor, and create a footnote.                                   |

#### Backlog issue coverage

| Issue                          | Coverage            | Notes                                                                           |
| ------------------------------ | ------------------- | ------------------------------------------------------------------------------- |
| #121 Drive auth                | Unchanged           | Existing auth flow preserved                                                    |
| #122 Drive file selection      | Improved            | Merged into single inline browser (replaces AddSourceSheet + DriveBrowserSheet) |
| #123 Local upload              | Unchanged           | Upload option remains in the add flow                                           |
| #124 Text extraction           | Unchanged           | Backend work, independent of UX                                                 |
| #125-127 AI query pipeline     | Not addressed       | Option A does not include AI research                                           |
| #128-130 Research Assistant UI | Not addressed       | No AI panel                                                                     |
| #131-133 Research Board        | Not addressed       | No snippet collection                                                           |
| #134-137 Spikes                | Partially addressed | #137 (preview component) is addressed by the improved viewer                    |

**Coverage: 4 of 17 issues addressed. Option A is source management only.**

#### Technical complexity

**Components changed:**

- `SourcesPanel` -- Refactored: remove link/unlink buttons, add search field, add inline Drive browser mode, add inline detail view (replaces SourceViewerSheet)
- `AddSourceSheet` -- **Removed.** Merged into SourcesPanel's add flow.
- `DriveBrowserSheet` -- **Removed.** Replaced by inline Drive browser within SourcesPanel.
- `SourceViewerSheet` -- **Removed.** Replaced by detail view within SourcesPanel.
- `EditorDialogs` -- Simplified: ~50 source-related props reduced to ~15.

**Hooks changed:**

- `useSourceActions` -- Simplified: remove `isAddSourceSheetOpen`, `isDriveBrowserOpen` state. Add `viewMode` state (`'list' | 'detail' | 'add'`).
- `useChapterSources` -- **Removed entirely.** No chapter-level linking.

**API changes:**

- Remove `POST /chapters/:chapterId/sources/:sourceId/link` endpoint
- Remove `DELETE /chapters/:chapterId/sources/:sourceId/link` endpoint
- Remove `GET /chapters/:chapterId/sources` endpoint

**Database changes:**

- `chapter_sources` table becomes unused (can be deprecated or dropped)
- No new tables

**Estimated effort:** 1-2 weeks for a single developer.

#### Risk assessment

**Risks for Diane:**

- Low risk. The simplified panel is more discoverable and the single-surface navigation prevents getting lost.
- The term "Sources" may still cause confusion. Consider "Reference Docs" or "Research Docs" as alternatives.
- In portrait mode, the full-screen overlay means Diane cannot see her chapter while viewing a source. She must toggle back and forth.

**Risks for Marcus:**

- Moderate risk. Marcus has 100+ documents. A flat source list does not scale for him. The search field mitigates this, but Marcus may want folder-level organization within DraftCrane.
- Removing chapter linking means Marcus loses the ability to organize sources by chapter -- everything is a flat project-level list. For a book with 15 chapters, this could feel disorganized.
- Marcus's 12 subfolder structure in Drive is navigable through the inline browser, but the flat display after import removes his organizational hierarchy.

#### What gets removed

| Component/Concept                                           | Status                       |
| ----------------------------------------------------------- | ---------------------------- |
| `AddSourceSheet` component                                  | Removed -- merged into panel |
| `DriveBrowserSheet` component                               | Removed -- merged into panel |
| `SourceViewerSheet` component                               | Removed -- merged into panel |
| `useChapterSources` hook                                    | Removed entirely             |
| `chapter_sources` database table                            | Deprecated                   |
| Chapter-source linking concept                              | Eliminated                   |
| Link/Unlink buttons                                         | Eliminated                   |
| Source viewer tab bar                                       | Eliminated                   |
| 3 backend API endpoints (link, unlink, get chapter sources) | Removed                      |
| ~50 props from EditorDialogsProps                           | Removed                      |

---

### Option B: "Research Companion"

#### Mental model in one sentence

**"Your research assistant lives in a panel beside your writing -- it holds your source files, answers your questions, and keeps your collected snippets organized."**

This option unifies source management, the future AI Research Assistant, and the future Research Board into a single right-hand panel with three tabs. Sources are project-wide (no chapter linking). The AI can search across all sources. Collected snippets are the bridge between research and writing.

#### ASCII layout diagram (landscape iPad, 1180px)

```
+---------------------------+----------------------------------+-------------------+
|                           |                                  |  RESEARCH         |
|  SIDEBAR (240px)          |  EDITOR (540px)                  |  [Sources|Ask|Clips]
|                           |                                  |  ================ |
|  Ch 1  The Problem   820w |  [Chapter Title]                 |                   |
|  Ch 2  Why It Matt.. 1.2k |                                  |  SOURCES TAB:     |
|> Ch 3  The Framework  640w|  Lorem ipsum dolor sit amet,     |  [Search]  [+ Add]|
|  Ch 4  Case Studies  920w |  consectetur adipiscing elit.    |  ---------------  |
|  Ch 5  Conclusion    410w |  Sed do eiusmod tempor           |  Interview-S.doc  |
|                           |  incididunt ut labore et         |    1,240w  Cached |
|                           |  dolore magna aliqua.            |  Q4-Report.doc    |
|                           |                                  |    3,800w  Cached |
|                           |  Ut enim ad minim veniam,        |  Client-Notes.doc |
|                           |  quis nostrud exercitation       |    2,100w  Cached |
|                           |  ullamco laboris nisi ut         |                   |
|                           |  aliquip ex ea commodo           |                   |
|                           |  consequat.                      |                   |
|                           |                                  |                   |
|  Total: 4,990 words       |  640 words                       |  3 sources        |
+---------------------------+----------------------------------+-------------------+
```

**"Ask" tab (AI Research Assistant):**

```
+-------------------------------------------+
|  RESEARCH                                  |
|  [Sources | *Ask* | Clips]                 |
|  ==========================================|
|                                            |
|  What does Smith say about resilience      |
|  in distributed teams?                     |
|                                            |
|  ---  AI Response  -------------------------
|  According to the Smith interview          |
|  (Interview-Smith.doc, p.3):               |
|                                            |
|  "Resilience in distributed teams comes    |
|  from psychological safety, not from       |
|  process compliance."                      |
|                                            |
|  Smith also notes that...                  |
|  (Q4-Report.doc, p.12)                     |
|                                            |
|  [Save to Clips]  [Insert Quote]           |
|  -------------------------------------------
|                                            |
|  [Ask about your sources...]               |
+-------------------------------------------+
```

**"Clips" tab (Research Board):**

```
+-------------------------------------------+
|  RESEARCH                                  |
|  [Sources | Ask | *Clips*]                 |
|  ==========================================|
|                                            |
|  3 clips saved                             |
|                                            |
|  "Resilience in distributed teams..."      |
|  -- Interview-Smith.doc, p.3               |
|  [Insert]  [Delete]                        |
|                                            |
|  "Q4 results showed a 23% increase..."     |
|  -- Q4-Report.doc, p.12                    |
|  [Insert]  [Delete]                        |
|                                            |
|  "The framework suggests three phases..."  |
|  -- Client-Notes.doc, p.7                  |
|  [Insert]  [Delete]                        |
|                                            |
+-------------------------------------------+
```

**Portrait iPad (820px):** The Research panel is hidden. A "Research" button in the toolbar opens it as a slide-over panel (right side, 85% width) with a visible editor strip on the left for context. Tapping a source opens its content in the same panel, replacing the current tab content. The user swipes right or taps "Back" to return to the tab view.

**Source detail view (within the Sources tab):**

```
+-------------------------------------------+
|  RESEARCH                                  |
|  [< Sources]   Interview-Smith.doc         |
|  ==========================================|
|  1,240 words  |  Cached 2h ago             |
|                                            |
|  The key insight from our conversation     |
|  was that leadership in distributed teams  |
|  requires fundamentally different...       |
|                                            |
|  (User can long-press to select text       |
|   and see a "Save to Clips" action)        |
|                                            |
|  [Import as Chapter]                       |
+-------------------------------------------+
```

#### Tap-count analysis

| Task                                                   | Taps    | Path                                                                                                                                      |
| ------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Task 1:** Add a new source from Google Drive         | **3-6** | Panel is open > Sources tab active > tap [+ Add] (1) > inline Drive browser: navigate (1-3) > select (1+) > tap "Add" (1)                 |
| **Task 2:** View source content while writing          | **1**   | Tap source row in Sources tab (panel already visible in landscape)                                                                        |
| **Task 3:** Find a specific fact from source materials | **2**   | Switch to Ask tab (1) > type question and tap send (1) > AI returns answer with source citation                                           |
| **Task 4:** Save a useful passage for later            | **2**   | From AI response: tap "Save to Clips" (1). Or from source viewer: long-press to select text (1) > tap "Save to Clips" in context menu (1) |
| **Task 5:** Insert a sourced quote into the editor     | **1-2** | From Clips tab: tap "Insert" on a clip (1) > clip text + footnote inserted at cursor. Or from AI response: tap "Insert Quote" (1)         |

#### Backlog issue coverage

| Issue                              | Coverage      | Notes                                      |
| ---------------------------------- | ------------- | ------------------------------------------ |
| #121 Drive auth                    | Unchanged     | Existing auth flow preserved               |
| #122 Drive file selection          | Improved      | Single inline browser in Sources tab       |
| #123 Local upload                  | Unchanged     | Upload option in add flow                  |
| #124 Text extraction               | Unchanged     | Backend work, independent                  |
| #125 AI query API endpoint         | **Addressed** | Ask tab sends queries to this endpoint     |
| #126 Chunking strategy             | **Addressed** | Required for Ask tab to work               |
| #127 Response parsing              | **Addressed** | AI responses displayed in Ask tab          |
| #128 Research panel                | **Addressed** | The Research panel IS this component       |
| #129 Query input                   | **Addressed** | Ask tab input field                        |
| #130 File preview                  | **Addressed** | Source detail view in Sources tab          |
| #131 Collect snippets              | **Addressed** | "Save to Clips" action from Ask and viewer |
| #132 View/manage board             | **Addressed** | Clips tab                                  |
| #133 Drag-to-editor with footnotes | **Addressed** | "Insert" button on clips + auto-footnote   |
| #134 Prompt engineering spike      | Partially     | Needed for Ask tab quality                 |
| #135 Doc parsing spike             | Partially     | Needed for source ingestion                |
| #136 Chunking strategy spike       | Partially     | Needed for AI search quality               |
| #137 Preview component spike       | **Addressed** | Source detail view                         |

**Coverage: 14 of 17 issues addressed. Option B provides a unified frame for the entire research feature set.**

#### Technical complexity

**Components created (new):**

- `ResearchPanel` -- Container with tab navigation (Sources, Ask, Clips)
- `ResearchSourcesTab` -- Replaces SourcesPanel (source list + inline add + inline detail)
- `ResearchAskTab` -- AI query interface (input, response display, save/insert actions)
- `ResearchClipsTab` -- Saved snippets with insert/delete actions

**Components removed:**

- `SourcesPanel` -- Replaced by ResearchSourcesTab
- `AddSourceSheet` -- Merged into ResearchSourcesTab add flow
- `DriveBrowserSheet` -- Merged into ResearchSourcesTab add flow
- `SourceViewerSheet` -- Merged into ResearchSourcesTab detail view

**Hooks changed:**

- `useSourceActions` -- Refactored to `useResearchPanel` with tab state, unified source management, and viewer state. State machine with defined transitions: `idle | sources-list | sources-detail | sources-add | ask | clips`.
- `useChapterSources` -- **Removed entirely.**
- New: `useAIResearch` -- manages query state, response parsing, and snippet extraction.
- New: `useResearchClips` -- manages saved snippets (CRUD against new backend endpoint).

**API changes:**

- Remove chapter-source link/unlink endpoints (3 endpoints)
- Add `POST /projects/:projectId/research/query` -- AI query endpoint
- Add `GET /projects/:projectId/clips` -- list saved clips
- Add `POST /projects/:projectId/clips` -- save a clip (source reference, text, position)
- Add `DELETE /clips/:clipId` -- delete a clip

**Database changes:**

- `chapter_sources` table deprecated
- New: `research_clips` table:
  ```sql
  CREATE TABLE research_clips (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES source_materials(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    source_location TEXT,  -- page/section reference
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  ```

**Estimated effort:** 4-6 weeks for a single developer. The AI query pipeline (#125-127) is the largest work item and must be built regardless of the UX option chosen. The panel restructuring itself is ~2 weeks.

#### Risk assessment

**Risks for Diane:**

- The three-tab structure adds cognitive overhead. Diane must learn what "Sources," "Ask," and "Clips" mean and when to use each. However, the tabs are labeled with plain language and the default tab (Sources) is the simplest view.
- The AI "Ask" feature depends on source ingestion quality (#124, #126). If the AI gives poor answers because source parsing fails (e.g., Google Doc formatting artifacts), Diane will lose trust in the feature.
- The "Clips" concept introduces a new workflow step. Diane currently uses copy-paste. Switching to "save clip then insert clip" is an extra step. The value proposition must be clear: the clip carries its source attribution automatically.

**Risks for Marcus:**

- Marcus may want to organize clips by chapter. The flat clips list could become unwieldy for a 15-chapter book with 50+ clips. Consider adding optional chapter tags to clips in a future iteration.
- The "Ask" tab is powerful for Marcus's "find the right document" use case, but depends on the quality of the AI's document search. If it cannot reliably distinguish between his 4 partial drafts of Chapter 3, the feature frustrates rather than helps.

**General risks:**

- Scope creep. Implementing the full Ask + Clips flow alongside source management refactoring is a large effort. The risk is that the source management improvements are delayed by the AI pipeline work.
- The panel width (400px in the layout above) reduces the editor to 540px in landscape. This is marginally acceptable for writing but pushes against the lower limit. In portrait mode, the panel must be a full overlay, which eliminates side-by-side viewing.

#### What gets removed

| Component/Concept                 | Status                                                            |
| --------------------------------- | ----------------------------------------------------------------- |
| `SourcesPanel` component          | Replaced by `ResearchSourcesTab`                                  |
| `AddSourceSheet` component        | Removed -- merged into Sources tab                                |
| `DriveBrowserSheet` component     | Removed -- merged into Sources tab                                |
| `SourceViewerSheet` component     | Removed -- merged into Sources tab                                |
| `useChapterSources` hook          | Removed entirely                                                  |
| `chapter_sources` database table  | Deprecated                                                        |
| Chapter-source linking concept    | Eliminated                                                        |
| Link/Unlink buttons               | Eliminated                                                        |
| Source viewer tab bar             | Eliminated -- replaced by source detail view with back navigation |
| ~50 props from EditorDialogsProps | Replaced by ~20 props for ResearchPanel                           |

---

### Option C: "Integrated Research Assistant"

#### Mental model in one sentence

**"You don't manage sources -- you ask questions, and your writing assistant finds the answers in your documents."**

This option eliminates the concept of a "source library" as a primary surface. Sources are added during project setup or through a lightweight settings flow. The primary interaction is through the AI query interface: the user asks questions, the AI searches all connected sources, and the user collects and inserts relevant passages. Source management is infrastructure, not a feature.

#### ASCII layout diagram (landscape iPad, 1180px)

**Default state (no research panel open):**

```
+---------------------------+--------------------------------------------------+
|                           |                                                  |
|  SIDEBAR (240px)          |  EDITOR (940px)                                  |
|                           |                                                  |
|  Ch 1  The Problem   820w |  [Chapter Title]                                 |
|  Ch 2  Why It Matt.. 1.2k |                                                  |
|> Ch 3  The Framework  640w|  Lorem ipsum dolor sit amet, consectetur          |
|  Ch 4  Case Studies  920w |  adipiscing elit. Sed do eiusmod tempor           |
|  Ch 5  Conclusion    410w |  incididunt ut labore et dolore magna aliqua.     |
|                           |                                                  |
|                           |  Ut enim ad minim veniam, quis nostrud            |
|                           |  exercitation ullamco laboris nisi ut aliquip     |
|                           |  ex ea commodo consequat.                         |
|                           |                                                  |
|                           |  Duis aute irure dolor in reprehenderit in        |
|                           |  voluptate velit esse cillum dolore eu fugiat     |
|                           |  nulla pariatur.                                  |
|                           |                                                  |
|                           |                                                  |
|                           |                            [Research]             |
|  Total: 4,990 words       |  640 words                                       |
+---------------------------+--------------------------------------------------+
```

**With Research panel open (activated by [Research] button or Cmd+Shift+R):**

```
+---------------------------+--------------------------+-----------------------+
|                           |                          |  RESEARCH             |
|  SIDEBAR (240px)          |  EDITOR (520px)          |  [Clips: 3]    [Gear]|
|                           |                          |  =====================|
|  Ch 1  The Problem   820w |  [Chapter Title]         |                       |
|  Ch 2  Why It Matt.. 1.2k |                          |  What does Smith say  |
|> Ch 3  The Framework  640w|  Lorem ipsum dolor sit   |  about resilience?    |
|  Ch 4  Case Studies  920w |  amet, consectetur       |                       |
|  Ch 5  Conclusion    410w |  adipiscing elit.        |  --- AI Response ---  |
|                           |                          |  Smith (Interview,    |
|                           |  Sed do eiusmod tempor   |  p.3) states:         |
|                           |  incididunt ut labore    |                       |
|                           |  et dolore magna         |  "Resilience in       |
|                           |  aliqua.                 |  distributed teams    |
|                           |                          |  comes from           |
|                           |  Ut enim ad minim        |  psychological        |
|                           |  veniam, quis nostrud    |  safety, not from     |
|                           |  exercitation ullamco.   |  process compliance." |
|                           |                          |                       |
|                           |                          |  [Save] [Insert+Cite] |
|                           |                          |  =====================|
|                           |                          |  [Ask about sources..]|
|  Total: 4,990 words       |  640 words               |  6 sources connected  |
+---------------------------+--------------------------+-----------------------+
```

**Source management (accessed via [Gear] icon in Research panel):**

```
+-------------------------------------------+
|  RESEARCH > Source Settings                |
|  [< Back]                          [+ Add]|
|  ==========================================|
|                                            |
|  Connected Sources (6)                     |
|                                            |
|  Interview-Smith.doc      [View] [Remove]  |
|  Q4-Report.doc            [View] [Remove]  |
|  Client-Notes.doc         [View] [Remove]  |
|  Leadership-Theory.doc    [View] [Remove]  |
|  Team-Survey-2025.doc     [View] [Remove]  |
|  Meeting-Transcript.txt   [View] [Remove]  |
|                                            |
|  --- Add more sources from Google Drive    |
|  --- or upload from your device.           |
|                                            |
+-------------------------------------------+
```

**Clips drawer (accessed via [Clips: 3] badge):**

```
+-------------------------------------------+
|  RESEARCH > Saved Clips (3)               |
|  [< Back]                                 |
|  ==========================================|
|                                            |
|  "Resilience in distributed teams..."      |
|  -- Interview-Smith.doc, p.3               |
|  [Insert+Cite]  [Delete]                   |
|                                            |
|  "Q4 results showed a 23% increase..."     |
|  -- Q4-Report.doc, p.12                    |
|  [Insert+Cite]  [Delete]                   |
|                                            |
|  "The framework suggests three phases..."  |
|  -- Client-Notes.doc, p.7                  |
|  [Insert+Cite]  [Delete]                   |
|                                            |
+-------------------------------------------+
```

**Portrait iPad (820px):** The [Research] button opens a bottom sheet (max-h-[85vh]) with the conversational interface. Source settings and clips are accessible through navigation within the sheet. The editor is visible as a sliver above the sheet for context.

#### Tap-count analysis

| Task                                                   | Taps    | Path                                                                                                                                  |
| ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Task 1:** Add a new source from Google Drive         | **4-8** | Open Research panel (1) > tap [Gear] for settings (1) > tap [+ Add] (1) > Drive browser: navigate (1-3) > select (1+) > tap "Add" (1) |
| **Task 2:** View source content while writing          | **3**   | Open Research panel (1) > tap [Gear] for settings (1) > tap "View" on a source (1)                                                    |
| **Task 3:** Find a specific fact from source materials | **2**   | Open Research panel (if closed) (1) > type question and tap send (1) > AI returns answer with citation                                |
| **Task 4:** Save a useful passage for later            | **1**   | From AI response: tap "Save" (1)                                                                                                      |
| **Task 5:** Insert a sourced quote into the editor     | **1**   | From AI response: tap "Insert+Cite" (1) > quote inserted at cursor with auto-footnote                                                 |

#### Backlog issue coverage

| Issue                              | Coverage                | Notes                                    |
| ---------------------------------- | ----------------------- | ---------------------------------------- |
| #121 Drive auth                    | Unchanged               | Existing auth flow preserved             |
| #122 Drive file selection          | Addressed               | Source settings inline browser           |
| #123 Local upload                  | Addressed               | Upload option in source settings         |
| #124 Text extraction               | **Critical dependency** | AI cannot answer without text extraction |
| #125 AI query API endpoint         | **Addressed**           | Core feature of the Research panel       |
| #126 Chunking strategy             | **Critical dependency** | AI quality depends on chunking           |
| #127 Response parsing              | **Addressed**           | Response display in Research panel       |
| #128 Research panel                | **Addressed**           | The Research panel IS this component     |
| #129 Query input                   | **Addressed**           | Conversational input field               |
| #130 File preview                  | **Addressed**           | Source viewer in settings subview        |
| #131 Collect snippets              | **Addressed**           | "Save" action on AI responses            |
| #132 View/manage board             | **Addressed**           | Clips drawer                             |
| #133 Drag-to-editor with footnotes | **Addressed**           | "Insert+Cite" with auto-footnote         |
| #134 Prompt engineering spike      | **Critical dependency** | Answer quality is the product            |
| #135 Doc parsing spike             | **Critical dependency** | Source ingestion quality                 |
| #136 Chunking strategy spike       | **Critical dependency** | Search relevance quality                 |
| #137 Preview component spike       | **Addressed**           | Source viewer                            |

**Coverage: 17 of 17 issues addressed, but 4 are critical dependencies that must be completed before the UX delivers value.** Without high-quality AI responses, this option is a worse source browser than Option A.

#### Technical complexity

**Components created (new):**

- `ResearchPanel` -- Conversational AI interface with sub-views for settings and clips
- `ResearchInput` -- Query input field with send button and suggested questions
- `ResearchResponse` -- AI response display with source citations, save/insert actions
- `ResearchClips` -- Saved clips list with insert/delete
- `ResearchSourceSettings` -- Source management (list, add, remove, view)

**Components removed:**

- `SourcesPanel` -- Replaced by ResearchSourceSettings (secondary surface)
- `AddSourceSheet` -- Merged into ResearchSourceSettings
- `DriveBrowserSheet` -- Merged into ResearchSourceSettings
- `SourceViewerSheet` -- Merged into ResearchSourceSettings

**Hooks changed:**

- `useSourceActions` -- Refactored to `useResearch` with state machine: `closed | asking | viewing-response | clips | source-settings | source-detail | source-add`.
- `useChapterSources` -- **Removed entirely.**
- New: `useAIResearch` -- manages conversation state, streaming responses, citation parsing.
- New: `useResearchClips` -- manages saved clips.
- New: `useResearchSuggestions` -- generates contextual question suggestions based on current chapter content and available sources.

**API changes:**

- Remove chapter-source link/unlink endpoints (3 endpoints)
- Add `POST /projects/:projectId/research/query` -- AI query with streaming SSE response
- Add `GET /projects/:projectId/research/suggestions` -- contextual question suggestions
- Add `GET /projects/:projectId/clips` -- list clips
- Add `POST /projects/:projectId/clips` -- save clip
- Add `DELETE /clips/:clipId` -- delete clip
- Add `POST /chapters/:chapterId/insert-citation` -- insert text + create footnote reference

**Database changes:**

- `chapter_sources` table deprecated
- New: `research_clips` table (same as Option B)
- New: `research_conversations` table (for conversation history):
  ```sql
  CREATE TABLE research_conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    source_refs TEXT,  -- JSON array of {sourceId, location} references
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  ```
- New: `source_chunks` table (for vector search / chunked source content):
  ```sql
  CREATE TABLE source_chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES source_materials(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB,  -- vector embedding for similarity search
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  ```

**Estimated effort:** 8-12 weeks for a single developer. The AI pipeline (ingestion, chunking, embedding, query, response parsing, citation extraction) is the dominant work item at 5-7 weeks. The panel UX is 2-3 weeks. The auto-footnote insertion into Tiptap is 1-2 weeks.

#### Risk assessment

**Risks for Diane:**

- **High dependency on AI quality.** If the AI gives wrong answers, cites the wrong source, or hallucinates, Diane has no fallback. In Option A and B, she can manually browse sources. In Option C, the browse path is buried 2 taps deep in settings. The primary path IS the AI.
- **Source addition is deprioritized.** Adding sources requires navigating to settings within the Research panel (2 extra taps). For initial setup, this is acceptable. But if Diane realizes mid-writing that she needs to add another source, the path is longer than in Options A or B.
- **The conversational paradigm may not match Diane's workflow.** Diane currently writes from a Google Doc open in another tab. Her workflow is "read source, then write." Option C's workflow is "ask a question, read the answer, insert it." This is a fundamentally different mode of working. Diane may not naturally formulate questions about her own documents.
- **Suggested questions could bridge this gap.** If the system generates good questions ("What does your Smith interview say about team dynamics?"), Diane has a starting point. But this depends on the suggestion quality, which is itself an AI feature.

**Risks for Marcus:**

- Marcus knows exactly which documents he needs. The "ask and receive" model adds friction for his "I want to open Document X and find Section Y" workflow. He must either navigate to source settings (indirect) or ask the AI to find it (slower than direct access).
- Marcus may want to browse his sources to re-familiarize himself with what he has. Option C makes browsing a secondary activity, which conflicts with Marcus's organizational nature.
- The 100+ document scenario is theoretically ideal for AI search (too many docs to browse manually), but the AI must handle the scale reliably. Vector search across 100 documents with hundreds of chunks requires infrastructure that may exceed D1/Workers AI capacity.

**General risks:**

- **All-or-nothing delivery.** Unlike Options A and B, Option C cannot be partially delivered. A Research panel without working AI is an empty shell. The AI pipeline must be functional before the UX delivers any value.
- **Performance on Workers.** Streaming SSE responses from Workers AI while simultaneously serving the editor, auto-saving, and handling Drive sync is a significant load. Edge compute constraints may cause latency or timeout issues.
- **The Tiptap footnote insertion** ("Insert+Cite") requires extending the editor's schema to support footnote nodes. This is a non-trivial Tiptap extension that must handle edge cases (inserting at selection boundaries, undo/redo, export to Google Docs).

#### What gets removed

| Component/Concept                             | Status                                                 |
| --------------------------------------------- | ------------------------------------------------------ |
| `SourcesPanel` component                      | Removed -- sources managed through Research > Settings |
| `AddSourceSheet` component                    | Removed -- merged into Research > Settings > Add       |
| `DriveBrowserSheet` component                 | Removed -- merged into Research > Settings > Add       |
| `SourceViewerSheet` component                 | Removed -- merged into Research > Settings > View      |
| `useChapterSources` hook                      | Removed entirely                                       |
| `chapter_sources` database table              | Deprecated                                             |
| Chapter-source linking concept                | Eliminated                                             |
| Link/Unlink buttons                           | Eliminated                                             |
| Source viewer tab bar                         | Eliminated                                             |
| "Sources" as a primary concept                | Demoted to settings                                    |
| Manual source browsing as primary interaction | Replaced by AI query                                   |
| ~50 source props from EditorDialogsProps      | Replaced by ~15 Research panel props                   |

---

## Summary Comparison

| Dimension                   | Option A: Polished Library | Option B: Research Companion             | Option C: Integrated Assistant |
| --------------------------- | -------------------------- | ---------------------------------------- | ------------------------------ |
| **Philosophy**              | Fix what's broken          | Unify sources + AI + clips               | AI-first, sources invisible    |
| **Primary interaction**     | Browse source list         | Browse OR ask                            | Ask questions                  |
| **Source browsing**         | Primary                    | Primary (Sources tab)                    | Secondary (Settings)           |
| **AI research**             | Not included               | Included (Ask tab)                       | Core feature                   |
| **Snippet collection**      | Not included               | Included (Clips tab)                     | Included (Clips drawer)        |
| **Auto-citation**           | Not included               | Included (Insert action)                 | Core feature                   |
| **Max sheet depth**         | 1 (detail replaces list)   | 1 (tab switching, detail replaces tab)   | 1 (sub-views within panel)     |
| **Backlog coverage**        | 4 of 17 issues             | 14 of 17 issues                          | 17 of 17 issues                |
| **Props removed**           | ~50                        | ~50                                      | ~50                            |
| **Props added**             | ~15                        | ~20                                      | ~15                            |
| **New backend endpoints**   | 0                          | 4                                        | 6                              |
| **New DB tables**           | 0                          | 1                                        | 3                              |
| **Dev effort**              | 1-2 weeks                  | 4-6 weeks                                | 8-12 weeks                     |
| **Diane risk**              | Low                        | Medium                                   | High                           |
| **Marcus risk**             | Medium (flat list)         | Low-Medium                               | Medium (browse friction)       |
| **Dependency risk**         | Low                        | Medium (AI quality)                      | High (AI is the product)       |
| **Can ship incrementally?** | Yes                        | Yes (Sources tab first, Ask/Clips later) | No (AI must work first)        |

### Recommended Sequencing

These options are not mutually exclusive in time. A phased approach:

1. **Ship Option A now** (1-2 weeks). Fix the immediate UX problems: eliminate sheet stacking, remove chapter linking confusion, simplify the add flow. This unblocks users today.

2. **Build toward Option B** (4-6 weeks after). Add the Ask and Clips tabs to the panel established in step 1. The Sources tab from Option A becomes the Sources tab of Option B with minimal rework.

3. **Evaluate Option C's AI-primary model** after the Ask tab has usage data. If users prefer asking over browsing, progressively shift the UX toward Option C by making the Ask tab the default and demoting source browsing. If users prefer browsing, stay with Option B.

This sequencing delivers value immediately (Option A), builds toward the full vision (Option B), and lets real user behavior determine whether the ambitious AI-first model (Option C) is warranted.
