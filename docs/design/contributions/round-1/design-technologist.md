# Design Technologist Contribution - Design Brief Round 1

**Author:** Design Technologist
**Date:** 2026-02-24
**Design Maturity:** Tokens defined
**Scope:** Help & Support System (Feedback/Issue Reporting, Onboarding Tooltips Redesign, Help Page)
**Target:** WCAG 2.1 AA, iPad Safari primary

---

## Component Inventory

### Existing Components (Audit)

| Name | Purpose | Status | ARIA Role/Pattern | Notes |
|------|---------|--------|-------------------|-------|
| `OnboardingTooltips` | First-time user tooltip tour (4 steps) | Exists (needs update) | `role="dialog"`, `aria-label`, `aria-live="polite"` | Functional but visually amateur; needs animation, pointer arrow, polish. Card styling is plain white box with minimal visual hierarchy. Step dots lack animation. No entrance/exit transitions. |
| `Toast` / `ToastProvider` | Toast notification system | Exists | `aria-live="polite"`, `role="status"` | Reuse for feedback submission confirmation. Already positioned at bottom center with `z-[9999]`. |
| `CrashRecoveryDialog` | Modal dialog pattern with backdrop | Exists | `role="dialog"`, `aria-modal="true"` | Reference pattern for modal overlay implementation. Uses `bg-black/50` backdrop, `rounded-xl shadow-2xl` card. |
| `AIRewriteSheet` | Bottom sheet pattern with focus trap | Exists | `role="dialog"`, `aria-modal="true"`, focus trap, Escape handler | Reference pattern for bottom sheet. Has drag handle, safe area padding, body scroll lock. |
| `SettingsMenu` | Dropdown menu with outside-click dismiss | Exists | `role="menu"`, `aria-expanded`, `aria-haspopup` | Pattern for adding "Help" menu item or "Report a problem" link to settings. |

### New Components Required

| Name | Purpose | Variants | Status | ARIA Role/Pattern |
|------|---------|----------|--------|-------------------|
| `FeedbackSheet` | Bottom sheet for bug reports and feature requests | -- | New | `role="dialog"`, `aria-modal="true"`, focus trap |
| `FeedbackTypeSelector` | Toggle between "Report a problem" and "Suggest an improvement" | -- | New | `role="radiogroup"` with `role="radio"` options |
| `FeedbackForm` | Form fields: description textarea, optional screenshot, category | -- | New | Native `<form>` with `aria-describedby` for field hints |
| `FeedbackSuccessState` | Confirmation state shown after successful submission | -- | New | `role="status"`, `aria-live="polite"` |
| `HelpPage` | `/help` page with FAQ sections and support links | -- | New | `role="main"`, landmark regions |
| `AccordionGroup` | Collapsible FAQ container managing exclusive-open behavior | -- | New | Managed collection, no specific role (delegates to items) |
| `AccordionItem` | Single collapsible FAQ section with header and content | -- | New | `<button>` with `aria-expanded`, `aria-controls`; content region with `role="region"`, `aria-labelledby` |
| `OnboardingTooltipCard` | Redesigned tooltip card with pointer arrow and entrance animation | -- | New | `role="dialog"`, `aria-label`, `aria-live="polite"` |
| `OnboardingBackdrop` | Semi-transparent backdrop with spotlight cutout for target region | -- | New | `aria-hidden="true"` (decorative) |
| `OnboardingStepDots` | Animated step indicator dots | -- | New | `aria-hidden="true"` (decorative; step count announced via dialog label) |
| `ContextCollector` | Headless utility component that gathers browser/app context for feedback | -- | New | No DOM output (headless hook) |

### New Component Props Interfaces

