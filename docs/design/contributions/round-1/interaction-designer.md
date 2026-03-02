# Interaction Designer Contribution - Design Brief Round 1

**Author:** Interaction Designer
**Date:** 2026-02-24
**Design Maturity:** Tokens defined
**Scope:** Instruction Library Standardization

---

## Overview

This document specifies the interaction design for a unified Instruction Library component that replaces three divergent patterns (Desk instruction chips + dropdown, Chapter Editor instruction chips + dropdown, Book Editor hardcoded constants) with a single vertical list component. The goal: every instruction -- seeded default or user-created -- looks and behaves identically. The user never perceives a two-tier hierarchy.

### Current Codebase State

| Context                  | Component File                                       | Default Source                                              | User Instructions                              | UI Pattern                                    |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Desk (analysis)          | `web/src/components/sources/desk-tab.tsx`            | `InstructionSetPicker` (4 chips from `DESK_INSTRUCTIONS`)   | `InstructionPicker` dropdown (type="analysis") | Chips + separate "Use saved instruction" link |
| Chapter Editor (rewrite) | `web/src/components/editor/chapter-editor-panel.tsx` | Inline chip rendering (5 chips from `CHAPTER_INSTRUCTIONS`) | `InstructionPicker` dropdown (type="rewrite")  | Chips + separate "Use saved instruction" link |
| Book Editor (analysis)   | Not yet in UI                                        | `BOOK_INSTRUCTIONS` in `instruction-set-picker.tsx`         | None                                           | Not implemented                               |

**Database schema** (`ai_instructions` table, migration 0020): stores `type` as `"analysis" | "rewrite"`. This two-value enum does not map to the three UI contexts. The Book Editor context needs instructions but has no dedicated type.

**Key files to replace:**

- `web/src/components/instruction-set-picker.tsx` -- the chip-based selector (retire entirely)
- `web/src/components/sources/instruction-picker.tsx` -- the dropdown for saved instructions (retire entirely)

**New file:**

- `web/src/components/ui/instruction-list.tsx` -- the unified component

---

## Instruction List Component

### Layout Model

The unified instruction list is a single vertical column with three zones stacked top to bottom:

```
+---------------------------------------+
| [magnifying glass] Search instructions |  <-- Search field (sticky top)
+---------------------------------------+
| RECENT                                 |  <-- Section label (muted)
|                                        |
| [ Simpler language              ]      |  <-- Row: label + truncated prompt
|   "Rewrite using simpler, more..."     |
|                                        |
| [ More concise                  ]      |
|   "Make this more concise. Re..."      |
|                                        |
| [ Extract quotes                ]      |
|   "Find quotable passages in..."       |
|                                        |
+- - - - - - - - - - - - - - - - - - - -+  <-- Subtle separator (1px border)
| ALL                                    |  <-- Section label (muted)
|                                        |
| [ Expand                        ]      |
|   "Expand this passage with m..."      |
|                                        |
| [ Extract quotes                ]      |
|   "Find quotable passages in..."       |
|                                        |
| [ Find key points               ]      |
|   "Extract the key points, ma..."      |
|                                        |
| [ More concise                  ]      |
|   "Make this more concise. Re..."      |
|                                        |
| [ More conversational           ]      |
|   "Rewrite in a more conversa..."      |
|                                        |
| [ ... (continues alphabetically) ]     |
|                                        |
+---------------------------------------+
| [+] New instruction                    |  <-- Sticky bottom action
+---------------------------------------+
```

### Dimensions and Spacing

| Property             | Value                                      | Token / Rationale                                                           |
| -------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| List max-height      | 100% of parent container                   | Flex-grows within panel; scrolls internally                                 |
| Row min-height       | 56px                                       | 44px touch target + 12px padding for two-line content                       |
| Search field height  | 44px                                       | Touch target minimum                                                        |
| Section label height | 28px                                       | Compact, non-interactive                                                    |
| Separator            | 1px `border-b` using `var(--color-border)` | Subtle, consistent with existing panel borders                              |
| Horizontal padding   | 16px (px-4)                                | Matches panel padding in both `desk-tab.tsx` and `chapter-editor-panel.tsx` |
| Row vertical padding | 8px top, 8px bottom                        | Provides 56px total with two text lines                                     |
| Bottom action height | 48px                                       | Primary action size per charter                                             |

