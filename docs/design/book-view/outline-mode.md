# Book View — Outline Mode Design Specification

**Issue:** #319
**Status:** Design
**Author:** Design Agent
**Date:** 2026-02-24

---

## 1. Overview

Outline mode provides a structural view of the book within the WorkspaceShell center area. It displays chapter cards in a vertical list, showing progress at a glance and enabling quick navigation via tap-to-dive interactions.

### Purpose

- **Progress visibility:** Authors see word counts, completion status, and summaries for all chapters simultaneously
- **Structural navigation:** Tap any chapter to dive into Chapter View with that chapter loaded
- **Reordering:** Drag-to-reorder chapters without leaving the outline context

### Context

Outline mode is one of three Book View modes (Outline, Read, Stats). It occupies the center area of the WorkspaceShell, respecting the CSS Grid layout defined in #316. The sidebar and Library panel remain visible per their breakpoint rules.

---

## 2. Visual Design

### 2.1 Container

The BookOutline component renders inside the WorkspaceShell center area.

```
┌─────────────────────────────────────────────────────────────────────┐
│ WorkspaceShell center area                                          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ BookOutline                                                      │ │
│ │ ┌───────────────────────────────────────────────────────────┐   │ │
│ │ │ ChapterCard (Chapter 1)                                    │   │ │
│ │ └───────────────────────────────────────────────────────────┘   │ │
│ │ ┌───────────────────────────────────────────────────────────┐   │ │
│ │ │ ChapterCard (Chapter 2)                                    │   │ │
│ │ └───────────────────────────────────────────────────────────┘   │ │
│ │ ┌───────────────────────────────────────────────────────────┐   │ │
│ │ │ ChapterCard (Chapter 3)                                    │   │ │
│ │ └───────────────────────────────────────────────────────────┘   │ │
│ │                           ...                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Container styling:**

| Property   | Value                                                | Notes                                   |
| ---------- | ---------------------------------------------------- | --------------------------------------- |
| Background | `--dc-color-surface-secondary` (initially `#f9fafb`) | Subtly differentiates from editor white |
| Padding    | `24px`                                               | Comfortable breathing room              |
| Max width  | `680px`                                              | Matches chapter editor prose width      |
| Margin     | `0 auto`                                             | Centered in available space             |
| Overflow   | `auto`                                               | Vertical scroll when needed             |
| Min height | `100%`                                               | Fills center area                       |

**CSS custom property definition (add to globals.css):**

```css
:root {
  --dc-color-surface-secondary: #f9fafb;
}
```

### 2.2 Chapter Card

Each chapter is represented by a card containing metadata and a tap target for navigation.

```
┌────────────────────────────────────────────────────────────────────┐
│ ⠿  │  Chapter 1: The Beginning                      │ 2,340 words │
│    │  ──────────────────────────────────────────────│             │
│    │  Setting up the core concepts and introducing  │   ● Draft   │
│    │  the primary characters...                     │             │
└────────────────────────────────────────────────────────────────────┘
```

**Card structure:**

| Zone        | Content                    | Typography                                  | Notes                             |
| ----------- | -------------------------- | ------------------------------------------- | --------------------------------- |
| Drag handle | Grip dots (⠿)              | —                                           | 44px×44px touch target            |
| Title       | Chapter title              | Lora 20px/600 (`--font-serif`)              | Truncated with ellipsis if needed |
| Word count  | "X,XXX words"              | Geist Sans 14px, `tabular-nums`             | Right-aligned                     |
| Summary     | First 100 chars of chapter | Geist Sans 14px, `--color-muted-foreground` | 2-line clamp                      |
| Status      | Colored dot + label        | Geist Sans 12px                             | See status indicators below       |

**Card dimensions:**

| Property          | Value                           | Notes                               |
| ----------------- | ------------------------------- | ----------------------------------- |
| Min height        | `88px`                          | Comfortable touch target            |
| Padding           | `16px`                          | Internal spacing                    |
| Border radius     | `8px`                           | Consistent with existing components |
| Background        | `#ffffff`                       | White card on gray surface          |
| Border            | `1px solid var(--color-border)` | Subtle definition                   |
| Gap between cards | `12px`                          | Visual separation                   |
| Shadow            | `0 1px 3px rgba(0,0,0,0.1)`     | Subtle elevation                    |