```typescript
// FeedbackSheet - Bottom sheet for feedback submission
interface FeedbackSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Close the sheet */
  onClose: () => void;
  /** Pre-selected feedback type (from deep link or context menu) */
  defaultType?: "bug" | "suggestion";
  /** Current project context for auto-attachment */
  projectId?: string;
  /** Current chapter context for auto-attachment */
  chapterId?: string;
}

// FeedbackTypeSelector - Bug report vs feature request toggle
interface FeedbackTypeSelectorProps {
  /** Currently selected type */
  value: "bug" | "suggestion";
  /** Called when type changes */
  onChange: (type: "bug" | "suggestion") => void;
}

// FeedbackForm - The form fields within the sheet
interface FeedbackFormProps {
  /** Feedback type determines which fields are shown */
  type: "bug" | "suggestion";
  /** Called on successful submission */
  onSubmit: (data: FeedbackFormData) => Promise<void>;
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Submission error message */
  errorMessage: string | null;
}

interface FeedbackFormData {
  type: "bug" | "suggestion";
  description: string;
  /** Auto-collected context (not user-editable) */
  context: FeedbackContext;
}

// FeedbackSuccessState - Post-submission confirmation
interface FeedbackSuccessStateProps {
  /** Close the sheet after viewing confirmation */
  onClose: () => void;
  /** Feedback type for contextual messaging */
  type: "bug" | "suggestion";
}

// HelpPage - No props (route-level page component)
// Renders at /help

// AccordionGroup - Manages exclusive open state
interface AccordionGroupProps {
  /** Accordion items */
  children: React.ReactNode;
  /** Allow multiple sections open simultaneously */
  allowMultiple?: boolean;
  /** Default open section key */
  defaultOpenKey?: string;
}

// AccordionItem - Single collapsible section
interface AccordionItemProps {
  /** Unique key for this section */
  itemKey: string;
  /** Section heading text */
  title: string;
  /** Collapsible content */
  children: React.ReactNode;
}

// OnboardingTooltipCard - Redesigned tooltip
interface OnboardingTooltipCardProps {
  /** Step text */
  text: string;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether this is the last step */
  isLastStep: boolean;
  /** Pointer arrow direction relative to the card */
  arrowDirection: "top" | "bottom" | "left" | "right";
  /** Called when Next/Done is tapped */
  onNext: () => void;
  /** Called when Skip is tapped */
  onSkip: () => void;
}

// OnboardingBackdrop - Spotlight backdrop
interface OnboardingBackdropProps {
  /** Target region to spotlight (leave unobscured) */
  spotlightRect: { top: number; left: number; width: number; height: number } | null;
  /** Called when backdrop area outside spotlight is tapped */
  onTapOutside: () => void;
}

// ContextCollector - Headless context gathering
interface FeedbackContext {
  /** User agent string */
  userAgent: string;
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Current route path */
  currentRoute: string;
  /** Active project ID if in editor */
  projectId: string | null;
  /** Active chapter ID if in editor */
  chapterId: string | null;
  /** Whether Google Drive is connected */
  driveConnected: boolean;
  /** App version (from build metadata) */
  appVersion: string;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Whether virtual keyboard is likely active */
  keyboardActive: boolean;
  /** Recent console errors (last 5, captured by global error handler) */
  recentErrors: Array<{
    message: string;
    timestamp: string;
    source?: string;
  }>;
  /** Timestamp of feedback submission */
  submittedAt: string;
}
```

### Components Needing Updates

| Component | Update Required |
|-----------|----------------|
| `OnboardingTooltips` | Full visual redesign. Replace plain card with `OnboardingTooltipCard`. Add entrance/exit animations. Add pointer arrows. Add spotlight backdrop via `OnboardingBackdrop`. Expose `resetOnboarding()` function for "Replay tour" trigger from Help page. Extract `ONBOARDING_KEY` constant to shared location. |
| `SettingsMenu` | Add "Help & Support" menu item linking to `/help` page. Position before Sign Out, after separator. |
| `Toast` / `ToastProvider` | No code changes needed. Reuse for feedback submission confirmation: "Thanks for your feedback" / "Report submitted". |

---

## Design Token Additions

The existing token architecture (defined in the design charter) uses the `--dc-{category}-{property}-{variant}` pattern. The Help & Support system does not require new token categories. It extends existing categories with values specific to these components.

### New Token Definitions

```css
:root {
  /* ----------------------------------------------------------------
   * Help & Support Tokens
   *
   * Extend the existing dc- token set for help/support components.
   * These tokens reference existing palette values where possible.
   * ---------------------------------------------------------------- */

  /* === Colors: Feedback Sheet === */
  --dc-color-feedback-surface: var(--dc-color-surface-primary);
  --dc-color-feedback-border: var(--dc-color-border-default);

  /* Type selector: active/inactive states */
  --dc-color-feedback-type-active-bg: var(--dc-color-interactive-primary);
  --dc-color-feedback-type-active-text: #ffffff;
  --dc-color-feedback-type-inactive-bg: var(--dc-color-surface-secondary);
  --dc-color-feedback-type-inactive-text: var(--dc-color-text-secondary);

  /* Success state */
  --dc-color-feedback-success-bg: var(--dc-color-status-success-subtle);
  --dc-color-feedback-success-icon: var(--dc-color-status-success);
  --dc-color-feedback-success-text: var(--dc-color-text-primary);

  /* === Colors: Onboarding Tooltips === */
  --dc-color-onboarding-card-bg: var(--dc-color-surface-primary);
  --dc-color-onboarding-card-border: var(--dc-color-border-default);
  --dc-color-onboarding-backdrop: rgba(0, 0, 0, 0.4);
  --dc-color-onboarding-dot-active: var(--dc-color-interactive-primary);
  --dc-color-onboarding-dot-inactive: #d1d5db;
  --dc-color-onboarding-arrow: var(--dc-color-surface-primary);

  /* === Colors: Help Page === */
  --dc-color-help-accordion-bg: var(--dc-color-surface-primary);
  --dc-color-help-accordion-hover: var(--dc-color-surface-secondary);
  --dc-color-help-accordion-border: var(--dc-color-border-default);
  --dc-color-help-section-heading: var(--dc-color-text-primary);

  /* === Shadows: Onboarding === */
  --dc-shadow-onboarding-card: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);

  /* === Layout: Feedback Sheet === */
  --dc-feedback-sheet-max-height: 85vh;
  --dc-feedback-textarea-min-height: 120px;

  /* === Layout: Onboarding === */
  --dc-onboarding-card-width: 300px;
  --dc-onboarding-card-max-width: calc(100vw - 32px);
  --dc-onboarding-arrow-size: 8px;

  /* === Layout: Help Page === */
  --dc-help-content-max-width: 640px;
}
```