### Row Anatomy

Each instruction row contains two lines of text within a single tappable area:

```
+-------------------------------------------+
|  Label text                           [>] |  <-- Line 1: label (14px semibold)
|  Prompt text preview truncated to o...     |  <-- Line 2: prompt (12px muted, single line)
+-------------------------------------------+
```

| Element           | Typography                                 | Color Token                    | Truncation                                                 |
| ----------------- | ------------------------------------------ | ------------------------------ | ---------------------------------------------------------- |
| Label             | `text-sm font-semibold` (14px, 600 weight) | `var(--dc-color-text-primary)` | Single line, `truncate` (text-overflow: ellipsis)          |
| Prompt preview    | `text-xs` (12px, 400 weight)               | `var(--dc-color-text-muted)`   | Single line, `truncate`, max 80 characters before ellipsis |
| Chevron indicator | 16px, right-aligned                        | `var(--dc-color-text-muted)`   | Only shown in select mode (hidden in manage mode)          |

The chevron (`>`) on the right edge signals "tappable to select." It disappears in manage mode, replaced by edit/delete affordances.

### Search Behavior

The search field sits at the top of the list, sticky within the scroll container. It filters the entire instruction set (both recent and alphabetical sections) by matching against instruction labels using case-insensitive substring matching.

| State                | Behavior                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Empty field**      | Full list displayed: recents section + alphabetical section                                                        |
| **Typing**           | Filter applied immediately on each keystroke (no debounce needed -- this is a local filter, not a network request) |
| **Matches found**    | Recents section hidden; flat alphabetical list of matches shown                                                    |
| **No matches**       | Empty state: "No instructions match your search." with a "Create new instruction" action                           |
| **Clear (X button)** | Returns to full list. X button appears when field has content. Touch target: 44px                                  |

The search field uses the Lucide `Search` icon (16px) as a leading icon inside the input. Placeholder text: "Search instructions". The field does NOT auto-focus on component mount -- this prevents the virtual keyboard from appearing immediately on iPad when the user just wants to browse.

### Recents Section

The "RECENT" section shows the 3 most recently _used_ instructions for the current context. "Used" means the instruction was selected (tapped) to trigger an action -- not merely viewed or edited.

| Rule          | Detail                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Maximum items | 3                                                                                                                              |
| Ordering      | Most recent first                                                                                                              |
| Scope         | Per-context. Desk recents are separate from Chapter recents and Book recents                                                   |
| Storage       | Client-side, in `localStorage` keyed by `dc_instruction_recents_{context}` where context is `"desk"`, `"chapter"`, or `"book"` |
| Deduplication | An instruction appears once in recents, even if used multiple times                                                            |
| Section label | "RECENT" -- `text-[10px] font-medium tracking-wider uppercase` using `var(--dc-color-text-muted)`                              |
| Separator     | `border-b border-[var(--color-border)]` below the last recent row                                                              |
| Empty recents | Section hidden entirely (no "RECENT" label, no separator). The alphabetical section fills the space                            |

When the user taps an instruction, it is pushed to the front of the recents array for that context. If the array exceeds 3, the oldest is dropped.

### Alphabetical Section

All instructions for the current context, sorted alphabetically by label (locale-aware, case-insensitive). This section always appears, even when the recents section is populated -- instructions can appear in both sections.

| Rule          | Detail                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section label | "ALL" -- same styling as "RECENT" label                                                                                                           |
| Ordering      | `label.localeCompare(otherLabel, undefined, { sensitivity: 'base' })`                                                                             |
| No grouping   | No sub-headers by first letter. The list is short enough (typically 4-15 items) that alphabetical ordering alone provides sufficient scannability |

---

## Select Flow

### Flow 1: Desk (Source Analysis)

**Context:** User is in the Library panel, Desk tab, with documents selected. They want to choose an analysis instruction.

