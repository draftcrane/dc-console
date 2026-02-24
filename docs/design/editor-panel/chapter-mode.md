# Editor Panel: Chapter Mode — Design Specification

> Issue: #317
> Status: Implemented
> Last updated: 2026-02-24

## Overview

The Editor Panel is a left-side persistent panel that replaces the bottom sheet (AIRewriteSheet) for chapter-mode rewriting. It slides from the LEFT side (mirroring the Library panel on the RIGHT), providing a conversational rewrite interface that persists after accept/reject actions.

## Spatial Model

```
+----------+------------------+-----------------------------------+-------------------+
|          |                  |                                   |                   |
| Sidebar  | Editor Panel     |  Center Writing Area              | Library Panel     |
| (ch nav) | (violet accent)  |  (author's words)                 | (blue accent)     |
|          | LEFT, 320px      |                                   | RIGHT, 320px      |
|          |                  |                                   |                   |
+----------+------------------+-----------------------------------+-------------------+
```

Per Design Charter Section 6: Editor on left (violet), Library on right (blue).

## Components

### EditorPanel (`editor-panel.tsx`)

Shell component providing the persistent panel frame. Two variants:

| Variant              | Breakpoint                  | ARIA Role                            | Behavior                           |
| -------------------- | --------------------------- | ------------------------------------ | ---------------------------------- |
| `EditorPanel`        | Desktop/Landscape (1024px+) | `role="complementary"`               | Persistent in grid, `border-right` |
| `EditorPanelOverlay` | Portrait (<1024px)          | `role="dialog"`, `aria-modal="true"` | Fixed overlay, backdrop, slide-in  |

**Header:** "Chapter Editor" title + close (X) button. 12px height, border-bottom.

### ChapterEditorPanel (`chapter-editor-panel.tsx`)

Chapter-specific content rendered inside the EditorPanel shell.

**States:**

| State     | Trigger                     | Content                                                                                       |
| --------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| Empty     | No text selected, no result | Empty state illustration + "Select text in your chapter to start rewriting."                  |
| Ready     | Text selected, no result    | Selected text disclosure + instruction chips + freeform field                                 |
| Streaming | SSE in progress             | Selected text + chips + instruction + streaming response with blinking cursor + Cancel button |
| Complete  | SSE finished                | Full rewrite + Discard / Try Again / Use This buttons                                         |
| Error     | Request failed              | Error message (red) in response area + retry via Try Again                                    |

**Instruction Chips (5 defaults + Custom):**

| Chip           | Instruction Sent                      |
| -------------- | ------------------------------------- |
| Simpler        | "Use simpler language"                |
| Concise        | "Make this more concise"              |
| Conversational | "Make this more conversational"       |
| More direct    | "Make this more direct and assertive" |
| Expand         | "Expand on this with more detail"     |

The "Stronger" chip from the original spec was resolved as "More direct" per Issue #321 interim guidance.

Custom instructions are available via the existing `InstructionPicker` component (saved instructions) and a freeform textarea.

### StreamingResponse (`streaming-response.tsx`)

Reusable component for displaying streaming text with a blinking cursor.

- Uses `aria-busy="true"` during streaming, `aria-live="polite"` for screen reader updates
- Auto-scrolls to bottom during streaming
- Violet background (`--dc-color-interactive-escalation-subtle`) with violet border

## Design Tokens

All defined in `globals.css` `:root`:

```css
--dc-color-interactive-escalation: #7c3aed; /* Violet 600 */
--dc-color-interactive-escalation-subtle: #f5f3ff; /* Violet 50 */
--dc-color-interactive-escalation-hover: #6d28d9; /* Violet 700 */
--dc-color-interactive-escalation-border: #c4b5fd; /* Violet 300 */
```

## Animations

| Animation             | Duration | Easing            | Reduced Motion   |
| --------------------- | -------- | ----------------- | ---------------- |
| Panel slide-in (left) | 200ms    | ease-out          | Instant          |
| Backdrop fade-in      | 200ms    | ease-out          | Instant          |
| Cursor blink          | 1s       | step-end infinite | Static (visible) |

All defined in `globals.css` with `@media (prefers-reduced-motion: reduce)` overrides.

## Accessibility

- **Persistent panel:** `role="complementary"` with `aria-label="Chapter editor"` — does NOT trap focus
- **Overlay panel:** `role="dialog"` with `aria-modal="true"` and `aria-label="Chapter editor"` — traps focus
- **Escape key:** Closes overlay panel
- **Touch targets:** All buttons minimum 44px
- **Instruction chips:** `role="listbox"` with `role="option"` and `aria-selected`
- **Streaming area:** `aria-busy="true"` during streaming, `aria-live="polite"`
- **Focus management:** Overlay returns focus to trigger element on close

## Integration Points

### EditorToolbar

New "Editor" toggle button added to the right actions area, before the "Library" toggle. Uses:

- Violet accent when active (`--dc-color-interactive-escalation-subtle` background)
- Pencil icon (`M15.232 5.232l3.536 3.536m-2.036-5.036...`)
- `aria-pressed` state tracking

### Editor Page

- `editorPanelOpen` state manages visibility
- `editorSelectedText` state tracks current editor selection (updated on selection change)
- Both `EditorPanel` (persistent) and `EditorPanelOverlay` (mobile) render with `ChapterEditorPanel` content
- Shares `aiSheetState`, `aiCurrentResult`, `aiErrorMessage` from `useEditorAI` hook

### Existing AI Rewrite Flow

The panel reuses the existing `useEditorAI` / `useAIRewrite` hooks and the SSE streaming infrastructure. The `AIRewriteSheet` (bottom sheet) continues to exist alongside the panel for backward compatibility during the transition period.

## File Inventory

| File                                                  | Purpose                            |
| ----------------------------------------------------- | ---------------------------------- |
| `web/src/components/editor/editor-panel.tsx`          | Panel shell (persistent + overlay) |
| `web/src/components/editor/chapter-editor-panel.tsx`  | Chapter-mode panel content         |
| `web/src/components/editor/streaming-response.tsx`    | Reusable streaming text display    |
| `web/src/app/globals.css`                             | Design tokens + animations         |
| `web/src/components/editor/editor-toolbar.tsx`        | Updated with Editor toggle button  |
| `web/src/app/(protected)/editor/[projectId]/page.tsx` | Updated with panel integration     |
| `web/test/components/editor-panel.test.tsx`           | 32 tests covering all components   |
| `docs/design/editor-panel/chapter-mode.md`            | This specification                 |