### Tailwind Config Mapping

These tokens integrate with the existing `@theme inline` block in `globals.css`. Add the following aliases:

```css
@theme inline {
  /* Extend existing Tailwind theme aliases for help/support */
  --color-dc-feedback-active: var(--dc-color-feedback-type-active-bg);
  --color-dc-success-subtle: var(--dc-color-status-success-subtle);
  --color-dc-success: var(--dc-color-status-success);
  --color-dc-onboarding-backdrop: var(--dc-color-onboarding-backdrop);
}
```

Usage in Tailwind classes: `bg-dc-feedback-active`, `bg-dc-success-subtle`, `text-dc-success`.

---

## D1 Schema

### Proposed `feedback` Table

The schema follows existing DraftCrane D1 patterns:
- ULID primary keys (via `ulidx` library, consistent with all other tables)
- TEXT dates in ISO 8601 format with SQLite `strftime`
- `user_id` foreign key referencing `users(id)`
- Appropriate indexes on foreign keys and query columns

```sql
-- Feedback: stores user bug reports and feature suggestions
-- Migration: 0025_create_feedback.sql
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('bug', 'suggestion')),
  description TEXT NOT NULL,
  -- Auto-collected context (JSON blob)
  context_json TEXT NOT NULL DEFAULT '{}',
  -- Processing state
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'github_issue_created', 'resolved', 'closed')),
  -- Optional GitHub issue number (created via API, not automatic)
  github_issue_number INTEGER,
  -- Admin notes (for internal triage)
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_feedback_created_at ON feedback(created_at);
```

### Schema Design Decisions

1. **Single table for bugs and suggestions.** The `type` column discriminates between them. Both share the same structure (description + context). Separate tables would add complexity without benefit at this scale.

2. **`context_json` as TEXT, not individual columns.** The auto-collected context (user agent, viewport, errors, route, etc.) is write-once diagnostic data. It is never queried by individual fields in D1. Storing as a JSON blob keeps the schema stable as context fields evolve. The API serializes the `FeedbackContext` interface to JSON before insertion.

3. **`status` column for lifecycle tracking.** Starts at `new`. Transitions: `new` -> `triaged` -> `github_issue_created` or `resolved` or `closed`. This supports a future admin dashboard without requiring schema changes.

4. **`github_issue_number` is optional.** Not all feedback items warrant a GitHub issue. When the team decides to escalate, an admin action (future) creates the issue and stores the number. This is deliberately NOT automatic on submission -- most feedback is noise and auto-creating issues would pollute the backlog.

5. **No attachment/screenshot column.** Screenshots add significant complexity (R2 storage, upload UI, presigned URLs) for marginal value in an iPad-first text editor. The auto-collected context (viewport, route, errors, project state) provides more actionable diagnostic data than a screenshot in most cases. If screenshots become necessary later, add an `attachment_r2_key TEXT` column.

---

## API Routes

### Route Definitions

All routes mount under the `/feedback` path prefix on the existing Hono app. They require authentication (mounted after the global `requireAuth` barrier).

```typescript
// workers/dc-api/src/routes/feedback.ts

import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { validationError } from "../middleware/error-handler.js";
import { ulid } from "ulidx";

const feedback = new Hono<{ Bindings: Env }>();

/**
 * POST /feedback
 *
 * Submit a new feedback item (bug report or feature suggestion).
 *
 * Request body:
 * - type: "bug" | "suggestion" (required)
 * - description: string (required, 10-2000 chars)
 * - context: FeedbackContext object (required, auto-collected by client)
 *
 * Response: 201 Created
 * - { id: string, type: string, status: "new", createdAt: string }
 *
 * Rate limit: 5 req/min (prevent spam without frustrating legitimate reports)
 */
feedback.post("/", feedbackRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));

  // Validation
  if (!body.type || !["bug", "suggestion"].includes(body.type)) {
    validationError("type must be 'bug' or 'suggestion'");
  }
  if (!body.description || typeof body.description !== "string") {
    validationError("description is required");
  }
  if (body.description.trim().length < 10) {
    validationError("description must be at least 10 characters");
  }
  if (body.description.length > 2000) {
    validationError("description must be 2000 characters or fewer");
  }

  const id = ulid();
  const contextJson = JSON.stringify(body.context || {});

  await c.env.DB.prepare(
    `INSERT INTO feedback (id, user_id, type, description, context_json)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, userId, body.type, body.description.trim(), contextJson)
    .run();

  return c.json(
    {
      id,
      type: body.type,
      status: "new",
      createdAt: new Date().toISOString(),
    },
    201
  );
});