| Step | User Action                                                                       | System Response                                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | User has documents tagged to the Desk and some selected via checkboxes            | Instruction area is visible in Zone A of the Desk tab                                                                                                                                                |
| 2    | User sees the instruction list populated with their analysis instructions         | Recents section shows up to 3 most recently used analysis instructions. All section shows full alphabetical list                                                                                     |
| 3    | User scrolls or searches to find desired instruction                              | List scrolls vertically. Search filters in real time                                                                                                                                                 |
| 4    | User taps an instruction row                                                      | Row shows brief active state (background flash `var(--dc-color-interactive-primary-subtle)`, 150ms). Instruction text is populated into the textarea below the list. Instruction is added to recents |
| 5    | User can edit the populated instruction text in the textarea, or proceed directly | Textarea reflects selected instruction text                                                                                                                                                          |
| 6    | User taps "Analyze N documents" button                                            | Analysis begins with the instruction text from the textarea                                                                                                                                          |

**Key change from current:** The `InstructionSetPicker` chips and `InstructionPicker` "Use saved instruction" dropdown are both replaced by the unified list. The freeform textarea remains below the list -- it shows the text of the selected instruction and allows editing before submission. The list _selects_ an instruction; the textarea _holds_ it.

**Integration point:** The instruction list replaces lines 198-238 in `desk-tab.tsx` (the chip picker + saved instructions picker area). The textarea at line 212 remains.

### Flow 2: Chapter Editor (Rewrite)

**Context:** User has text selected in the editor, the Editor panel is open, and they want to choose a rewrite instruction.

| Step | User Action                                                 | System Response                                                                                                                                                |
| ---- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | User selects text in the editor                             | Selection appears in the "Selected text" disclosure in the panel                                                                                               |
| 2    | User sees the instruction list below the selected text area | Recents section shows up to 3 most recently used rewrite instructions. All section shows full alphabetical list                                                |
| 3    | User taps an instruction row                                | Row shows brief active state (background flash `var(--dc-color-interactive-escalation-subtle)`, 150ms). Rewrite begins immediately with the tapped instruction |
| 4    | Panel transitions to streaming state                        | Streaming response area appears. Instruction list collapses or scrolls out of view as the response area grows                                                  |

**Critical difference from Desk flow:** In the Chapter Editor, tapping an instruction _immediately triggers the rewrite_. There is no intermediate textarea step. The instruction text is sent directly. This matches the current chip behavior -- tap a chip, rewrite starts. The freeform textarea ("Custom instruction") remains as a separate input below the instruction list for when the user wants to write something not in their library.

**Integration point:** The instruction list replaces lines 231-259 in `chapter-editor-panel.tsx` (the chip rendering area) and lines 310-324 (the `InstructionPicker` below the textarea). The freeform custom instruction textarea at line 272 remains, but the label changes from "Custom instruction" to "Or write your own".

### Flow 3: Book Editor (Cross-Chapter Analysis)

**Context:** User is in Book view with the Editor panel open, showing the Book Editor variant. They want to analyze across chapters.

| Step | User Action                                    | System Response                                                                                                                                                                            |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | User opens the Editor panel while in Book view | Panel header reads "Book Editor". Instruction list shows book-context instructions                                                                                                         |
| 2    | User sees the instruction list                 | Recents section shows up to 3 most recently used book analysis instructions. All section shows full alphabetical list                                                                      |
| 3    | User taps an instruction row                   | Instruction text populates into the textarea. Book-level analysis does not auto-trigger (same pattern as Desk -- analysis requires explicit submit because multiple chapters are involved) |
| 4    | User taps "Analyze" button                     | Cross-chapter analysis begins                                                                                                                                                              |

**Note:** The Book Editor panel does not exist yet. This flow documents the target behavior for when it ships.

---

## CRUD Flows

### Create: Adding a New Instruction

The "New instruction" action sits at the bottom of the instruction list as a sticky button, always visible regardless of scroll position.