### 2.3 Status Indicators

Chapter status is indicated by a colored dot and label:

| Status     | Dot color               | Label        | Description                     |
| ---------- | ----------------------- | ------------ | ------------------------------- |
| Draft      | `#fbbf24` (amber-400)   | "Draft"      | Initial state, work in progress |
| Review     | `#60a5fa` (blue-400)    | "Review"     | Ready for review                |
| Complete   | `#34d399` (emerald-400) | "Complete"   | Chapter finalized               |
| Needs work | `#f87171` (red-400)     | "Needs work" | Flagged for revision            |

**Visual treatment:**

```
● Draft     (amber dot, muted text)
```

- Dot: 8px diameter, inline with label
- Label: 12px, `--color-muted-foreground`

### 2.4 Typography

| Element       | Font       | Size | Weight | Line height | Color                      |
| ------------- | ---------- | ---- | ------ | ----------- | -------------------------- |
| Chapter title | Lora       | 20px | 600    | 1.4         | `--color-foreground`       |
| Word count    | Geist Sans | 14px | 500    | 1.2         | `--color-foreground`       |
| Summary       | Geist Sans | 14px | 400    | 1.5         | `--color-muted-foreground` |
| Status label  | Geist Sans | 12px | 500    | 1           | `--color-muted-foreground` |

---

## 3. Interactions

### 3.1 Tap-to-Dive

Tapping a chapter card title navigates to Chapter View with that chapter loaded.

**Behavior:**