/**
 * GET /feedback
 *
 * List feedback items for the authenticated user.
 * Users can see their own submissions. Admin access (future) can see all.
 *
 * Query params:
 * - limit: number (default 20, max 50)
 * - cursor: string (ULID for cursor-based pagination)
 *
 * Response: { data: Feedback[], cursor: string | null, hasMore: boolean }
 */
feedback.get("/", async (c) => {
  const { userId } = c.get("auth");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const cursor = c.req.query("cursor");

  let query = `SELECT id, type, description, status, created_at, updated_at
               FROM feedback WHERE user_id = ?`;
  const params: string[] = [userId];

  if (cursor) {
    query += ` AND id < ?`;
    params.push(cursor);
  }

  query += ` ORDER BY id DESC LIMIT ?`;
  params.push(String(limit + 1));

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  const data = rows.results.slice(0, limit);
  const hasMore = rows.results.length > limit;

  return c.json({
    data,
    cursor: hasMore ? data[data.length - 1].id : null,
    hasMore,
  });
});

export { feedback };
```

### Rate Limiting

```typescript
// Add to workers/dc-api/src/middleware/rate-limit.ts

/** Feedback rate limit: 5 req/min */
export const feedbackRateLimit = rateLimit({
  prefix: "feedback",
  maxRequests: 5,
  windowSeconds: 60,
});
```

### Route Registration

```typescript
// Add to workers/dc-api/src/index.ts (after auth barrier, with other routes)
import { feedback } from "./routes/feedback.js";

app.route("/feedback", feedback);
```

### Error Code Addition

```typescript
// Add to workers/dc-api/src/types/api.ts ErrorCode union
| "FEEDBACK_ERROR"
```

---

## Accessibility

### Focus Management for Feedback Sheet

The feedback sheet is a modal bottom sheet (same pattern as `AIRewriteSheet`). Focus management requirements:

1. **Focus trap.** When the sheet opens, focus is trapped within the sheet. Tab/Shift+Tab cycles through: type selector radio buttons, description textarea, submit button, close button.

2. **Initial focus.** On open, focus moves to the description textarea (the primary action). This follows the WAI-ARIA dialog pattern where initial focus goes to the first interactive element the user needs.

3. **Focus restoration.** When the sheet closes (submit, dismiss, or Escape), focus returns to the element that triggered it (the "Report a problem" button or menu item). Store the `document.activeElement` reference before opening.

4. **Escape to close.** Pressing Escape closes the sheet without submitting. This mirrors the existing `AIRewriteSheet` pattern.

5. **Body scroll lock.** When the sheet is open, `document.body.style.overflow = "hidden"` prevents background scroll. Restore on close.

```typescript
// Reuse the focus trap pattern from AIRewriteSheet:
// 1. Query focusable elements within sheetRef
// 2. On Tab at last element, wrap to first
// 3. On Shift+Tab at first element, wrap to last
// 4. On Escape, call onClose
// Consider extracting into useFocusTrap(ref, isActive) hook
```

### Keyboard Navigation for Help Page Accordions

The accordion follows the WAI-ARIA Accordion Pattern:

| Key | Action |
|-----|--------|
| Enter or Space | Toggle the focused accordion section |
| Tab | Move focus to next focusable element (accordion header or other) |
| Shift+Tab | Move focus to previous focusable element |
| Arrow Down | Move focus to next accordion header (when focus is on a header) |
| Arrow Up | Move focus to previous accordion header (when focus is on a header) |
| Home | Move focus to first accordion header |
| End | Move focus to last accordion header |

Implementation:

```typescript
// AccordionItem header button
<h3>
  <button
    id={`accordion-header-${itemKey}`}
    aria-expanded={isOpen}
    aria-controls={`accordion-panel-${itemKey}`}
    onClick={() => toggle(itemKey)}
    onKeyDown={handleAccordionKeyDown}
    className="w-full text-left flex items-center justify-between
               min-h-[var(--dc-touch-target-min)] px-4 py-3
               text-sm font-medium text-[var(--dc-color-text-primary)]
               hover:bg-[var(--dc-color-help-accordion-hover)]
               transition-colors focus:outline-none
               focus-visible:ring-2 focus-visible:ring-[var(--dc-color-border-focus)]"
  >
    {title}
    <ChevronIcon aria-hidden="true" rotated={isOpen} />
  </button>
</h3>

// AccordionItem content panel
<div
  id={`accordion-panel-${itemKey}`}
  role="region"
  aria-labelledby={`accordion-header-${itemKey}`}
  hidden={!isOpen}
>
  {children}
</div>
```

### ARIA Patterns for Onboarding Tooltips (Tour Pattern)

The onboarding tour is a sequenced dialog pattern. Each step is an independent dialog with a live region for step announcements.

```html
<!-- Backdrop (decorative) -->
<div aria-hidden="true" class="onboarding-backdrop">
  <!-- SVG mask with spotlight cutout -->