| Step | User Action                                                     | System Response                                                                                                                                                                        |
| ---- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | User taps "+ New instruction" at the bottom of the list         | An inline form expands in-place at the bottom of the list, pushing the button down. The form contains two fields: Label (single-line input) and Instruction text (multi-line textarea) |
| 2    | User types a label (required, max 100 characters)               | Character count not shown unless approaching limit (visible at 80+). Label input auto-focuses                                                                                          |
| 3    | User types the instruction text (required, max 2000 characters) | Textarea starts at 3 rows, auto-expands up to 6 rows                                                                                                                                   |
| 4    | User taps "Save"                                                | Instruction is created via POST to `/ai/instructions`. Optimistic: appears immediately in the alphabetical list. Save button shows brief spinner. Form collapses                       |
| 5    | —                                                               | If the API call fails, the instruction is removed from the list and a toast shows "Could not save instruction. Please try again."                                                      |

**Alternative: User taps "Cancel"** -- form collapses, no changes saved. No confirmation needed (Nothing Precious principle).

**Form layout:**

```
+---------------------------------------+
| Label                                  |
| [________________________________]     |  <-- Single-line input, 44px height
|                                        |
| Instruction                            |
| [________________________________]     |  <-- Textarea, 3-6 rows
| [________________________________]     |
| [________________________________]     |
|                                        |
| [Cancel]                    [Save]     |  <-- 44px height buttons
+---------------------------------------+
```

The form uses the same inline pattern as the current `InstructionPicker` create form (lines 208-253 of `instruction-picker.tsx`), but with improved field labels and sizing.

**Context assignment:** The instruction's `type` is determined automatically by the context in which it was created. Creating an instruction from the Desk tab assigns `type: "analysis"`. Creating from the Chapter Editor assigns `type: "rewrite"`. The user never sees or chooses the type.

**Database type evolution:** The current schema supports only `"analysis" | "rewrite"`. Book Editor instructions need a third type. This requires a migration to add `"book_analysis"` (or a schema redesign to use a three-value context enum: `"desk" | "chapter" | "book"`). This is an implementation detail flagged for the engineering contribution. The interaction design treats the three contexts as separate instruction pools regardless of how the backend stores them.

### Edit: Modifying an Existing Instruction

Editing is available through manage mode (see Manage Mode section below). The edit interaction uses an inline expansion pattern -- the same row expands to reveal editable fields.

| Step | User Action                                                                    | System Response                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | User is in manage mode. User taps the pencil (edit) icon on an instruction row | The row expands inline to show the Label input (pre-filled) and Instruction text textarea (pre-filled). Other rows remain visible but non-interactive (dimmed slightly, `opacity-60`)                              |
| 2    | User modifies the label and/or instruction text                                | Changes are local until saved                                                                                                                                                                                      |
| 3    | User taps "Save"                                                               | Optimistic update: the row collapses and shows the updated label/preview immediately. PATCH request sent to `/ai/instructions/:id`. If it fails, the row reverts and a toast shows "Could not update instruction." |
| 4    | —                                                                              | User remains in manage mode, can edit another instruction or tap "Done"                                                                                                                                            |

**Alternative: User taps "Cancel"** -- row collapses to its original state. No changes persisted.

The edit form is identical in structure to the create form but pre-populated with existing values. Only one row can be in edit state at a time -- tapping edit on a second row cancels the first.

### Delete: Removing an Instruction

Deletion is available through manage mode. The interaction differs based on instruction origin:

**Seeded default instructions:** Deletable. Once deleted, they are gone for that user. There is no "restore defaults" action. This is a conscious decision -- if the user deleted a seeded instruction, they chose to. They can always re-create it manually.

**User-created instructions:** Deletable. Same behavior.

| Step | User Action                                                            | System Response                                                                                |
| ---- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1    | User is in manage mode. User taps the trash icon on an instruction row | Instruction is removed immediately (optimistic). DELETE request sent to `/ai/instructions/:id` |
| 2    | —                                                                      | A toast appears: "Instruction deleted" with an "Undo" action (toast persists for 5 seconds)    |
| 3a   | User taps "Undo" within 5 seconds                                      | Instruction is restored. The DELETE is rolled back (if already sent, a POST re-creates it)     |
| 3b   | User does nothing                                                      | Toast dismisses. Deletion is permanent                                                         |

