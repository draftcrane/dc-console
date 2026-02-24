# Book View — Read Mode Design Specification

**Issue:** #320
**Status:** Design
**Author:** Design Agent
**Date:** 2026-02-24

---

## 1. Overview

Read mode provides a continuous reading experience of the full manuscript within the WorkspaceShell center area. It renders all chapters sequentially as a single scrollable document with chapter headings serving as navigation anchors.

### Purpose

- **Full manuscript reading:** Authors can read their entire book as readers will experience it
- **Continuity checking:** Transitions between chapters can be evaluated in context
- **Quick editing access:** Tap any paragraph to jump to that position in Chapter View for editing

### Context

Read mode is one of three Book View modes (Outline, Read, Stats). It occupies the center area of the WorkspaceShell, respecting the CSS Grid layout defined in #316. The sidebar and Library panel remain visible per their breakpoint rules.

---

## 2. Visual Design

### 2.1 Container

The BookReadView component renders inside the WorkspaceShell center area.

```
┌─────────────────────────────────────────────────────────────────────┐
│ WorkspaceShell center area                                          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ BookReadView                                                     │ │
│ │                                                                  │ │
│ │   Chapter 1: The Beginning                                       │ │
│ │   ─────────────────────────────────────────                      │ │
│ │                                                                  │ │
│ │   The morning sun cast long shadows across the valley            │ │
│ │   as Sarah opened her eyes. She had been dreaming again—         │ │
│ │   those strange, vivid dreams that had haunted her since         │ │
│ │   childhood...                                                   │ │
│ │                                                                  │ │
│ │   Chapter 2: Rising Action                                       │ │
│ │   ─────────────────────────────────────────                      │ │
│ │                                                                  │ │
│ │   Three months had passed since that fateful morning...          │ │
│ │                                                                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Container styling:**

| Property   | Value                                         | Notes                               |
| ---------- | --------------------------------------------- | ----------------------------------- |
| Background | `#ffffff`                                     | White, same as chapter editor       |
| Padding    | `24px 32px` (desktop), `16px` (narrow center) | Responsive via container query      |
| Max width  | `680px`                                       | Matches chapter editor prose width  |
| Margin     | `0 auto`                                      | Centered in available space         |
| Overflow-y | `auto`                                        | Vertical scroll for full manuscript |
| Overflow-x | `hidden`                                      | No horizontal scroll                |
| Min height | `100%`                                        | Fills center area                   |
| Scroll     | `smooth`                                      | Smooth scrolling for anchor nav     |

### 2.2 Typography

The typography must match the chapter editor exactly for visual consistency:

| Element         | Font       | Size | Weight | Line height | Color                      | Notes                         |
| --------------- | ---------- | ---- | ------ | ----------- | -------------------------- | ----------------------------- |
| Chapter heading | Lora       | 27px | 600    | 1.4         | `--color-foreground`       | H2 equivalent (18px × 1.5em)  |
| Subheading      | Geist Sans | 22px | 600    | 1.4         | `--color-foreground`       | H3 equivalent (18px × 1.25em) |
| Body text       | Geist Sans | 18px | 400    | 1.75        | `--color-foreground`       | **Matches chapter editor**    |
| Blockquote      | Geist Sans | 18px | 400    | 1.75        | `--color-muted-foreground` | Italic, left border           |
| List items      | Geist Sans | 18px | 400    | 1.75        | `--color-foreground`       | Same as body                  |

**CSS class:** Reuse `.chapter-editor-content` styles from globals.css for the manuscript body. The chapter headings use Lora (serif) as specified in AC.

### 2.3 Chapter Heading Anchors

Each chapter begins with a heading that serves as a scroll anchor:

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Chapter 1: The Beginning                                         │  ← id="chapter-{uuid}"
│   ─────────────────────────────────────────                        │  ← visual separator
│                                                                    │
│   First paragraph of chapter content...                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Heading structure:**