</div>

<!-- Tooltip card (the dialog) -->
<div
  role="dialog"
  aria-label="Getting started, step 2 of 4"
  aria-describedby="onboarding-step-text"
  aria-live="polite"
>
  <!-- Step dots (decorative, step count is in aria-label) -->
  <div aria-hidden="true">
    <!-- dots -->
  </div>

  <!-- Step text -->
  <p id="onboarding-step-text">
    Use the sidebar to switch between chapters or add new ones.
  </p>

  <!-- Actions -->
  <div role="toolbar" aria-label="Tour navigation">
    <button aria-label="Skip tour">Skip</button>
    <button aria-label="Go to step 3 of 4">Next</button>
    <!-- or on last step: -->
    <button aria-label="Finish tour">Done</button>
  </div>
</div>
```

Key ARIA decisions:
- **`role="dialog"`** (not `alertdialog`) because this is informational, not urgent.
- **`aria-label` includes step position** ("step 2 of 4") so screen reader users know their progress without seeing the visual dots.
- **`aria-live="polite"`** on the dialog so step transitions are announced.
- **Step dots are `aria-hidden`** because the step count is conveyed via `aria-label`.
- **Backdrop is `aria-hidden`** because it is purely decorative.

### Screen Reader Announcements for Feedback Submission

| Event | Announcement | Implementation |
|-------|-------------|----------------|
| Feedback sheet opens | "Report a problem. Describe what happened." or "Suggest an improvement. Tell us your idea." | `aria-label` on dialog, initial focus on textarea with `aria-describedby` hint |
| Type selector changes | "Bug report selected" or "Suggestion selected" | `aria-live="polite"` region near the selector |
| Validation error | "Description must be at least 10 characters" | `aria-invalid="true"` on textarea, `aria-describedby` pointing to error message element |
| Submission in progress | "Submitting your feedback..." | `aria-busy="true"` on the form, submit button text changes to "Submitting..." |
| Submission success | "Thanks for your feedback. We'll review it shortly." | Success state component with `role="status"`, `aria-live="polite"` |
| Submission error | "Something went wrong. Please try again." | Error message with `role="alert"` (assertive) |
| Sheet closes | (silent - focus restoration handles context) | Focus returns to triggering element |

### Reduced Motion: What Animations to Replace

| Animation | Normal Behavior | Reduced Motion Behavior |
|-----------|----------------|------------------------|
| Feedback sheet slide-up | `translateY(100%)` to `translateY(0)`, 300ms | Instant appearance (no animation) |
| Feedback sheet backdrop fade | Opacity 0 to 1, 200ms | Instant appearance |
| Feedback success checkmark | Scale + opacity entrance, 200ms | Instant appearance at final state |
| Onboarding tooltip entrance | Scale from 0.95 + opacity, 200ms | Instant appearance at final state |
| Onboarding tooltip exit | Scale to 0.95 + opacity out, 150ms | Instant disappearance |
| Onboarding backdrop transition | Opacity crossfade between spotlight positions, 200ms | Instant transition |
| Onboarding step dot animation | Width transition on active dot, 200ms | Instant width change |
| Accordion expand | Max-height transition, 200ms | Instant expand (no transition) |
| Accordion collapse | Max-height transition, 150ms | Instant collapse |
| Accordion chevron rotation | Transform rotate, 200ms | Instant rotation |

---

## Performance Budget

### Bundle Size Impact

| Component | Estimated Size (gzipped) | Loading Strategy |
|-----------|-------------------------|------------------|
| `FeedbackSheet` + `FeedbackForm` + `FeedbackTypeSelector` + `FeedbackSuccessState` | ~4-5 KB | Lazy (`React.lazy`) |
| `HelpPage` + `AccordionGroup` + `AccordionItem` | ~3-4 KB | Route-level split (Next.js automatic) |
| `OnboardingTooltips` (redesigned) | ~3-4 KB | Already in editor bundle; no change to loading |
| `useFeedbackContext` hook (context collector) | ~1 KB | Bundled with FeedbackSheet chunk |
| **Total new JS** | **~11-14 KB** | -- |

These components are well within the 300 KB initial bundle constraint because none of them are in the critical path.

### Lazy Loading Strategy

1. **FeedbackSheet:** Lazy-loaded on first trigger (tap "Report a problem"). Use `React.lazy` with a `Suspense` fallback that shows the backdrop immediately and a loading spinner in the sheet area. Pre-load the chunk on hover/focus of the trigger button (`<link rel="modulepreload">` or dynamic `import()` on `pointerenter`).

2. **HelpPage:** Route-level split by Next.js automatically (`/help` is a separate page route). No additional lazy loading needed. The page contains only static FAQ content and two interactive elements (accordion and "Replay tour" button).

3. **OnboardingTooltips:** Loaded with the editor page bundle (already in the editor route chunk). The 800ms delay before showing the first step provides natural time for any async operations. No separate lazy loading.

4. **ContextCollector hook:** Bundled with the FeedbackSheet chunk. The context collection itself is synchronous (reads from `navigator`, `window`, `location`, and the app's error store) and adds negligible runtime cost.

### Font Loading

No new fonts required. All components use the existing font stack:
- Geist Sans (UI text, form labels, FAQ content)
- Geist Mono (not used in help/support components)
- Lora (help page heading only, already loaded)

### No New Dependencies

The help/support system requires no new npm dependencies. It uses:
- React (existing)
- `ulidx` (existing, for ID generation in the API)
- Hono (existing, for route definition)
- Tailwind CSS (existing, for styling)

---

## Animation & Motion

All animations use the existing dc-motion token system. Durations follow the charter: 100-150ms for micro-interactions, 200-300ms for transitions. Nothing exceeds 300ms.

### New Keyframe Definitions

Add to `globals.css`:

```css
/* ----------------------------------------------------------------
 * Feedback Sheet Animations
 * ---------------------------------------------------------------- */

