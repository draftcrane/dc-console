# WorkspaceToggle Component Design Specification

**Issue:** #318 - Design Chapter/Book view toggle control
**Author:** Design Agent
**Date:** 2026-02-24
**Status:** Design Specification

---

## 1. Overview

The WorkspaceToggle is a segmented control that enables users to switch between Chapter View and Book View. This component must be immediately discoverable and obvious to use. If users cannot find it, they will never use Book View.

### Design Principles

1. **Immediately obvious** — The toggle should be the visual anchor of the toolbar, clearly communicating "there are two ways to work here"
2. **Instant feedback** — State changes must feel responsive with visual confirmation
3. **Persistent context** — URL updates enable direct linking and browser back support
4. **Touch-first** — 44px minimum touch targets per Apple HIG

---

## 2. Component Specification

### 2.1 Component Name

```typescript
// File: web/src/components/workspace/workspace-toggle.tsx
export function WorkspaceToggle({
  activeView,
  onViewChange,
}: WorkspaceToggleProps) { ... }
```

### 2.2 Props Interface

```typescript
interface WorkspaceToggleProps {
  /** Current active view */
  activeView: "chapter" | "book";
  /** Callback when view changes */
  onViewChange: (view: "chapter" | "book") => void;
  /** Optional: disable interaction during transitions */
  disabled?: boolean;
}
```

### 2.3 State Management

The WorkspaceToggle is a controlled component. State is managed by the parent (likely `WorkspaceShell` or the editor page) and synchronized with the URL.

```typescript
// URL-based state synchronization
// Chapter View: /editor/[projectId]?view=chapter (or no param, default)
// Book View: /editor/[projectId]?view=book
```

---

## 3. Visual Design

### 3.1 Overall Dimensions