| Element           | Description                            | Styling                                  |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| Heading container | `<section>` with `id="chapter-{uuid}"` | `scroll-margin-top: 24px`                |
| Title             | `<h2>` with chapter title              | Lora 27px/600, Geist fallback            |
| Separator         | `<hr>` below title                     | `1px solid var(--color-border)`, 16px mb |
| Content           | Chapter body content (rendered HTML)   | Standard body typography                 |

**URL hash anchors:**

- Chapter sections have IDs: `chapter-{chapterId}`
- URL can deep-link: `/editor/{projectId}?view=book&mode=read#chapter-abc123`
- Hash navigation triggers smooth scroll to chapter

### 2.4 Chapter Spacing

| Spacing               | Value  | Notes                               |
| --------------------- | ------ | ----------------------------------- |
| Between chapters      | `64px` | Clear visual break, 2× body spacing |
| After chapter heading | `24px` | Before first paragraph              |
| Paragraph margin      | `1em`  | ~18px between paragraphs            |
| First chapter margin  | `0`    | No top margin on first chapter      |
| Last chapter margin   | `48px` | Bottom padding for scroll clearance |

---

## 3. Interactions

### 3.1 Tap-to-Edit (Paragraph Tooltip)

Tapping any paragraph in Read mode reveals an "Edit in Chapter View" tooltip that enables quick navigation to edit that specific location.

**Interaction flow:**

1. User taps a paragraph (not heading, not blockquote)
2. Tooltip appears anchored to the tapped paragraph
3. User taps "Edit in Chapter View" in tooltip
4. Workspace transitions to Chapter View with:
   - Selected chapter loaded in editor
   - Editor scrolled/focused to paragraph position

**Visual design:**

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   The morning sun cast long shadows across the valley              │
│   as Sarah opened her eyes. She had been dreaming again—           │
│                                                                    │
│       ┌─────────────────────────────┐                              │
│       │ ✏️  Edit in Chapter View     │ ← tooltip                   │
│       └─────────────────────────────┘                              │
│                                                                    │
│   those strange, vivid dreams that had haunted her since           │
│   childhood...                                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Tooltip styling:**

| Property      | Value                                                     | Notes                       |
| ------------- | --------------------------------------------------------- | --------------------------- |
| Width         | auto (content-sized)                                      | Fits text + icon            |
| Padding       | `8px 12px`                                                | Comfortable touch padding   |
| Background    | `#ffffff`                                                 | Clean white                 |
| Border        | `1px solid var(--color-border)`                           | Subtle definition           |
| Border radius | `8px`                                                     | Consistent with components  |
| Shadow        | `0 4px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)` | Floating appearance         |
| Text          | Geist Sans 14px/500                                       | Action text weight          |
| Icon          | `Pencil` (Lucide), 16px                                   | Edit affordance             |
| Color         | `#2563eb`                                                 | Interactive primary color   |
| Touch target  | 44px minimum height                                       | iPad accessibility          |
| Position      | Below paragraph, horizontally centered                    | Anchored to tapped content  |
| Z-index       | `30`                                                      | Above content, below panels |

**Tooltip behavior:**

| Behavior            | Description                                        |
| ------------------- | -------------------------------------------------- |
| Appear              | Fade in + scale from 0.95, 150ms ease-out          |
| Dismiss             | Tap outside tooltip, scroll, tap another paragraph |
| Dismiss animation   | Fade out + scale to 0.95, 100ms ease-in            |
| Multiple paragraphs | Only one tooltip visible at a time                 |
| Persist             | Stays visible until dismissed or action taken      |
| Pointer arrow       | 8px CSS triangle pointing toward paragraph         |

**Keyboard access:**

- Focus moves through paragraphs with Tab
- Enter/Space on focused paragraph shows tooltip
- Arrow keys move between paragraphs
- Escape dismisses tooltip

### 3.2 Edit Navigation

When user taps "Edit in Chapter View":