@keyframes feedback-sheet-slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes feedback-sheet-slide-down {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}

.feedback-sheet-slide-up {
  animation: feedback-sheet-slide-up var(--dc-motion-slower) var(--dc-motion-ease-out);
}

.feedback-sheet-slide-down {
  animation: feedback-sheet-slide-down var(--dc-motion-slow) var(--dc-motion-ease-in);
  animation-fill-mode: forwards;
}

/* ----------------------------------------------------------------
 * Feedback Success Checkmark
 * ---------------------------------------------------------------- */

@keyframes feedback-success-enter {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.feedback-success-enter {
  animation: feedback-success-enter var(--dc-motion-slow) var(--dc-motion-ease-out);
}

/* ----------------------------------------------------------------
 * Onboarding Tooltip Animations
 * ---------------------------------------------------------------- */

@keyframes onboarding-tooltip-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes onboarding-tooltip-exit {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }
}

@keyframes onboarding-backdrop-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.onboarding-tooltip-enter {
  animation: onboarding-tooltip-enter var(--dc-motion-slow) var(--dc-motion-ease-out);
}

.onboarding-tooltip-exit {
  animation: onboarding-tooltip-exit var(--dc-motion-normal) var(--dc-motion-ease-in);
  animation-fill-mode: forwards;
}

.onboarding-backdrop-enter {
  animation: onboarding-backdrop-enter var(--dc-motion-slow) var(--dc-motion-ease-out);
}

/* ----------------------------------------------------------------
 * Accordion Expand/Collapse
 *
 * Uses CSS grid row transition technique for smooth height animation
 * without measuring content height. The content wrapper uses
 * grid-template-rows: 0fr (collapsed) to 1fr (expanded).
 * ---------------------------------------------------------------- */

.accordion-content-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--dc-motion-slow) var(--dc-motion-ease-out);
}

.accordion-content-wrapper[data-state="open"] {
  grid-template-rows: 1fr;
}

.accordion-content-inner {
  overflow: hidden;
}

/* Chevron rotation */
.accordion-chevron {
  transition: transform var(--dc-motion-slow) var(--dc-motion-ease-out);
}

.accordion-chevron[data-state="open"] {
  transform: rotate(180deg);
}

/* ----------------------------------------------------------------
 * Onboarding Step Dot Transition
 * ---------------------------------------------------------------- */

.onboarding-dot {
  transition: width var(--dc-motion-slow) var(--dc-motion-ease-out),
              background-color var(--dc-motion-slow) var(--dc-motion-ease-out);
}

/* ----------------------------------------------------------------
 * Reduced Motion Overrides (extend existing block)
 * ---------------------------------------------------------------- */

@media (prefers-reduced-motion: reduce) {
  .feedback-sheet-slide-up,
  .feedback-sheet-slide-down,
  .feedback-success-enter,
  .onboarding-tooltip-enter,
  .onboarding-tooltip-exit,
  .onboarding-backdrop-enter {
    animation: none;
  }

  .accordion-content-wrapper {
    transition: none;
  }

  .accordion-chevron {
    transition: none;
  }

  .onboarding-dot {
    transition: none;
  }
}
```

### Animation Timing Summary

| Animation | Duration Token | Easing Token | Direction |
|-----------|---------------|-------------|-----------|
| Feedback sheet entrance | `--dc-motion-slower` (300ms) | `--dc-motion-ease-out` | Entrance (decelerate) |
| Feedback sheet exit | `--dc-motion-slow` (200ms) | `--dc-motion-ease-in` | Exit (accelerate) |
| Feedback backdrop fade | `--dc-motion-slow` (200ms) | `--dc-motion-ease-out` | Entrance |
| Feedback success checkmark | `--dc-motion-slow` (200ms) | `--dc-motion-ease-out` | Entrance |
| Onboarding tooltip entrance | `--dc-motion-slow` (200ms) | `--dc-motion-ease-out` | Entrance |
| Onboarding tooltip exit | `--dc-motion-normal` (150ms) | `--dc-motion-ease-in` | Exit |
| Onboarding backdrop | `--dc-motion-slow` (200ms) | `--dc-motion-ease-out` | Entrance |
| Accordion expand/collapse | `--dc-motion-slow` (200ms) | `--dc-motion-ease-out` | State change |
| Accordion chevron | `--dc-motion-slow` (200ms) | `--dc-motion-ease-out` | State change |
| Onboarding step dots | `--dc-motion-slow` (200ms) | `--dc-motion-ease-out` | State change |

---

## Auto-Context Collection

### What to Collect

The `useFeedbackContext` hook gathers diagnostic context automatically when the feedback sheet opens. The user never sees or edits this data -- it is attached silently to the feedback submission.

```typescript
// web/src/hooks/use-feedback-context.ts