| Property      | Value                                    | Notes                        |
| ------------- | ---------------------------------------- | ---------------------------- |
| Total width   | Auto (content-driven)                    | ~160-180px depending on text |
| Total height  | 36px                                     | Fits within 48px toolbar     |
| Segment width | 78px each minimum                        | Equal width segments         |
| Border radius | 8px (outer), 6px (inner pill)            | Rounded corners per system   |
| Background    | `--dc-color-surface-secondary` (#F5F5F5) | Subtle container             |

### 3.2 Segment States

**Inactive Segment:**
| Property | Value |
|----------|-------|
| Background | Transparent |
| Text color | `--dc-color-text-secondary` (#6B7280) |
| Font weight | 500 (medium) |
| Font size | 14px |
| Cursor | pointer |

**Active Segment (Selected):**
| Property | Value |
|----------|-------|
| Background | `--dc-color-background` (#FFFFFF) |
| Text color | `--dc-color-text-primary` (#171717) |
| Font weight | 600 (semibold) |
| Font size | 14px |
| Box shadow | `0 1px 2px rgba(0,0,0,0.05)` |
| Border | 1px solid `--dc-color-border` (#E5E7EB) |

**Hover State (Inactive Only):**
| Property | Value |
|----------|-------|
| Text color | `--dc-color-text-primary` (#171717) |
| Background | `rgba(0,0,0,0.03)` |

**Focus State:**
| Property | Value |
|----------|-------|
| Outline | 2px solid `--dc-color-interactive` (#2563EB) |
| Outline offset | 2px |

### 3.3 Icon Design

Each segment includes a subtle icon before the label:

**Chapter Icon** (single page):

```svg
<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
  <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
  <path d="M5 5H11M5 7.5H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

**Book Icon** (stacked pages):

```svg
<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
  <rect x="2" y="3" width="9" height="11" rx="1" stroke="currentColor" stroke-width="1.5"/>
  <path d="M5 2V1.5C5 1.22386 5.22386 1 5.5 1H13.5C13.7761 1 14 1.22386 14 1.5V11.5C14 11.7761 13.7761 12 13.5 12H13"
        stroke="currentColor" stroke-width="1.5"/>
</svg>
```

### 3.4 Visual Mockup (ASCII)

```
┌──────────────────────────────────┐
│  ┌─────────────┬─────────────┐   │
│  │ ▢ Chapter   │ ≡≡ Book     │   │
│  └─────────────┴─────────────┘   │
└──────────────────────────────────┘
     Active (white)  Inactive (gray)
```

With active pill indicator:

```
┌──────────────────────────────────┐
│  ┌─────────────────────────────┐ │
│  │ ┌───────────┐               │ │
│  │ │▢ Chapter  │  ≡≡ Book     │ │
│  │ └───────────┘               │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
     Active pill    Inactive text
```

---

## 4. Toolbar Placement

### 4.1 Position Within Toolbar

The WorkspaceToggle is placed in the **left section** of the toolbar, immediately after the project switcher. This placement:

1. Creates a clear visual hierarchy: Project → View → Actions
2. Groups navigation controls on the left, actions on the right
3. Keeps the toggle visible even on narrower viewports

**Current Toolbar Layout:**

```
[Project Switcher ▼] | [Save] [Drive] [AI] [Research] | [Export] [Settings]
```

**Proposed Toolbar Layout:**

```
[Project ▼] [Chapter | Book] | [Save] [Drive] [AI] [Research] | [Export] [Settings]
```

### 4.2 Responsive Behavior

| Breakpoint              | Behavior                             |
| ----------------------- | ------------------------------------ |
| Desktop (1280px+)       | Full component with icons and labels |
| Landscape (1024-1279px) | Full component with icons and labels |
| Portrait (768-1023px)   | Icons only, labels hidden            |
| Below 768px             | Not supported (minimum viewport)     |

Portrait mode compact variant:

```
┌───────────────┐
│ ┌─────┬─────┐ │
│ │  ▢  │ ≡≡  │ │
│ └─────┴─────┘ │
└───────────────┘
   44px   44px
```

---

## 5. Touch Targets

### 5.1 Minimum Dimensions

Per Apple HIG and issue acceptance criteria:

| Property                 | Value               | Notes            |
| ------------------------ | ------------------- | ---------------- |
| Segment touch area       | 44px x 36px minimum | Each segment     |
| Total touch area         | 88px x 36px minimum | Entire component |
| Spacing between segments | 0px (continuous)    | No dead zone     |

### 5.2 Touch Feedback

On touch devices (`@media (pointer: coarse)`):

- Add `-webkit-tap-highlight-color: transparent`
- Use `:active` state for immediate feedback (100ms faster than `:hover`)
- Active state: subtle scale transform `transform: scale(0.98)`

---

## 6. Animation & Transitions

### 6.1 View Switch Animation

When toggling between Chapter and Book view:

| Element                | Animation             | Duration | Easing      |
| ---------------------- | --------------------- | -------- | ----------- |
| Active pill background | Slide to new position | 200ms    | ease-out    |
| Text color change      | Crossfade             | 150ms    | ease-out    |
| Center area content    | Crossfade             | 300ms    | ease-in-out |

**Important:** Only the center area content transitions. The sidebar and Library panel (if open) remain unchanged.

### 6.2 CSS Implementation

```css
/* Active indicator pill */
.workspace-toggle-pill {
  transition: transform 200ms ease-out;
}

/* Text color */
.workspace-toggle-segment {
  transition: color 150ms ease-out;
}

/* Center area crossfade */
.workspace-center-transition {
  animation: workspace-crossfade 300ms ease-in-out;
}

@keyframes workspace-crossfade {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .workspace-toggle-pill,
  .workspace-toggle-segment {
    transition: none;
  }

  .workspace-center-transition {
    animation: none;
  }
}
```

---

## 7. URL Integration

### 7.1 URL Structure

```
/editor/[projectId]                → Chapter View (default)
/editor/[projectId]?view=chapter   → Chapter View (explicit)
/editor/[projectId]?view=book      → Book View
```

### 7.2 Behavior Requirements

1. **Direct Linking:** Sharing `/editor/abc123?view=book` loads Book View directly
2. **Browser Back:** Pressing back after switching views returns to the previous view
3. **State Persistence:** URL is the source of truth; refreshing restores the view
4. **Default Handling:** No `?view` param defaults to Chapter View

### 7.3 Implementation Approach

Use `next/navigation` with shallow routing:

```typescript
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function useWorkspaceView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentView = (searchParams.get("view") === "book" ? "book" : "chapter") as
    | "chapter"
    | "book";

  const setView = (view: "chapter" | "book") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "chapter") {
      params.delete("view"); // Chapter is default, no param needed
    } else {
      params.set("view", view);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return { currentView, setView };
}
```

---

## 8. Accessibility (ARIA)

### 8.1 Semantic Structure

The toggle uses `role="radiogroup"` with `role="radio"` for each option:

```html
<div role="radiogroup" aria-label="Workspace view" class="workspace-toggle">
  <button
    role="radio"
    aria-checked="true"
    aria-label="Chapter view"
    class="workspace-toggle-segment active"
  >
    <svg>...</svg>
    <span>Chapter</span>
  </button>
  <button role="radio" aria-checked="false" aria-label="Book view" class="workspace-toggle-segment">
    <svg>...</svg>
    <span>Book</span>
  </button>
</div>
```

### 8.2 Keyboard Navigation

| Key              | Behavior                               |
| ---------------- | -------------------------------------- |
| Tab              | Focus enters/exits the radiogroup      |
| Arrow Left/Right | Move between options within radiogroup |
| Space/Enter      | Select focused option                  |

### 8.3 Screen Reader Announcements

When view changes:

```html
<div role="status" aria-live="polite" class="sr-only">Switched to Book view</div>
```

---

## 9. Context Preservation

### 9.1 What Stays the Same

When switching views:

- Sidebar state (collapsed/expanded)
- Sidebar content (chapter list)
- Library panel state (open/closed)
- Library panel tab (Sources/Ask/Clips)

### 9.2 What Changes

Only the **center area** and **Editor Panel** context change:

- Chapter View: Chapter editor with formatting toolbar
- Book View: Outline mode or Read mode (depending on #319, #320)

### 9.3 Implementation Note

The `WorkspaceShell` component (issue #316) manages which content renders in the center area based on `activeView`. The toggle only updates state; rendering logic lives in the shell.

---

## 10. Design Tokens

Add these tokens to `globals.css` for consistency:

```css
:root {
  /* Workspace toggle */
  --dc-toggle-height: 36px;
  --dc-toggle-segment-min-width: 78px;
  --dc-toggle-border-radius: 8px;
  --dc-toggle-inner-radius: 6px;

  /* Existing tokens used */
  --dc-color-surface-secondary: #f5f5f5;
  --dc-color-background: #ffffff;
  --dc-color-text-primary: #171717;
  --dc-color-text-secondary: #6b7280;
  --dc-color-border: #e5e7eb;
  --dc-color-interactive: #2563eb;
}
```

---

## 11. Component File Structure

```
web/src/
├── components/
│   └── workspace/
│       ├── workspace-toggle.tsx      # Component implementation
│       └── workspace-toggle.test.tsx # Unit tests
├── hooks/
│   └── use-workspace-view.ts         # URL state hook
└── app/
    └── (protected)/
        └── editor/
            └── [projectId]/
                └── page.tsx          # Integrate toggle here
```

---

## 12. Acceptance Criteria Checklist

Based on issue #318:

- [ ] Segmented control with two options: [Chapter] [Book]
- [ ] Active state: filled background (white pill with shadow)
- [ ] Inactive state: clearly differentiated (gray text, transparent background)
- [ ] Placed in toolbar (48px height) — Toggle height 36px within 48px toolbar
- [ ] Touch target minimum 44px per segment
- [ ] Transition animation: 300ms ease-in-out crossfade for center area
- [ ] URL updates on toggle (`?view=book`) for direct linking and browser back support
- [ ] Sidebar and Library panel preserved across switches
- [ ] Only center area and Editor panel context change
- [ ] ARIA: `role="radiogroup"` with `role="radio"` for each option
- [ ] WorkspaceToggle component specification — This document

---

## 13. Related Issues

| Issue | Title                                        | Relationship                |
| ----- | -------------------------------------------- | --------------------------- |
| #316  | Design WorkspaceShell CSS Grid layout system | Parent container for toggle |
| #317  | Design Editor Panel for Chapter mode         | Left panel in Chapter View  |
| #319  | Design Book View — Outline mode              | Center content in Book View |
| #320  | Design Book View — Read mode                 | Center content in Book View |

---

## 14. Open Questions

1. **Book View sub-modes:** Book View has Outline and Read modes (per #319, #320). Should there be a secondary toggle within Book View, or are these accessed differently?

2. **Animation timing:** The 300ms crossfade for center content may feel slow on fast interactions. Consider 200ms if testing shows sluggishness.

3. **Mobile portrait:** At 768px width, the toolbar is tight. Should the toggle collapse to icons-only, or should it be hidden in an overflow menu?

**Recommendation:** Icons-only at portrait breakpoint (768-1023px) as specified in Section 4.2.

---

## Appendix A: Full Component Implementation Skeleton

```tsx
"use client";

import { useCallback } from "react";

interface WorkspaceToggleProps {
  activeView: "chapter" | "book";
  onViewChange: (view: "chapter" | "book") => void;
  disabled?: boolean;
}

export function WorkspaceToggle({
  activeView,
  onViewChange,
  disabled = false,
}: WorkspaceToggleProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        onViewChange(activeView === "chapter" ? "book" : "chapter");
      }
    },
    [activeView, onViewChange, disabled],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Workspace view"
      className="flex items-center h-9 p-1 rounded-lg bg-gray-100"
      onKeyDown={handleKeyDown}
    >
      <button
        role="radio"
        aria-checked={activeView === "chapter"}
        aria-label="Chapter view"
        onClick={() => !disabled && onViewChange("chapter")}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 h-7 px-3 rounded-md text-sm font-medium
          transition-colors duration-150
          ${
            activeView === "chapter"
              ? "bg-white text-gray-900 shadow-sm border border-gray-200"
              : "text-gray-500 hover:text-gray-700"
          }
        `}
      >
        <ChapterIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Chapter</span>
      </button>
      <button
        role="radio"
        aria-checked={activeView === "book"}
        aria-label="Book view"
        onClick={() => !disabled && onViewChange("book")}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 h-7 px-3 rounded-md text-sm font-medium
          transition-colors duration-150
          ${
            activeView === "book"
              ? "bg-white text-gray-900 shadow-sm border border-gray-200"
              : "text-gray-500 hover:text-gray-700"
          }
        `}
      >
        <BookIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Book</span>
      </button>
    </div>
  );
}

function ChapterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5H11M5 7.5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="9" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 2V1.5C5 1.22386 5.22386 1 5.5 1H13.5C13.7761 1 14 1.22386 14 1.5V11.5C14 11.7761 13.7761 12 13.5 12H13"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
```

---

## Appendix B: Integration with EditorToolbar

The toggle should be added to `editor-toolbar.tsx` in the left section:

```tsx
// In EditorToolbar component
<div className="flex items-center gap-2 min-w-0">
  <ProjectSwitcher
    currentProject={...}
    projects={...}
  />

  <div className="w-px h-5 bg-border" aria-hidden="true" />

  {/* NEW: Workspace toggle */}
  <WorkspaceToggle
    activeView={activeView}
    onViewChange={onViewChange}
  />
</div>
```

This requires adding new props to `EditorToolbarProps`:

```typescript
interface EditorToolbarProps {
  // ... existing props

  // Workspace view (#318)
  activeView: "chapter" | "book";
  onViewChange: (view: "chapter" | "book") => void;
}
```