1. User taps chapter title (not drag handle)
2. URL updates: `/editor/{projectId}?view=chapter&chapter={chapterId}`
3. Workspace toggle switches to "Chapter" (see #318)
4. Center area transitions (300ms crossfade) to Chapter View
5. Editor loads selected chapter at cursor position 0
6. Sidebar highlights the selected chapter

**Touch target:**

- The entire card (excluding drag handle) is tappable
- Minimum tap area: 88px × full card width
- Visual feedback: card background transitions to `#f3f4f6` on press

**Keyboard navigation:**

- Enter/Space on focused card activates tap-to-dive
- Focus ring: `2px solid #3b82f6` with 2px offset

### 3.2 Drag-to-Reorder

Long-press and drag a chapter card to reorder it in the outline.

**Implementation:** Reuse existing `@dnd-kit` patterns from sidebar.tsx:

```typescript
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
```

**Sensor configuration:**

| Sensor         | Activation                     | Notes                            |
| -------------- | ------------------------------ | -------------------------------- |
| PointerSensor  | `{ distance: 8 }`              | Mouse/trackpad                   |
| TouchSensor    | `{ delay: 250, tolerance: 5 }` | Long-press for iPad              |
| KeyboardSensor | Arrow keys                     | With sortableKeyboardCoordinates |

**Drag handle:**

- 44px × 44px touch target (meets minimum)
- Grip dots icon (6 dots in 2×3 grid)
- `cursor: grab` on hover, `cursor: grabbing` when active
- Color: `--color-muted-foreground`, darker on hover

**Visual feedback during drag:**

| State             | Visual                                                      |
| ----------------- | ----------------------------------------------------------- |
| Idle              | Normal card appearance                                      |
| Dragging (source) | `opacity: 0.4`                                              |
| Drag overlay      | `shadow-lg`, `border-color: #3b82f6`, slight scale (`1.02`) |
| Drop target       | 2px top border in `#3b82f6`                                 |

**Keyboard alternative:**

- Ctrl+ArrowUp / Ctrl+ArrowDown moves focused chapter
- Consistent with sidebar behavior

### 3.3 Scroll Behavior

- Container scrolls vertically when content exceeds viewport
- Smooth scroll with `scroll-behavior: smooth`
- Momentum scrolling enabled for iPad (`-webkit-overflow-scrolling: touch`)

---

## 4. Accessibility

### 4.1 ARIA Tree Pattern

The outline uses `role="tree"` with chapters as `role="treeitem"`:

```html
<div role="tree" aria-label="Book outline">
  <div role="treeitem" aria-selected="false" tabindex="0">Chapter 1: The Beginning</div>
  <div role="treeitem" aria-selected="false" tabindex="-1">Chapter 2: Rising Action</div>
  <!-- ... -->
</div>
```

**Attributes:**

| Element      | Attribute       | Value                               |
| ------------ | --------------- | ----------------------------------- |
| Container    | `role`          | `"tree"`                            |
| Container    | `aria-label`    | `"Book outline"`                    |
| Chapter card | `role`          | `"treeitem"`                        |
| Chapter card | `aria-selected` | `"true"` when focused/active        |
| Chapter card | `tabindex`      | `0` for first item, `-1` for others |

### 4.2 Keyboard Navigation

| Key               | Action                         |
| ----------------- | ------------------------------ |
| Arrow Down        | Move focus to next chapter     |
| Arrow Up          | Move focus to previous chapter |
| Home              | Move focus to first chapter    |
| End               | Move focus to last chapter     |
| Enter / Space     | Activate tap-to-dive           |
| Ctrl + Arrow Up   | Move chapter up (reorder)      |
| Ctrl + Arrow Down | Move chapter down (reorder)    |

### 4.3 Screen Reader Announcements

- On focus: "{Chapter title}, {word count} words, {status}. Chapter {n} of {total}."
- After reorder: "Chapter moved to position {n}."
- After tap-to-dive: "Loading {chapter title} in Chapter View."

### 4.4 Focus Management

- First chapter receives focus when outline loads
- Focus is visible with 2px blue ring
- Focus returns to triggering element after dialogs/sheets close

---

## 5. Component Specification

### 5.1 BookOutline

**Props interface:**

```typescript
interface BookOutlineProps {
  /** List of chapters with metadata */
  chapters: ChapterOutlineData[];
  /** Callback when chapter order changes */
  onReorder: (chapterIds: string[]) => Promise<void>;
  /** Callback when user taps a chapter to edit it */
  onChapterSelect: (chapterId: string) => void;
  /** Currently selected chapter (for highlighting) */
  selectedChapterId?: string;
}

interface ChapterOutlineData {
  id: string;
  title: string;
  wordCount: number;
  summary: string | null;
  status: ChapterStatus;
  sortOrder: number;
}

type ChapterStatus = "draft" | "review" | "complete" | "needs-work";
```

**File location:** `web/src/components/book/book-outline.tsx`

### 5.2 ChapterCard

**Props interface:**

```typescript
interface ChapterCardProps {
  chapter: ChapterOutlineData;
  index: number;
  totalChapters: number;
  isSelected: boolean;
  onSelect: () => void;
  isDragging: boolean;
  isDragOverlay: boolean;
  dragListeners?: Record<string, unknown>;
}
```

**File location:** `web/src/components/book/chapter-card.tsx`

### 5.3 CSS Additions

Add to `globals.css`:

```css
/* ------------------------------------------------------------------
 * Book View — Outline Mode (#319)
 *
 * Structural view showing all chapters as cards.
 * ------------------------------------------------------------------ */

:root {
  --dc-color-surface-secondary: #f9fafb;
  --dc-color-status-draft: #fbbf24;
  --dc-color-status-review: #60a5fa;
  --dc-color-status-complete: #34d399;
  --dc-color-status-needs-work: #f87171;
}

.book-outline {
  background: var(--dc-color-surface-secondary);
  padding: 24px;
  max-width: 680px;
  margin: 0 auto;
  min-height: 100%;
}

.chapter-card {
  background: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  min-height: 88px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: background-color 150ms ease-out;
}

.chapter-card:hover {
  background-color: #fafafa;
}

.chapter-card:active {
  background-color: #f3f4f6;
}

.chapter-card-dragging {
  opacity: 0.4;
}

.chapter-card-overlay {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border-color: #3b82f6;
  transform: scale(1.02);
}

.chapter-card-title {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-foreground);
}

.chapter-card-word-count {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--color-foreground);
}

.chapter-card-summary {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--color-muted-foreground);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chapter-card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-muted-foreground);
}

.chapter-card-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.chapter-card-status-dot--draft {
  background-color: var(--dc-color-status-draft);
}

.chapter-card-status-dot--review {
  background-color: var(--dc-color-status-review);
}

.chapter-card-status-dot--complete {
  background-color: var(--dc-color-status-complete);
}

.chapter-card-status-dot--needs-work {
  background-color: var(--dc-color-status-needs-work);
}

.chapter-card-drag-handle {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: var(--color-muted-foreground);
  touch-action: none;
  user-select: none;
}

.chapter-card-drag-handle:hover {
  color: var(--color-foreground);
}

.chapter-card-drag-handle:active {
  cursor: grabbing;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .chapter-card {
    transition: none;
  }

  .chapter-card-overlay {
    transform: none;
  }
}
```

---

## 6. Responsive Behavior

### 6.1 Portrait (768-1023px)

- Full-width cards within center area
- Sidebar collapsed to pill (per WorkspaceShell rules)
- No horizontal scrolling

### 6.2 Landscape (1024-1279px)

- Cards max-width 680px, centered
- Sidebar persistent/collapsible
- One panel can be persistent alongside outline

### 6.3 Desktop (1280px+)

- Cards max-width 680px, centered
- Sidebar always persistent
- Both panels can be persistent

### 6.4 Container Query

Use container query for card internal layout adaptation if center area width drops below 400px (overlay mode):

```css
@container (max-width: 400px) {
  .chapter-card {
    padding: 12px;
  }

  .chapter-card-title {
    font-size: 18px;
  }

  .chapter-card-summary {
    -webkit-line-clamp: 1;
  }
}
```

---

## 7. Data Requirements

### 7.1 API Endpoint

The outline requires chapter metadata that may not currently be returned by the chapters endpoint.

**Required fields per chapter:**

| Field     | Type           | Source   | Notes                      |
| --------- | -------------- | -------- | -------------------------- |
| id        | string         | Existing | Chapter UUID               |
| title     | string         | Existing | Chapter title              |
| wordCount | number         | Existing | Current word count         |
| sortOrder | number         | Existing | Sort position              |
| summary   | string \| null | **New**  | First 100 chars of content |
| status    | ChapterStatus  | **New**  | Chapter workflow status    |

**Implementation note:** If `summary` and `status` fields don't exist in the database, this design can work with `summary: null` and `status: "draft"` as defaults until schema is updated.

### 7.2 Status Field

Chapter status is a user-assignable metadata field stored in D1.

**Proposed schema addition:**

```sql
ALTER TABLE chapters ADD COLUMN status TEXT DEFAULT 'draft';
```

**Validation:** Status must be one of: `draft`, `review`, `complete`, `needs-work`.

---

## 8. Acceptance Criteria Mapping

| Criterion                                                                                      | Section          | Status    |
| ---------------------------------------------------------------------------------------------- | ---------------- | --------- |
| Chapter cards with: title (Lora H2), word count (tabular-nums), summary text, status indicator | §2.2, §2.3, §2.4 | Specified |
| Surface: `--dc-color-surface-secondary` background                                             | §2.1             | Specified |
| Drag-to-reorder with touch-friendly handle (44px+ target)                                      | §3.2             | Specified |
| Tap chapter title → switches to Chapter View with that chapter loaded                          | §3.1             | Specified |
| Visual hierarchy makes progress visible at a glance                                            | §2.2, §2.3       | Specified |
| Works within WorkspaceShell center area constraints                                            | §2.1, §6         | Specified |
| ARIA: `role="tree"` with `role="treeitem"` for chapters                                        | §4.1             | Specified |
| BookOutline component specification                                                            | §5               | Specified |

---

## 9. Dependencies

| Issue | Title                                 | Relationship                       |
| ----- | ------------------------------------- | ---------------------------------- |
| #316  | WorkspaceShell CSS Grid layout system | BookOutline renders in center area |
| #318  | Chapter/Book view toggle control      | Toggle switches between views      |
| #320  | Book View — Read mode                 | Sibling view mode                  |

---

## 10. Open Questions

1. **Summary generation:** Should summary be auto-generated from chapter content on save, or manually entered by the user? Recommend: auto-generated first 100 chars.

2. **Status persistence:** Where does chapter status live? Recommend: D1 `chapters` table with new `status` column.

3. **Empty state:** What shows when a book has no chapters? Recommend: Centered message "No chapters yet. Add your first chapter from the sidebar." with a ghost card illustration.

---

## Revision History

| Date       | Author       | Changes               |
| ---------- | ------------ | --------------------- |
| 2026-02-24 | Design Agent | Initial specification |