**No confirmation dialog.** The Nothing Precious principle applies. Deletion is undoable via the toast, which provides sufficient safety without interrupting flow.

---

## Empty States

### No Instructions (All Deleted)

This should be extremely rare because accounts are seeded with defaults. But if a user deletes all instructions:

```
+---------------------------------------+
|                                        |
|  [list icon, 24px, muted]             |
|                                        |
|  No instructions yet.                  |
|  Create one to get started.            |
|                                        |
|  [+ New instruction]                   |  <-- Primary action button, 44px
|                                        |
+---------------------------------------+
```

- Icon: Lucide `ListPlus`, 24px, `var(--dc-color-text-muted)`
- Heading: `text-sm font-medium`, `var(--dc-color-text-secondary)`
- Body: `text-sm`, `var(--dc-color-text-muted)`
- Button: text-only, `var(--dc-color-interactive-primary)` for Desk/Book contexts, `var(--dc-color-interactive-escalation)` for Chapter Editor context

### Search Returns No Results

```
+---------------------------------------+
| [magnifying glass] "tighten ar|"  [X]  |
+---------------------------------------+
|                                        |
|  No instructions match your search.    |
|                                        |
|  [+ Create "tighten ar..." as new]     |  <-- Contextual create action
|                                        |
+---------------------------------------+
```

- The create action pre-fills the search text as the label for the new instruction
- Tapping it opens the create form with the label pre-populated
- If the search text exceeds 100 characters (label max), it is truncated with ellipsis in the button text

---

## Manage Mode

### Activation

The instruction list has a small "Manage" link in the list header, next to the section/list title area. This is the same pattern used in the current `InstructionPicker` (line 88-91 of `instruction-picker.tsx`).

```
+---------------------------------------+
| [Search instructions...       ]       |
+---------------------------------------+
| RECENT                        Manage  |  <-- "Manage" link in the section header area
|                                        |
| [ Simpler language         ]          |
| ...                                    |
```

| State                     | Header Shows  | Behavior                                                                                                                      |
| ------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Select mode** (default) | "Manage" link | Tapping a row selects the instruction                                                                                         |
| **Manage mode**           | "Done" link   | Tapping a row does nothing. Edit (pencil) and delete (trash) icons appear on each row. New instruction button remains visible |

### Manage Mode Row Layout

```
+-------------------------------------------+
|  Label text                     [pen][bin]|
|  Prompt text preview truncated...         |
+-------------------------------------------+
```

| Element             | Size | Touch Target           | Position                 |
| ------------------- | ---- | ---------------------- | ------------------------ |
| Edit (pencil) icon  | 16px | 44x44px (with padding) | Right side, before trash |
| Delete (trash) icon | 16px | 44x44px (with padding) | Right side, after edit   |

Both icons use `var(--dc-color-text-muted)` in resting state. The delete icon uses `var(--dc-color-status-error)` on hover/active.

### Exiting Manage Mode

- Tapping "Done" returns to select mode
- There is no auto-exit. The user explicitly exits manage mode
- If the user navigates away (closes the panel, switches tabs), manage mode resets to select mode on next open

---

## Context Integration

### Desk Tab (Library Panel, Right Side, Blue Zone)

**Current location:** `web/src/components/sources/desk-tab.tsx`, Zone A (lines 188-239)

**Current structure:**

```
Zone A: Instruction label + InstructionSetPicker chips + textarea + InstructionPicker dropdown
Zone B: Document list + analysis results
Zone C: Action bar (Analyze button)
```

**New structure:**

```
Zone A: InstructionList (unified) + textarea
Zone B: Document list + analysis results
Zone C: Action bar (Analyze button)
```

The instruction list replaces both the `InstructionSetPicker` and the `InstructionPicker`. The freeform textarea remains immediately below the list. The textarea shows the selected instruction's text and allows editing before submission.

**Zone A height constraint:** The existing `max-h-[50%]` cap on Zone A remains. The instruction list scrolls internally within this constraint.