interface FeedbackContext {
  // Browser environment
  userAgent: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  keyboardActive: boolean;
  touchSupported: boolean;
  onlineStatus: boolean;

  // App state
  currentRoute: string;
  projectId: string | null;
  chapterId: string | null;
  driveConnected: boolean;
  appVersion: string;

  // Diagnostic
  recentErrors: Array<{
    message: string;
    timestamp: string;
    source?: string;
  }>;

  // Submission metadata
  submittedAt: string;
}
```

### Collection Sources

| Field | Source | Implementation |
|-------|--------|----------------|
| `userAgent` | `navigator.userAgent` | Read on sheet open |
| `viewport` | `{ width: window.innerWidth, height: window.innerHeight }` | Read on sheet open |
| `devicePixelRatio` | `window.devicePixelRatio` | Read on sheet open |
| `keyboardActive` | Compare `window.visualViewport.height` to `window.innerHeight`. If viewport height is significantly smaller (>100px difference), keyboard is likely active. | Read on sheet open |
| `touchSupported` | `'ontouchstart' in window` | Read on sheet open |
| `onlineStatus` | `navigator.onLine` | Read on submit |
| `currentRoute` | `window.location.pathname` | Read on sheet open |
| `projectId` | From `FeedbackSheet` props (passed from editor context) | Prop passthrough |
| `chapterId` | From `FeedbackSheet` props (passed from editor context) | Prop passthrough |
| `driveConnected` | From app state (check if any drive connection exists for user) | Read from existing user data |
| `appVersion` | `process.env.NEXT_PUBLIC_APP_VERSION` or build-time git hash | Read from env |
| `recentErrors` | From a global error store (see below) | Read on sheet open |
| `submittedAt` | `new Date().toISOString()` | Set on submit |

### Global Error Store

To capture recent client-side errors for feedback reports, implement a lightweight error buffer:

```typescript
// web/src/lib/error-store.ts

interface CapturedError {
  message: string;
  timestamp: string;
  source?: string;
}

const MAX_ERRORS = 5;
const errorBuffer: CapturedError[] = [];

/**
 * Call this from the app's global error boundary or window.onerror handler.
 * Stores the last 5 errors in memory (not persisted) for feedback context.
 */
export function captureError(error: Error | string, source?: string): void {
  const entry: CapturedError = {
    message: typeof error === "string" ? error : error.message,
    timestamp: new Date().toISOString(),
    source,
  };

  errorBuffer.push(entry);
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.shift();
  }
}

/**
 * Get recent errors for feedback context. Returns a copy.
 */