1. Store paragraph identifier (index within chapter or text fragment)
2. Update URL: `/editor/{projectId}?view=chapter&chapter={chapterId}&scrollTo={paragraphId}`
3. Trigger workspace view transition (300ms crossfade per #318)
4. Chapter View loads and scrolls to target paragraph
5. Optional: highlight target paragraph briefly (1.5s fade, like AI rewrite highlight)

**Paragraph identification:**

Since chapter content is HTML, paragraphs are identified by:

- DOM index within chapter: `p:nth-of-type(n)` equivalent
- Or text fragment hash: `#:~:text=first%20words%20of%20paragraph`

Recommend DOM index approach for reliability.

### 3.3 Scroll Behavior

**Smooth scrolling:**

| Trigger                 | Behavior                            |
| ----------------------- | ----------------------------------- |
| Hash navigation         | `scroll-behavior: smooth` to anchor |
| Mini-map click (if any) | Smooth scroll to chapter            |
| Sidebar chapter click   | Smooth scroll to chapter anchor     |
| Manual scroll           | Native momentum scrolling           |

**Scroll position restoration:**

- On revisit, restore last scroll position (session storage)
- After edit and return, scroll to last-edited chapter

**iPad Safari:**

- Uses `-webkit-overflow-scrolling: touch` for momentum
- Respects `safe-area-inset-bottom` for home indicator clearance

### 3.4 Read-Only Behavior

The manuscript content is **not editable** in Read mode:

| Interaction    | Behavior                                        |
| -------------- | ----------------------------------------------- |
| Text selection | Allowed (for copy)                              |
| Tap paragraph  | Shows edit tooltip (not inline editing)         |
| Double-tap     | Same as single tap (no word selection behavior) |
| Long-press     | Native context menu for copy (iOS Safari)       |
| Keyboard input | No effect (content not editable)                |

---

## 4. Accessibility

### 4.1 ARIA Roles

Per acceptance criteria, BookReadView uses `role="article"`:

```html
<article role="article" aria-label="Full manuscript" class="book-read-view">
  <section id="chapter-abc123" aria-labelledby="chapter-abc123-title">
    <h2 id="chapter-abc123-title">Chapter 1: The Beginning</h2>
    <div class="chapter-content">
      <p tabindex="0">First paragraph...</p>
      <p tabindex="-1">Second paragraph...</p>
    </div>
  </section>
  <!-- more chapters -->
</article>
```

**Attributes:**

| Element           | Attribute          | Value                                   |
| ----------------- | ------------------ | --------------------------------------- |
| Article container | `role`             | `"article"`                             |
| Article container | `aria-label`       | `"Full manuscript"`                     |
| Chapter section   | `aria-labelledby`  | `"{chapterId}-title"`                   |
| Chapter heading   | `id`               | `"{chapterId}-title"`                   |
| Paragraph         | `tabindex`         | `0` for first, `-1` for others (roving) |
| Edit tooltip      | `role`             | `"tooltip"`                             |
| Edit button       | `aria-describedby` | References parent paragraph             |

### 4.2 Keyboard Navigation

| Key           | Action                                      |
| ------------- | ------------------------------------------- |
| Tab           | Move focus to next chapter heading          |
| Shift + Tab   | Move focus to previous chapter heading      |
| Arrow Down    | Move focus to next paragraph (within focus) |
| Arrow Up      | Move focus to previous paragraph            |
| Enter / Space | Show edit tooltip on focused paragraph      |
| Escape        | Dismiss tooltip                             |
| Home          | Scroll to first chapter                     |
| End           | Scroll to last chapter                      |

### 4.3 Screen Reader Announcements

| Event                    | Announcement                               |
| ------------------------ | ------------------------------------------ |
| Enter Read mode          | "Reading full manuscript. {n} chapters."   |
| Focus chapter heading    | "{Chapter title}. Chapter {n} of {total}." |
| Focus paragraph          | Paragraph content (first 100 chars)        |
| Show edit tooltip        | "Edit in Chapter View button available."   |
| Navigate to Chapter View | "Loading {chapter title} in Chapter View." |

### 4.4 Focus Management

- First chapter heading receives focus when Read mode loads
- Focus trap: none (content is scrollable document)
- Tooltip: focus moves to tooltip button when shown
- After edit navigation: focus moves to editor at target position

---

## 5. Component Specification

### 5.1 BookReadView

**Props interface:**

```typescript
interface BookReadViewProps {
  /** List of chapters with content */
  chapters: ChapterReadData[];
  /** Callback when user wants to edit a paragraph */
  onEditRequest: (chapterId: string, paragraphIndex: number) => void;
  /** Currently highlighted chapter (from sidebar selection) */
  highlightChapterId?: string;
  /** Scroll to this chapter on mount */
  initialScrollToChapterId?: string;
}

interface ChapterReadData {
  id: string;
  title: string;
  /** HTML content of the chapter */
  content: string;
  /** Word count for optional display */
  wordCount: number;
  /** Sort order for rendering sequence */
  sortOrder: number;
}
```

**File location:** `web/src/components/book/book-read-view.tsx`

### 5.2 ParagraphWithTooltip

Internal component for interactive paragraphs:

**Props interface:**

```typescript
interface ParagraphWithTooltipProps {
  /** Paragraph HTML content */
  html: string;
  /** Paragraph index within chapter */
  index: number;
  /** Chapter ID for edit navigation */
  chapterId: string;
  /** Callback when edit is requested */
  onEditRequest: () => void;
  /** Whether tooltip is currently visible */
  isTooltipVisible: boolean;
  /** Toggle tooltip visibility */
  onTooltipToggle: () => void;
  /** Keyboard focus state */
  isFocused: boolean;
}
```

**File location:** `web/src/components/book/paragraph-with-tooltip.tsx`

### 5.3 EditTooltip

**Props interface:**

```typescript
interface EditTooltipProps {
  /** Callback when user clicks "Edit in Chapter View" */
  onEdit: () => void;
  /** Callback when tooltip should be dismissed */
  onDismiss: () => void;
  /** Position anchor element ref */
  anchorRef: RefObject<HTMLParagraphElement>;
  /** Visibility state */
  isVisible: boolean;
}
```

**File location:** `web/src/components/book/edit-tooltip.tsx`

### 5.4 CSS Additions

Add to `globals.css`:

```css
/* ------------------------------------------------------------------
 * Book View — Read Mode (#320)
 *
 * Full manuscript reading view with tap-to-edit interaction.
 * ------------------------------------------------------------------ */

.book-read-view {
  background: #ffffff;
  padding: 24px 32px;
  max-width: 680px;
  margin: 0 auto;
  min-height: 100%;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

/* Chapter section anchors */
.book-read-chapter {
  scroll-margin-top: 24px;
}

.book-read-chapter + .book-read-chapter {
  margin-top: 64px;
}

/* Chapter heading - Lora H2 */
.book-read-chapter-title {
  font-family: var(--font-serif);
  font-size: 27px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-foreground);
  margin: 0 0 16px 0;
}

.book-read-chapter-separator {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 0 0 24px 0;
}

/* Chapter content - matches chapter editor */
.book-read-chapter-content {
  font-size: 18px;
  line-height: 1.75;
  color: var(--color-foreground);
}

.book-read-chapter-content p {
  margin-bottom: 1em;
  cursor: pointer;
  transition: background-color 150ms ease-out;
  padding: 2px 4px;
  margin-left: -4px;
  margin-right: -4px;
  border-radius: 4px;
}

.book-read-chapter-content p:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.book-read-chapter-content p:focus {
  outline: none;
  background-color: rgba(37, 99, 235, 0.08);
}

.book-read-chapter-content p:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Preserve existing heading styles from chapter-editor-content */
.book-read-chapter-content h2 {
  font-size: 1.5em;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.book-read-chapter-content h3 {
  font-size: 1.25em;
  font-weight: 600;
  margin-top: 1.25em;
  margin-bottom: 0.5em;
}

.book-read-chapter-content ul,
.book-read-chapter-content ol {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

.book-read-chapter-content ul {
  list-style-type: disc;
}

.book-read-chapter-content ol {
  list-style-type: decimal;
}

.book-read-chapter-content li {
  margin-bottom: 0.25em;
}

.book-read-chapter-content blockquote {
  border-left: 3px solid var(--color-border);
  padding-left: 1em;
  margin-left: 0;
  margin-right: 0;
  font-style: italic;
  color: var(--color-muted-foreground);
}

/* Edit tooltip */
.book-read-edit-tooltip {
  position: absolute;
  z-index: 30;
  background: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  min-height: 44px;
  transition:
    transform 150ms ease-out,
    opacity 150ms ease-out;
}

.book-read-edit-tooltip:hover {
  background-color: #f9fafb;
}

.book-read-edit-tooltip-text {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: #2563eb;
  white-space: nowrap;
}

.book-read-edit-tooltip-icon {
  color: #2563eb;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Tooltip pointer arrow */
.book-read-edit-tooltip::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 8px 8px 8px;
  border-style: solid;
  border-color: transparent transparent var(--color-border) transparent;
}

.book-read-edit-tooltip::after {
  content: "";
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 7px 7px 7px;
  border-style: solid;
  border-color: transparent transparent #ffffff transparent;
}

/* Tooltip animations */
@keyframes tooltip-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes tooltip-exit {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

.book-read-edit-tooltip-enter {
  animation: tooltip-enter 150ms ease-out forwards;
}

.book-read-edit-tooltip-exit {
  animation: tooltip-exit 100ms ease-in forwards;
}

/* Container query for narrow center areas */
@container writing-area (max-width: 500px) {
  .book-read-view {
    padding: 16px;
  }

  .book-read-chapter-title {
    font-size: 24px;
  }

  .book-read-chapter + .book-read-chapter {
    margin-top: 48px;
  }
}

/* Scroll position flash — paragraph highlight after navigation */
.book-read-paragraph-highlight {
  animation: scroll-target-flash 1.5s ease-out;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .book-read-view {
    scroll-behavior: auto;
  }

  .book-read-chapter-content p {
    transition: none;
  }

  .book-read-edit-tooltip {
    transition: none;
  }

  .book-read-edit-tooltip-enter,
  .book-read-edit-tooltip-exit {
    animation: none;
  }

  .book-read-paragraph-highlight {
    animation: none;
  }
}
```

---

## 6. Responsive Behavior

### 6.1 Portrait (768-1023px)

- Full-width content within center area
- Sidebar collapsed to pill (per WorkspaceShell rules)
- Reduced padding (16px)
- Chapter spacing reduced to 48px

### 6.2 Landscape (1024-1279px)

- Content max-width 680px, centered
- Sidebar persistent/collapsible
- One panel can be persistent alongside read view
- Full padding (24px 32px)

### 6.3 Desktop (1280px+)

- Content max-width 680px, centered
- Sidebar always persistent
- Both panels can be persistent
- Full padding and spacing

### 6.4 Container Query

Container queries adapt to actual available width:

```css
@container writing-area (max-width: 500px) {
  .book-read-view {
    padding: 16px;
  }

  .book-read-chapter-title {
    font-size: 24px;
  }
}
```

---

## 7. Data Requirements

### 7.1 API Endpoint

Read mode requires chapter content that is already available:

**Required fields per chapter:**

| Field     | Type   | Source   | Notes                      |
| --------- | ------ | -------- | -------------------------- |
| id        | string | Existing | Chapter UUID               |
| title     | string | Existing | Chapter title              |
| content   | string | Existing | Full HTML content          |
| wordCount | number | Existing | For optional progress info |
| sortOrder | number | Existing | Rendering sequence         |

**Endpoint:** `GET /projects/{projectId}/chapters` (existing)

No schema changes required for Read mode.

### 7.2 Content Parsing

Chapter content is stored as HTML. For paragraph-level interactions:

1. Parse HTML content using DOMParser (client-side)
2. Extract `<p>` elements and assign indices
3. Wrap each paragraph in interactive container
4. Preserve other elements (headings, lists, blockquotes) as-is

**Non-interactive elements:**

- `<h2>`, `<h3>` - Section headings within chapter (not chapter title)
- `<ul>`, `<ol>` - Lists
- `<blockquote>` - Quotes
- `<hr>` - Dividers

These elements are rendered but do not trigger the edit tooltip.

---

## 8. State Management

### 8.1 Component State

| State            | Type                 | Default | Description                      |
| ---------------- | -------------------- | ------- | -------------------------------- |
| visibleTooltip   | `{chapterId, index}` | `null`  | Currently shown tooltip location |
| scrollPosition   | `number`             | `0`     | Current scroll position          |
| focusedParagraph | `{chapterId, index}` | `null`  | Keyboard focus location          |

### 8.2 URL State

Read mode URL pattern:

```
/editor/{projectId}?view=book&mode=read
/editor/{projectId}?view=book&mode=read#chapter-{chapterId}
```

### 8.3 Session Storage

Persist and restore:

- Last scroll position
- Last focused chapter

---

## 9. Acceptance Criteria Mapping

| Criterion                                                                       | Section    | Status    |
| ------------------------------------------------------------------------------- | ---------- | --------- |
| Full manuscript rendered chapter-by-chapter, read-only                          | §2, §3.4   | Specified |
| Same typography as chapter editor: 18px Geist Sans, line-height 1.75, max 680px | §2.2, §5.4 | Specified |
| Chapter headings as scroll anchors (Lora H2)                                    | §2.3       | Specified |
| Tap paragraph → tooltip "Edit in Chapter View" appears                          | §3.1       | Specified |
| Tapping tooltip → loads Chapter View at that paragraph position                 | §3.2       | Specified |
| Smooth scrolling between chapter sections                                       | §3.3       | Specified |
| ARIA: `role="article"` for BookReadView                                         | §4.1       | Specified |
| BookReadView component specification                                            | §5         | Specified |

---

## 10. Dependencies

| Issue | Title                                 | Relationship                        |
| ----- | ------------------------------------- | ----------------------------------- |
| #316  | WorkspaceShell CSS Grid layout system | BookReadView renders in center area |
| #318  | Chapter/Book view toggle control      | Toggle switches between views       |
| #319  | Book View — Outline mode              | Sibling view mode                   |

---

## 11. Animation Summary

| Animation               | Duration | Easing   | Reduced Motion |
| ----------------------- | -------- | -------- | -------------- |
| Tooltip enter           | 150ms    | ease-out | Instant        |
| Tooltip exit            | 100ms    | ease-in  | Instant        |
| Paragraph hover         | 150ms    | ease-out | Instant        |
| Scroll to anchor        | native   | smooth   | Auto           |
| Paragraph highlight     | 1500ms   | ease-out | None           |
| View transition (enter) | 300ms    | ease     | Instant        |

All respect `prefers-reduced-motion: reduce`.

---

## 12. Open Questions

1. **Mini-map navigation:** Should Read mode include a chapter mini-map for long manuscripts? Recommend: defer to future iteration; sidebar chapter list provides this function.

2. **Search integration:** Should Read mode support in-document search (Cmd+F)? Recommend: defer; native browser search works for now.

3. **Reading progress indicator:** Should there be a progress bar showing how far through the manuscript the user has read? Recommend: defer; focus on core interaction first.

4. **Paragraph granularity:** Should edit navigation target paragraph-level or sentence-level? Recommend: paragraph-level (DOM index based) for reliability.

---

## Revision History

| Date       | Author       | Changes               |
| ---------- | ------------ | --------------------- |
| 2026-02-24 | Design Agent | Initial specification |