**Color tokens for active states:** The Desk tab is in the blue zone. Instruction row active states use `var(--dc-color-interactive-primary-subtle)` for the tap highlight.

### Chapter Editor Panel (Editor Panel, Left Side, Violet Zone)

**Current location:** `web/src/components/editor/chapter-editor-panel.tsx` (lines 230-325)

**Current structure:**

```
Selected text disclosure
Instruction chips (5 hardcoded)
Custom instruction textarea + send button
InstructionPicker dropdown
Streaming response area
Action buttons
```

**New structure:**

```
Selected text disclosure
InstructionList (unified) -- tap triggers immediate rewrite
Custom instruction textarea + send button (labeled "Or write your own")
Streaming response area
Action buttons
```

The instruction list appears between the selected text disclosure and the custom instruction field. Tapping a row in the list immediately triggers a rewrite (no intermediate textarea step). The custom instruction textarea remains for freeform input.

**Height behavior:** The instruction list starts at a natural height showing approximately 3-4 visible rows (roughly 180-224px). When the streaming response area appears, the list and custom instruction field scroll up. The list does not have a fixed max-height -- it participates in the natural scroll of the panel content area.

**Color tokens for active states:** The Chapter Editor is in the violet zone. Instruction row active states use `var(--dc-color-interactive-escalation-subtle)` for the tap highlight.

### Book Editor Panel (Editor Panel, Left Side, Violet Zone)

**Target location:** Future `web/src/components/editor/book-editor-panel.tsx`

**Structure (planned):**

```
Chapter selection / scope indicator
InstructionList (unified) -- tap populates textarea
Instruction textarea + submit button
Analysis results area
Action buttons
```

Same violet-zone color tokens as the Chapter Editor.

---

## Responsive Behavior

### Panel Width Constraints

The instruction list fills the width of its parent panel. Panel widths are:

| Breakpoint              | Panel Width                    | List Width                                        |
| ----------------------- | ------------------------------ | ------------------------------------------------- |
| Portrait (<1024px)      | Full screen overlay, max 380px | 100% of panel minus 32px (16px padding each side) |
| Landscape (1024-1279px) | 320px persistent               | 288px (320px - 32px padding)                      |
| Desktop (1280px+)       | 320px persistent               | 288px (320px - 32px padding)                      |

### Portrait vs. Landscape Adaptations

| Aspect                     | Portrait                              | Landscape / Desktop                                       |
| -------------------------- | ------------------------------------- | --------------------------------------------------------- |
| Search field               | Visible, same size                    | Visible, same size                                        |
| Row height                 | 56px min                              | 56px min                                                  |
| Visible rows before scroll | ~5-6 (more vertical space in overlay) | ~3-4 (shares space with textarea and other panel content) |
| "New instruction" button   | Sticky at bottom                      | Sticky at bottom                                          |
| Manage mode icons          | Same size, same touch targets         | Same size, same touch targets                             |

The list does not change its internal layout between portrait and landscape. The only difference is available height, which is handled by the scroll container.

### Virtual Keyboard Handling

When the search field or create/edit form fields receive focus on iPad Safari:

1. The virtual keyboard pushes the viewport up (standard iOS behavior with `100dvh`)
2. The instruction list's scroll container remains functional
3. The sticky search field and sticky bottom button remain positioned correctly within the scroll container
4. No special keyboard-height offset is needed for the instruction list itself (the parent panel handles keyboard avoidance)

---

## Keyboard Navigation

The instruction list supports full keyboard navigation for accessibility (WCAG 2.1 AA) and for users with external keyboards on iPad.

### ARIA Structure

```html
<div role="listbox" aria-label="{context} instructions" aria-orientation="vertical">
  <!-- Search field is outside the listbox, before it -->
  <input type="search" aria-label="Search instructions" />

  <!-- Recent section -->
  <div role="group" aria-label="Recent instructions">
    <div role="option" aria-selected="false" tabindex="-1">...</div>
    <div role="option" aria-selected="false" tabindex="-1">...</div>
  </div>

  <!-- All section -->
  <div role="group" aria-label="All instructions">
    <div role="option" aria-selected="false" tabindex="0">...</div>
    <div role="option" aria-selected="false" tabindex="-1">...</div>
  </div>
</div>
```