export function getRecentErrors(): CapturedError[] {
  return [...errorBuffer];
}
```

Integration points:
- Call `captureError` from the existing `error.tsx` error boundary (`useEffect` that currently only logs to console).
- Add a `window.addEventListener("unhandledrejection", ...)` handler in the app root.
- Add a `window.addEventListener("error", ...)` handler in the app root.

### Privacy Considerations

1. **No PII in context.** The context does not include user email, name, or auth tokens. The `user_id` foreign key in the database links the feedback to the user for follow-up, but the context blob itself contains only technical data.

2. **No editor content.** The context does not include what the user is writing. It includes the project ID and chapter ID for debugging, but not the text content.

3. **Error messages only, not stack traces.** Stack traces can contain file paths and variable values that may expose user content. Only the error `message` string is captured.

4. **No IP address.** The Cloudflare Worker has access to `request.headers.get("cf-connecting-ip")` but we deliberately do not store it in the feedback record.

---

## Appendix: Onboarding Tooltip Redesign - Technical Approach

The current `OnboardingTooltips` component works but looks amateur. The redesign preserves the same 4-step flow and localStorage persistence while overhauling the visual presentation.

### What Changes

| Aspect | Current | Redesigned |
|--------|---------|-----------|
| Card shadow | `shadow-xl ring-1 ring-gray-200` | `--dc-shadow-onboarding-card` (deeper, softer) |
| Card width | `w-72` (288px) | `--dc-onboarding-card-width` (300px), max `calc(100vw - 32px)` |
| Backdrop | `bg-black/20` (flat, no spotlight) | SVG mask with rounded-rect cutout over target region |
| Pointer arrow | None | CSS triangle (8px) pointing toward target region |
| Entrance animation | None (instant appear) | `onboarding-tooltip-enter` (scale + opacity, 200ms) |
| Exit animation | None (instant disappear) | `onboarding-tooltip-exit` (scale + opacity, 150ms) |
| Step transition | Instant | Exit current -> 200ms pause -> Enter next |
| Step dots | Plain `h-1.5 rounded-full` with instant color change | `onboarding-dot` class with width/color transition |
| Button styling | `bg-gray-900 text-white` (generic) | `bg-[var(--dc-color-interactive-primary)] text-white` (branded blue) |
| Skip button | `text-gray-500` plain text | `text-[var(--dc-color-text-muted)]` with underline on focus |
| Backdrop click | Calls `handleSkip` (dismisses tour) | Same behavior, retained |

### What Does Not Change

- 4 steps with same keys: "chapter", "sidebar", "sources", "ai"
- `localStorage` key: `dc_onboarding_completed`
- 800ms delay before first step
- Fixed positioning with layout-based placement
- `z-index: 100`
- `role="dialog"`, `aria-label`, `aria-live="polite"`
- Min 44px touch targets on Skip and Next/Done buttons

### Spotlight Backdrop Implementation

The spotlight cutout uses an SVG mask. This avoids the complexity of multiple overlapping divs and supports rounded corners on the cutout.

```html
<svg class="fixed inset-0 w-full h-full z-[99]" aria-hidden="true">
  <defs>
    <mask id="spotlight-mask">
      <!-- White = visible (shows the dark backdrop) -->
      <rect x="0" y="0" width="100%" height="100%" fill="white" />
      <!-- Black = transparent (punches the spotlight hole) -->
      <rect
        x={spotlightRect.left - 8}
        y={spotlightRect.top - 8}
        width={spotlightRect.width + 16}
        height={spotlightRect.height + 16}
        rx="12"
        ry="12"
        fill="black"
      />
    </mask>
  </defs>
  <rect
    x="0" y="0"
    width="100%" height="100%"
    fill="var(--dc-color-onboarding-backdrop)"
    mask="url(#spotlight-mask)"
  />
</svg>
```

For the "editor" and "text-selection" targets (which don't have a specific DOM element to highlight), the spotlight rect covers the center writing area. For "sidebar" and "sources", the spotlight rect is calculated from the corresponding DOM element's `getBoundingClientRect()`.

**iPad Safari note:** `getBoundingClientRect()` returns correct values on iPad Safari when the visual viewport has not been scaled. The existing 800ms delay before the first step ensures the layout has stabilized.

### Replay Tour

The Help page includes a "Replay onboarding tour" button. Implementation:

```typescript
// Shared function, importable by both OnboardingTooltips and HelpPage
export function resetOnboarding(): void {
  try {
    localStorage.removeItem("dc_onboarding_completed");
  } catch {
    // Silently fail
  }
}
```

The Help page button calls `resetOnboarding()` and then navigates to the most recent project's editor page. The `OnboardingTooltips` component checks `localStorage` on mount and triggers the tour if the key is absent.

---

## Appendix: Help Page Architecture

### Route

`/help` is a protected route (requires authentication, uses the `(protected)` layout group).

File: `web/src/app/(protected)/help/page.tsx`

### Structure

```
Help & Support
├── [Hero section: "How can we help?"]
├── FAQ Accordion Group
│   ├── Getting Started (3-4 items)
│   ├── Writing & Editing (3-4 items)
│   ├── AI Features (2-3 items)
│   ├── Exporting (2-3 items)
│   ├── Google Drive (2-3 items)
│   └── Account (2-3 items)
├── [Separator]
├── Actions
│   ├── "Report a problem" -> Opens FeedbackSheet with type="bug"
│   ├── "Suggest an improvement" -> Opens FeedbackSheet with type="suggestion"
│   └── "Replay onboarding tour" -> resetOnboarding() + navigate to editor
└── [Footer: "Built by DraftCrane"]
```

### Layout

- Content constrained to `--dc-help-content-max-width` (640px), centered.
- Uses the standard `(protected)/layout.tsx` header (DraftCrane logo + user button).
- Scrollable content with `pb-[env(safe-area-inset-bottom)]`.
- No sidebar. Clean, single-column layout.

### FAQ Content Format

FAQ content is static (no CMS, no API). Defined as a TypeScript constant array within the page component or a co-located `help-content.ts` file.

```typescript
interface FAQSection {
  id: string;
  title: string;
  items: Array<{
    question: string;
    answer: string; // Plain text or simple HTML-safe markdown
  }>;
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      {
        question: "How do I create a new book project?",
        answer: "Tap the + button on your dashboard...",
      },
      // ...
    ],
  },
  // ...
];
```

Content will be finalized after the development environment stabilizes (per scope note: "defer content updates until dev stabilizes"). The component architecture and styling should be built now with placeholder content.