### Key Bindings

| Key                    | Context                                    | Action                                                                                           |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `Tab`                  | From any element before the list           | Focus moves to the search field                                                                  |
| `Tab` (from search)    | Search field                               | Focus moves to the first option in the listbox                                                   |
| `ArrowDown`            | Within listbox                             | Focus moves to the next option. Wraps from last to first                                         |
| `ArrowUp`              | Within listbox                             | Focus moves to the previous option. Wraps from first to last                                     |
| `Enter`                | Option focused                             | Selects the instruction (equivalent to tap). In manage mode: opens edit form for the focused row |
| `Escape`               | Search field has content                   | Clears the search field                                                                          |
| `Escape`               | Search field is empty, or focus in listbox | Returns focus to the element that opened the panel (focus restoration per charter)               |
| `Home`                 | Within listbox                             | Focus moves to the first option                                                                  |
| `End`                  | Within listbox                             | Focus moves to the last option                                                                   |
| `Delete` / `Backspace` | Option focused, manage mode active         | Deletes the instruction (with undo toast)                                                        |
| `Tab` (from listbox)   | Last element focus                         | Focus moves to the "New instruction" button                                                      |

### Focus Management

- When the list first renders, no row is focused. The user must Tab or ArrowDown into the list
- When an instruction is deleted in manage mode, focus moves to the next row (or the previous row if the deleted item was last)
- When the create/edit form opens, focus moves to the label input field
- When the create/edit form closes (save or cancel), focus returns to the row that triggered it (for edit) or to the "New instruction" button (for create)

### Screen Reader Announcements

| Event                 | Announcement (`aria-live="polite"`)              |
| --------------------- | ------------------------------------------------ |
| Search filter applied | "{N} instructions found"                         |
| Search no results     | "No instructions match your search"              |
| Instruction selected  | "{label} selected" (in select mode)              |
| Instruction deleted   | "{label} deleted. Undo available for 5 seconds." |
| Instruction created   | "{label} saved"                                  |
| Mode switch           | "Manage mode" / "Select mode"                    |

---

## Component Props Interface

```typescript
interface InstructionListProps {
  /** Which context this list serves -- determines instruction pool and behavior */
  context: 'desk' | 'chapter' | 'book'

  /** Instructions to display (fetched from API, filtered by context) */
  instructions: AIInstruction[]

  /** Whether instructions are still loading */
  isLoading: boolean

  /** Called when the user selects an instruction */
  onSelect: (instruction: AIInstruction) => void

  /** Called to create a new instruction */
  onCreate: (input: { label: string; instructionText: string }) => Promise<void>

  /** Called to update an existing instruction */
  onUpdate: (id: string, input: { label?: string; instructionText?: string }) => Promise<void>

  /** Called to delete an instruction */
  onDelete: (id: string) => Promise<void>

  /** Whether the list is disabled (e.g., during streaming) */
  disabled?: boolean

  /** Color zone for active states -- determines which accent color to use */
  zone: 'library' | 'editor'
}
```

The `zone` prop determines the color tokens used for active/highlight states:

- `"library"` (blue): used in Desk tab and Book Editor (right panel and left panel respectively -- but both are analysis contexts using the primary blue)
- `"editor"` (violet): used in Chapter Editor

**Correction on zones:** The Book Editor lives in the left panel (violet zone), same as the Chapter Editor. The `zone` prop maps to the panel's spatial position, not the instruction type. Desk (right panel) = `"library"` = blue. Chapter Editor and Book Editor (left panel) = `"editor"` = violet.

---

## Loading State

When instructions are being fetched from the API:

```
+---------------------------------------+
| [Search instructions...       ]       |  <-- Disabled, not interactive
+---------------------------------------+
|                                        |
|  [skeleton line ████████████]          |
|  [skeleton line ██████████████]        |
|                                        |
|  [skeleton line ██████████]            |
|  [skeleton line ████████████████]      |
|                                        |
|  [skeleton line ████████████████]      |
|  [skeleton line ██████████]            |
|                                        |
+---------------------------------------+
```

Three skeleton rows with two lines each. Skeleton uses `var(--dc-color-surface-tertiary)` with a subtle pulse animation (standard `animate-pulse`, which respects `prefers-reduced-motion`).

---

## Error State

If the instruction fetch fails:

```
+---------------------------------------+
|                                        |
|  Could not load instructions.          |
|  [Tap to retry]                        |
|                                        |
+---------------------------------------+
```

- Error text: `text-sm`, `var(--dc-color-status-error)`
- Retry link: `text-sm`, `var(--dc-color-interactive-primary)`, 44px touch target
- The error state replaces the entire list content. The search field is hidden

---

## Migration Path from Current Components

### Files to Create

| File                                         | Purpose                                            |
| -------------------------------------------- | -------------------------------------------------- |
| `web/src/components/ui/instruction-list.tsx` | The unified instruction list component             |
| `web/src/hooks/use-instruction-recents.ts`   | Hook to manage per-context recents in localStorage |

### Files to Modify

| File                                                 | Change                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `web/src/components/sources/desk-tab.tsx`            | Replace `InstructionSetPicker` + `InstructionPicker` with `InstructionList`        |
| `web/src/components/editor/chapter-editor-panel.tsx` | Replace inline chips + `InstructionPicker` with `InstructionList`                  |
| `web/src/hooks/use-ai-instructions.ts`               | Extend type filter to support three contexts (or fetch all and filter client-side) |
| `web/src/contexts/sources-context.tsx`               | Expose unified instruction CRUD without type-specific splitting                    |

### Files to Retire

| File                                                | Reason                                                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/components/instruction-set-picker.tsx`     | Replaced entirely by `InstructionList`. The hardcoded `CHAPTER_INSTRUCTIONS`, `BOOK_INSTRUCTIONS`, `DESK_INSTRUCTIONS` constants become seed data in the database migration |
| `web/src/components/sources/instruction-picker.tsx` | Replaced entirely by `InstructionList`                                                                                                                                      |

### Database Changes Required

The `ai_instructions` table's `type` column currently allows `"analysis" | "rewrite"`. This needs to expand to support three contexts: `"desk" | "chapter" | "book"`. A migration should:

1. Add `"desk"` as an alias for existing `"analysis"` rows
2. Map `"rewrite"` rows to `"chapter"`
3. Seed all three instruction sets for all existing users (currently only partial seeding exists in migration 0020)
4. Update the CHECK constraint

This is an engineering decision that should be specified in the engineering contribution, but the interaction design requires three distinct instruction pools.

---

## Summary of Key Decisions

| Decision                 | Choice                                                                   | Rationale                                                                                |
| ------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| List layout              | Vertical scrollable, NOT chips                                           | Anti-pattern from charter: "no chips for instruction selection"                          |
| Recents                  | 3 most recently used, client-side localStorage                           | Lightweight, no API needed, per-context isolation                                        |
| Search                   | Client-side substring filter, no debounce                                | Instruction count is small (4-15 typical), instant filtering is appropriate              |
| Tap behavior (Desk/Book) | Populates textarea, does not auto-submit                                 | Analysis requires document selection + instruction -- two-step process                   |
| Tap behavior (Chapter)   | Triggers immediate rewrite                                               | Matches current chip behavior -- text is already selected, instruction is the only input |
| Create form              | Inline at bottom of list                                                 | Same pattern as current `InstructionPicker`, no separate screen needed                   |
| Edit form                | Inline row expansion                                                     | Keeps context visible, no navigation away                                                |
| Delete                   | Immediate with undo toast (5 seconds)                                    | Nothing Precious principle. No confirmation dialog                                       |
| Manage mode              | Toggle via "Manage" / "Done" link                                        | Same pattern as current `InstructionPicker`, proven to work                              |
| Default instructions     | Seeded in DB at account creation, deletable                              | All instructions are equal. No visual distinction between seeded and user-created        |
| Color zone               | Blue for Desk (right panel), Violet for Chapter/Book Editor (left panel) | Matches spatial model from Design Charter Section 6                                      |
