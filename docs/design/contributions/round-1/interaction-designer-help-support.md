# Interaction Designer Contribution - Design Brief Round 1

**Author:** Interaction Designer
**Date:** 2026-02-24
**Design Maturity:** Tokens defined
**Scope:** Help & Support System (In-app feedback, Onboarding tooltips redesign, Help page)
**Primary Target:** iPad Safari (landscape primary, portrait secondary)

---

## Screen Inventory

Every screen and surface in the Help & Support system, mapped 1:1 to the three scoped components. No screens outside this scope are introduced.

### Component 1: In-App Feedback / Issue Reporting

| # | Surface | URL Pattern | Type | Purpose | Primary Action |
|---|---------|-------------|------|---------|----------------|
| 1 | Feedback Sheet | N/A (overlay, triggered from settings menu or help page) | Bottom sheet (iPad portrait) / side sheet (landscape/desktop) | Collect bug reports and feature suggestions with auto-attached context | Submit feedback |

This is a single surface. It does not have its own route. It renders as an overlay above the current screen (writing environment or dashboard) and writes to D1 on submit. It optionally creates a GitHub issue via the API worker.

### Component 2: Onboarding Tooltips Redesign

| # | Surface | URL Pattern | Type | Purpose | Primary Action |
|---|---------|-------------|------|---------|----------------|
| 2 | Onboarding Tooltip (step 1-4) | N/A (overlay within `/editor/[projectId]`) | Fixed-position tooltip card | Guide first-time user through writing environment features | Next / Done |

This is an overlay sequence within the editor page. No new route. The existing `onboarding-tooltips.tsx` component is redesigned in place. Tooltip content and step count remain the same (4 steps). Visual styling, animation, and positioning are the scope of change.

### Component 3: Help Page

| # | Surface | URL Pattern | Type | Purpose | Primary Action |
|---|---------|-------------|------|---------|----------------|
| 3 | Help Page | `/help` | Full page (within protected layout) | FAQ with collapsible sections, links to feedback and tour replay | Find an answer / Report a problem |

This is a new protected route. It uses the existing `(protected)/layout.tsx` wrapper (DraftCrane header with user button). The page is lightweight -- static FAQ content with collapsible accordion sections, a "Report a problem" link that opens the Feedback Sheet, and a "Replay tour" trigger that resets onboarding state and navigates to the editor.

### Surface Count Summary

| Component | Surface Count | Route Required |
|-----------|--------------|----------------|
| Feedback Sheet | 1 | No (overlay) |
| Onboarding Tooltips | 1 (4 steps) | No (overlay) |
| Help Page | 1 | Yes (`/help`) |
| **Total** | **3** | **1 new route** |

---

## Key Screen Breakdowns

### Screen 1: Feedback Sheet

#### Layout Description (iPad Portrait - Primary)

The Feedback Sheet slides up from the bottom of the viewport as a bottom sheet, covering approximately 60% of the screen height. On iPad landscape and desktop, it renders as a side sheet sliding in from the right edge (320px wide), matching the existing Library panel interaction pattern.

```
iPad Portrait (bottom sheet):
+------------------------------------------+
|                                          |
|    [Writing environment visible above]   |
|                                          |
+------------------------------------------+
|  ======  (drag handle)                   |
|                                          |
|  [X]  Send Feedback                      |
|                                          |
|  What kind of feedback?                  |
|  ( ) Something isn't working             |
|  ( ) I have a suggestion                 |
|                                          |
|  Tell us what happened                   |
|  +------------------------------------+  |
|  |                                    |  |
|  |  [textarea, 4 lines visible]       |  |
|  |                                    |  |
|  +------------------------------------+  |
|                                          |
|  [Include screenshot]  (optional)        |
|                                          |
|  [       Submit Feedback       ]         |
|                                          |
|  We auto-attach browser info and         |
|  current page context to help us         |
|  understand the issue.                   |
|                                          |
+------------------------------------------+
```

```
iPad Landscape / Desktop (side sheet):
+----------------------------------+--------+
|                                  |  [X]   |
|  [Writing environment visible]   |        |
|                                  | Send   |
|                                  | Feedback|
|                                  |        |
|                                  | [form] |
|                                  |        |
+----------------------------------+--------+
```

#### Content Elements and Hierarchy

1. **Drag handle** (portrait only) -- 40px wide, 4px tall, centered, `#E5E7EB` (`--dc-color-border`). Indicates sheet is draggable.
2. **Close button** (X) -- top-right corner, 44x44pt touch target. Closes sheet without submitting.
3. **Title** -- "Send Feedback" -- 20px, Geist Sans, weight 600, `--foreground`.
4. **Feedback type selector** -- two radio options, each in a tappable card-style row (full-width, min 48px tall, `ring-1 ring-gray-200` default, `ring-2 ring-blue-600 bg-blue-50` selected):
   - "Something isn't working" -- icon: `AlertCircle` (Lucide). For bug reports.
   - "I have a suggestion" -- icon: `Lightbulb` (Lucide). For feature requests.
5. **Description field** -- `<textarea>`, label: "Tell us what happened" (bug) or "What would you like to see?" (suggestion). 4 visible lines. Placeholder text: "Describe what you experienced..." or "Describe your idea...". Required field.
6. **Screenshot attachment** (optional) -- button: "Include screenshot". On tap, opens the native file picker restricted to images (`accept="image/*"`). After attachment: shows filename with a remove (X) button. Max 1 image, max 5MB.
7. **Submit button** -- full-width, 48px tall, `bg-gray-900 text-white rounded-lg`. Label: "Submit Feedback". Disabled until description has at least 10 characters.
8. **Context disclosure** -- 12px caption text, `--color-muted-foreground`. "We auto-attach browser info and current page context to help us understand the issue." This is the transparency signal; no hidden data collection.

#### Primary Action and Visual Weight

Submit Feedback button is the heaviest element: full-width, dark background, bottom of form. The visual hierarchy funnels top-to-bottom: type selection, description, optional attachment, submit.

#### Empty State

The form opens in its initial state with the type selector unselected. Description field is empty with placeholder text. Submit button is disabled (muted opacity). This IS the empty state -- there is no separate "no data" screen because this is a form, not a data display.

#### Loading State

After tapping Submit:
- Button text changes to "Sending..." with a subtle inline spinner (16px, to the left of text).
- Button becomes disabled.
- Form fields become read-only (not visually hidden -- the user can still see what they submitted).
- Duration: typically < 2 seconds.

#### Error State

If submission fails (network error, API error):
- A red inline error message appears above the Submit button: "Something went wrong. Please try again." (14px, `--dc-color-status-error`).
- The Submit button re-enables with its original label.
- Form content is preserved -- the user does not lose their input.
- No toast. The error belongs to this form context, not the global notification system.

#### Success State

On successful submission:
- Sheet closes automatically with the same animation (reverse slide).
- A toast appears at bottom center: "Thanks for your feedback" (uses existing toast system, 2500ms auto-dismiss).
- If user re-opens the sheet, it resets to the initial empty state.

---

### Screen 2: Onboarding Tooltip (Redesigned)

#### Layout Description (iPad Portrait/Landscape)

The tooltip is a floating card that appears near the relevant UI region. It uses fixed positioning with layout-based placement (the existing strategy -- no DOM measurement, for iPad Safari reliability). A semi-transparent backdrop (`bg-black/20`) dims the rest of the interface to focus attention.

```
Tooltip Card (redesigned):
+------------------------------------------+
|                                          |
|  Step 1 of 4                             |
|                                          |
|  This is your chapter.                   |
|  Start writing here, or paste what       |
|  you already have.                       |
|                                          |
|  *  *  ====  *                           |
|                                          |
|  [Skip]                     [Next ->]    |
|                                          |
+------------------------------------------+
```

Key visual changes from current implementation:
- **Step label** replaces dot indicator as primary progress signal. "Step 1 of 4" in 12px caption text, `--color-muted-foreground`. The dots remain as a secondary visual indicator below the text.
- **Card width** increases from `w-72` (288px) to `w-80` (320px) for better text wrapping on iPad.
- **Card padding** increases from `p-5` to `p-6` for more breathing room.
- **Shadow** changes from `shadow-xl` to the design token `--dc-shadow-panel` (`0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.08)`) for consistency with other floating surfaces.
- **Border** uses `ring-1 ring-gray-200` (unchanged, already consistent).
- **Step text** uses 15px instead of 14px (`text-sm`), with `--dc-type-family-sans`, `leading-relaxed`, `--foreground` (not `text-gray-700` -- strengthen contrast).
- **Next button** upgrades from `bg-gray-900` to `bg-gray-900` with an arrow indicator (text: "Next" with a `ChevronRight` icon, or "Done" with a `Check` icon on the final step). Remains 44px min-height touch target.
- **Skip button** remains text-only, `--color-muted-foreground`, 44px min-height. On the last step, Skip is hidden (only "Done" remains).
- **Entrance animation**: card fades in + slides up 8px over 200ms (`ease-out`). Between steps, cards cross-fade (current card fades out 150ms, next card fades in 150ms with slide-up).
- **Backdrop**: unchanged (`bg-black/20`). Tapping the backdrop triggers Skip (same as current).

#### Content Elements and Hierarchy

1. **Step label** -- "Step N of 4", 12px, `--color-muted-foreground`.
2. **Step text** -- the instructional content, 15px, `--foreground`, `leading-relaxed`. This is the primary content.
3. **Progress dots** -- same pattern as current (expanded dot for active, small for inactive), positioned below text.
4. **Skip button** -- left-aligned, text button, 44px min-height.
5. **Next/Done button** -- right-aligned, filled button, 44px min-height, 80px min-width.

#### Empty State

Not applicable. The tooltip sequence either shows or does not show. There is no empty state.

#### Loading State

Not applicable. Tooltip content is static and bundled with the application. No data fetching.

#### Error State

Not applicable. The only failure mode is localStorage being unavailable (already handled silently in the current implementation -- onboarding is skipped).

---

### Screen 3: Help Page

#### Layout Description (iPad Portrait - Primary)

The Help page renders within the existing protected layout (DraftCrane header bar at top). The content area is a single-column centered layout, similar to the dashboard's visual weight.

```
+--------------------------------------------+
| [DraftCrane]                    [UserBtn]  |
+--------------------------------------------+
|                                            |
|          Help & Support                    |
|                                            |
|  +--------------------------------------+  |
|  |  Getting Started                  [v]|  |
|  +--------------------------------------+  |
|  |  How do I create my first book?      |  |
|  |  [answer text...]                    |  |
|  |                                      |  |
|  |  How do I add chapters?              |  |
|  |  [answer text...]                    |  |
|  +--------------------------------------+  |
|                                            |
|  +--------------------------------------+  |
|  |  Writing & Editing                [>]|  |
|  +--------------------------------------+  |
|                                            |
|  +--------------------------------------+  |
|  |  AI Features                      [>]|  |
|  +--------------------------------------+  |
|                                            |
|  +--------------------------------------+  |
|  |  Exporting                        [>]|  |
|  +--------------------------------------+  |
|                                            |
|  +--------------------------------------+  |
|  |  Google Drive                     [>]|  |
|  +--------------------------------------+  |
|                                            |
|  +--------------------------------------+  |
|  |  Account                          [>]|  |
|  +--------------------------------------+  |
|                                            |
|  ----------------------------------------  |
|                                            |
|  Still need help?                          |
|                                            |
|  [  Report a problem  ]                    |
|  [  Replay the tour   ]                    |
|                                            |
+--------------------------------------------+
```

#### Content Elements and Hierarchy

1. **Page title** -- "Help & Support", `font-serif text-2xl font-semibold`, matching the dashboard's "Your Books" heading style.
2. **FAQ sections** -- 6 collapsible accordion groups. Each group has:
   - **Section header** -- full-width, 48px min-height, `text-sm font-semibold`, with a chevron indicator (`ChevronRight` when collapsed, rotates 90deg when expanded). Tapping toggles the section open/closed.
   - **Section content** -- 2-5 Q&A pairs per section. Each pair:
     - **Question** -- `text-sm font-medium`, `--foreground`.
     - **Answer** -- `text-sm`, `--color-muted-foreground`, `leading-relaxed`. Plain text, no markdown rendering. Short (1-3 sentences).
3. **Section divider** -- `border-t border-gray-200`, separates the FAQ from the action section.
4. **"Still need help?" label** -- `text-sm font-medium`, `--foreground`.
5. **"Report a problem" button** -- secondary style: `border border-gray-200 text-gray-700 rounded-lg`, full-width (max 400px), 48px min-height. On tap, opens the Feedback Sheet overlay.
6. **"Replay the tour" button** -- tertiary/text style: `text-sm text-blue-600`, full-width (max 400px), 48px min-height. On tap, clears `dc_onboarding_completed` from localStorage and navigates to the most recent project's editor (or dashboard if no projects). The onboarding tooltips then trigger on the next editor page mount.

#### Primary Action and Visual Weight

The FAQ sections are the visual center of gravity. The "Report a problem" and "Replay the tour" buttons are intentionally secondary -- they sit below the fold on most devices, reinforcing the PRD's directive: "If we did our job it really shouldn't be needed."

#### Empty State

Not applicable. FAQ content is static. There is no data-dependent empty state.

#### Loading State

Not applicable. The page is a static page with no data fetching. It renders instantly from the client-side bundle.

#### Error State

Not applicable. No API calls are made on this page. The only interactive elements (Feedback Sheet trigger, Replay tour) handle their own states independently.

---

## Navigation Model

### Entry Points to Help & Support

The user must reach any help feature in 2 taps or fewer from the writing environment. The following entry points are added:

#### 1. Settings Menu Addition (Primary Entry Point)

The existing `SettingsMenu` component (`web/src/components/project/settings-menu.tsx`) gains a new menu item: "Help & Support". It is placed above the separator that precedes "Delete Project", establishing it as a non-destructive utility action.

**Revised Settings Menu order:**
1. Rename Book
2. Duplicate Book
3. *separator*
4. **Help & Support** (new -- navigates to `/help`)
5. *separator*
6. Delete Project
7. *separator*
8. Sign Out

**Tap count from writing environment:** 2 taps (Settings icon, then "Help & Support").

This keeps the toolbar clean -- no new button in the already-populated toolbar row. The Settings menu is the established location for utility features and the user already knows to find it.

#### 2. Dashboard Footer Link (Secondary Entry Point)

A small text link "Help" is added to the bottom of the dashboard page, below the existing "Import from a backup file" link. Style: `text-sm text-gray-400 hover:text-gray-700`. This provides discoverability outside the editor context.

**Tap count from dashboard:** 1 tap.

#### 3. Protected Layout Header (Tertiary Entry Point)

A question mark icon button is added to the header in `(protected)/layout.tsx`, positioned to the left of the UserButton. This provides a persistent, always-visible entry point from any protected page.

Icon: `HelpCircle` (Lucide), 20x20px, inside a 44x44pt touch target. Style: `text-muted-foreground hover:text-foreground`. On tap, navigates to `/help`.

**Tap count from anywhere:** 1 tap.

#### Why Not a Floating Button?

A floating action button (FAB) was considered and rejected:
- It competes with the existing floating action bar (text selection toolbar) for screen space.
- It would be the only FAB in the application, violating the "no orphan patterns" rule.
- On iPad, floating buttons risk overlapping the system home indicator zone.
- The Settings menu + header icon provide adequate discoverability without polluting the writing surface.

### Feedback Sheet Trigger Points

The Feedback Sheet can be opened from:
1. `/help` page -- "Report a problem" button.
2. Settings Menu -- a future iteration could add a direct "Send Feedback" option, but for v1 we route through the Help page to avoid adding multiple new items to the Settings menu at once.

**Tap count for feedback from writing environment:** 3 taps (Settings > Help & Support > Report a problem). This is one tap beyond the 2-tap maximum for help features, but feedback reporting is a lower-frequency action than help browsing. The 2-tap constraint applies to reaching the Help page, not to every downstream action within it.

Alternative: if testing shows 3 taps is too many, promote "Send Feedback" to a direct Settings Menu item (2 taps).

---

## User Flows

### Flow 1: "I Found a Bug"

**Precondition:** User is in the writing environment, encounters unexpected behavior.

1. User taps the **Settings gear icon** in the editor toolbar (top-right).
2. Settings menu drops down. User taps **"Help & Support"**.
3. Browser navigates to `/help`. The Help page renders with FAQ sections.
4. User scrolls past FAQ content to the "Still need help?" section. User taps **"Report a problem"**.
5. The **Feedback Sheet** slides up from the bottom (portrait) or in from the right (landscape).
6. User sees two options: "Something isn't working" and "I have a suggestion". User taps **"Something isn't working"**.
7. The description field label updates to "Tell us what happened". Placeholder: "Describe what you experienced...".
8. User taps the textarea. **Virtual keyboard rises** (consuming ~45% of screen). The sheet scrolls to keep the textarea and Submit button visible above the keyboard.
9. User types a description (minimum 10 characters to enable submit). Example: "The save indicator got stuck on 'Saving...' and never changed to 'Saved'. I had to reload the page."
10. User optionally taps **"Include screenshot"** to attach an image from their photo library or files.
11. User taps **"Submit Feedback"**. Button changes to "Sending..." and disables.
12. The system auto-attaches context: browser user agent, viewport dimensions, current URL (`/help`), referring URL (the editor URL they came from), current project ID (from session state), error log excerpt (last 5 console errors if available), timestamp.
13. API returns success. Sheet slides closed. **Toast appears**: "Thanks for your feedback" (2500ms).
14. User taps the browser back button or the "DraftCrane" logo to return to the editor.

**Alternate path -- fast track from header:** User taps the `?` icon in the header (1 tap to `/help`), then "Report a problem" (1 more tap to Feedback Sheet). Total: 2 taps to reach the form.

**Error path:** If submission fails at step 12, the sheet remains open. An inline red error message appears: "Something went wrong. Please try again." The Submit button re-enables. User input is preserved. User can retry or close the sheet (input is lost on close; this is acceptable for short-form feedback).

### Flow 2: "I Have a Suggestion"

**Precondition:** User has an idea for a feature improvement while using the app.

1. User taps the **`?` icon** in the header bar.
2. Browser navigates to `/help`.
3. User taps **"Report a problem"** (the button serves both bugs and suggestions -- the type selector inside the sheet handles differentiation).
4. Feedback Sheet opens. User taps **"I have a suggestion"**.
5. The description field label updates to "What would you like to see?". Placeholder: "Describe your idea...".
6. User types their suggestion. Example: "It would be great if the word count showed my daily progress, not just the total."
7. Screenshot is optional but available if the user wants to annotate a mockup or reference.
8. User taps **"Submit Feedback"**. Same submission flow as the bug report.
9. Toast: "Thanks for your feedback".

This flow is identical to Flow 1 except for the type selection at step 4, which changes the field label and placeholder copy. The API payload includes the `type` field ("bug" or "suggestion") so the backend can route appropriately (e.g., different GitHub issue labels).

### Flow 3: "I'm Confused About a Feature"

**Precondition:** User is trying to use a feature (e.g., exporting) and cannot figure out how it works.

1. User taps the **`?` icon** in the header bar.
2. Browser navigates to `/help`.
3. User sees six FAQ sections. User scans the section headers:
   - Getting Started
   - Writing & Editing
   - AI Features
   - **Exporting** (this is the relevant one)
   - Google Drive
   - Account
4. User taps **"Exporting"**. The section header chevron rotates from right-pointing to downward. The section content reveals with a height animation (200ms `ease-out`).
5. User reads the Q&A pairs:
   - **Q:** "How do I export my book?" **A:** "Tap the Export button in the toolbar, then choose PDF or EPUB. Your entire manuscript exports as a single file."
   - **Q:** "Can I export a single chapter?" **A:** "Not yet. Export currently covers the full book. We are working on chapter-level export."
6. User finds their answer and navigates back to the editor via the browser back button or the "DraftCrane" logo link.

**Dead-end path:** If the FAQ does not answer their question, the user scrolls to "Still need help?" and taps "Report a problem" to submit a question/suggestion via the Feedback Sheet. This ensures every confusion has a resolution path, even when the FAQ is insufficient.

### Flow 4: "First Time Using the App" (Onboarding)

**Precondition:** User has just created their first project via `/setup`. They are redirected to `/editor/[projectId]`.

1. Editor page mounts. The `OnboardingTooltips` component checks `localStorage` for `dc_onboarding_completed`. Not found.
2. After an **800ms delay** (allowing the editor to fully render), the onboarding sequence begins.
3. **Backdrop fades in** (`bg-black/20`, 200ms fade). The tooltip card for Step 1 **fades in and slides up 8px** (200ms `ease-out`).
4. **Step 1 -- "This is your chapter"**: Tooltip positioned center-upper area of the writing surface. Text: "This is your chapter. Start writing here, or paste what you already have." Step label: "Step 1 of 4". Buttons: [Skip] [Next].
5. User taps **"Next"**. Current tooltip **fades out** (150ms). Next tooltip **fades in with slide-up** (150ms). Backdrop remains.
6. **Step 2 -- "Use the sidebar"**: Tooltip positioned near the left sidebar. Text: "Use the sidebar to switch between chapters or add new ones."
7. User taps **"Next"**.
8. **Step 3 -- "Add sources"**: Tooltip positioned near the top-right (Library button area). Text: "Add documents from Google Drive or your device."
9. User taps **"Next"**.
10. **Step 4 -- "Select text for AI"**: Tooltip centered in the writing area. Text: "Select any text to get AI suggestions for rewriting." Skip button is hidden. Button: [Done].
11. User taps **"Done"**. Tooltip fades out. Backdrop fades out (200ms). `localStorage.setItem("dc_onboarding_completed", "true")`.
12. The editor is now fully interactive. The user can start writing.

**Skip path:** At any step, the user can tap "Skip" or tap the backdrop. This immediately ends the sequence: tooltip and backdrop fade out, `dc_onboarding_completed` is set.

**Critical constraint:** The tooltip pointer-events strategy (already implemented) uses `pointer-events-none` on the container with `pointer-events-auto` only on the card and backdrop. This ensures that if the user accidentally triggers a native iPadOS text selection gesture outside the tooltip, the tooltip layer does not intercept it. The backdrop click handler calls `handleSkip`, which is the correct behavior -- if the user is trying to interact with the editor, they want to dismiss the onboarding, not be trapped by it.

### Flow 5: "I Want to Replay the Tour"

**Precondition:** User previously completed or skipped onboarding. They want to see the tooltips again.

1. User taps the **`?` icon** in the header bar (or navigates to `/help` via Settings > Help & Support).
2. On the Help page, user scrolls to the bottom. User taps **"Replay the tour"**.
3. The system calls `localStorage.removeItem("dc_onboarding_completed")`.
4. The system navigates to the editor:
   - If the user has projects: navigate to the most recently edited project (`/editor/[projectId]`).
   - If the user has no projects: navigate to `/setup` (the tour only works in the editor context, so we need a project first; the welcome flow at `/setup` serves as a precondition).
5. The editor page mounts. `OnboardingTooltips` checks localStorage -- key not found. The 800ms delay triggers. The onboarding sequence begins from Step 1.
6. The user experiences the full tour again, identical to Flow 4.

**Edge case:** If the user is already on the editor page when they trigger replay (not possible in this navigation model, since they must visit `/help` first), the page would need a state reset. The current architecture handles this because the `OnboardingTooltips` component checks localStorage on mount; navigating away and back triggers a fresh mount. No special handling needed.

---

## Feedback Form Design

### Form Fields

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Feedback type | Radio group (2 options) | Yes | Must select one before submit | "Something isn't working" / "I have a suggestion" |
| Description | Textarea | Yes | Min 10 characters, max 2000 characters | Label and placeholder change based on type selection |
| Screenshot | File input (image/*) | No | Max 1 file, max 5MB, image/* only | Optional attachment |

### Auto-Attached Context (Not User-Editable)

The following context is collected automatically and included in the submission payload. The user is informed via the disclosure text at the bottom of the form. None of this data is hidden -- it is described transparently.

| Field | Source | Purpose |
|-------|--------|---------|
| `userAgent` | `navigator.userAgent` | Browser/device identification |
| `viewport` | `window.innerWidth` x `window.innerHeight` | Screen size context |
| `currentUrl` | `window.location.href` | Which page the user was on |
| `referrerUrl` | `document.referrer` or session-tracked previous URL | Where they came from before `/help` |
| `projectId` | Session state (if in editor context) | Which project they were working on |
| `chapterId` | Session state (if in editor context) | Which chapter was active |
| `timestamp` | `new Date().toISOString()` | When the report was filed |
| `appVersion` | Build-time constant or `package.json` version | Which version they are running |
| `recentErrors` | Captured from `window.onerror` / `console.error` override (last 5, truncated to 500 chars each) | Automatic error context for bug reports |
| `feedbackType` | Radio selection value ("bug" or "suggestion") | Routing and triage |

### Validation Rules

- **Submit disabled until:** feedback type is selected AND description has 10+ characters (after trimming).
- **Character count:** shown below the textarea as `N / 2000` in 12px muted text. Turns red (`--dc-color-status-error`) at 1900+ characters.
- **Screenshot validation:** if the file exceeds 5MB, show an inline error below the attachment button: "Image must be under 5MB." The file is rejected and the input resets.
- **No client-side HTML sanitization on description** -- the API worker handles sanitization on write.

### Submission Payload (to API)

```typescript
interface FeedbackPayload {
  type: "bug" | "suggestion";
  description: string;
  screenshot?: File; // sent as multipart/form-data
  context: {
    userAgent: string;
    viewport: string;
    currentUrl: string;
    referrerUrl: string;
    projectId: string | null;
    chapterId: string | null;
    timestamp: string;
    appVersion: string;
    recentErrors: string[];
  };
}
```

### D1 Schema Direction

The feedback is written to a D1 table. The API worker handles:
1. Write the feedback record to D1.
2. If `type === "bug"`, optionally create a GitHub issue with the `bug` label via the GitHub App.
3. If `type === "suggestion"`, optionally create a GitHub issue with the `enhancement` label.

The "optionally create GitHub issue" behavior can be toggled by an environment variable on the worker. During early beta, all feedback creates issues. Later, a threshold or manual review step may be added.

---

## Onboarding Tooltip Interaction

### Step Sequence

| Step | Key | Target Region | Tooltip Position | Text |
|------|-----|---------------|-----------------|------|
| 1 | `chapter` | Center writing area | `top-1/3 left-1/2 -translate-x-1/2` | "This is your chapter. Start writing here, or paste what you already have." |
| 2 | `sidebar` | Left sidebar | `top-1/3 left-4 lg:left-[270px]` | "Use the sidebar to switch between chapters or add new ones." |
| 3 | `sources` | Library button (top-right toolbar) | `top-16 right-4 lg:right-[200px]` | "Add documents from Google Drive or your device." |
| 4 | `ai` | Center writing area | `top-1/2 left-1/2 -translate-x-1/2` | "Select any text to get AI suggestions for rewriting." |

Step content and positioning remain unchanged from the current implementation. The redesign scope is visual polish and animation, not content or positioning logic.

### Animation Specification

| Transition | Duration | Easing | Description |
|------------|----------|--------|-------------|
| Backdrop appear | 200ms | `ease-out` | Opacity 0 to 0.2 (bg-black/20) |
| Backdrop disappear | 200ms | `ease-in` | Opacity 0.2 to 0 |
| Tooltip enter (first step) | 200ms | `ease-out` | Opacity 0 to 1, translateY(8px) to translateY(0) |
| Tooltip exit (step transition) | 150ms | `ease-in` | Opacity 1 to 0, translateY(0) to translateY(-4px) |
| Tooltip enter (step transition) | 150ms | `ease-out` | Opacity 0 to 1, translateY(8px) to translateY(0). Starts after exit completes (total step transition: 300ms). |
| Tooltip exit (final dismiss) | 200ms | `ease-in` | Opacity 1 to 0, concurrent with backdrop disappear |
| Progress dot expand | 150ms | `ease-out` | Width transition from 6px to 24px, color transition from gray-300 to blue-600 |
| Progress dot contract | 150ms | `ease-out` | Width transition from 24px to 6px, color transition from blue-600 to gray-300 |

All animations must have `prefers-reduced-motion: reduce` overrides that remove the motion (opacity-only cross-fade, no translateY).

### Positioning Strategy

The current layout-based positioning strategy is maintained. No DOM measurement, no `getBoundingClientRect`. The positioning classes target spatial regions of the editor layout, not specific DOM elements. This is the correct approach for iPad Safari where:
- The Tiptap editor can shift layout during initialization.
- Fixed positioning interacts unpredictably with the virtual keyboard.
- DOM-measuring approaches create timing dependencies with lazy-loaded content.

If future work adds DOM-measuring (e.g., for a pointer arrow from tooltip to target), it should be additive and fall back gracefully to the layout-based approach.

### Dismissal Behavior

| Trigger | Action | Saves Completion? |
|---------|--------|-------------------|
| "Next" button | Advance to next step | No (only on final "Done") |
| "Done" button (last step) | Close sequence | Yes |
| "Skip" button | Close sequence | Yes |
| Backdrop tap | Close sequence | Yes |
| Escape key | Close sequence | Yes |
| Browser navigation away | Close sequence (component unmounts) | No (user may return, re-trigger) |

"Saves completion" means `localStorage.setItem("dc_onboarding_completed", "true")`. The browser navigation case intentionally does NOT save completion, so if the user navigates away mid-tour (e.g., accidental back gesture), they get another chance on return.

### iPadOS Text Selection Non-Interference

The existing implementation correctly handles this:
- The tooltip container is `pointer-events-none`.
- Only the card and backdrop are `pointer-events-auto`.
- The gap between the backdrop and the card (around the card edges) passes through to the editor.

However, the backdrop itself covers the full viewport, which means:
- Native text selection CANNOT start while the backdrop is visible.
- This is acceptable because the onboarding sequence is brief (4 steps, ~15 seconds) and the user is not expected to write during it.
- Tapping the backdrop dismisses the sequence, immediately restoring full editor interactivity.

No changes needed to the pointer-events strategy.

---

## Help Page Interaction

### Accordion / Collapsible Behavior

Each FAQ section is an independent accordion group. **Multiple sections can be open simultaneously** (not mutually exclusive). This matches the PRD's principle of "Nothing Precious" -- collapsing one section because the user opened another is a hostile micro-interaction.

#### Section Toggle Mechanics

- **Tap the section header** (full-width row, 48px min-height) to toggle open/closed.
- **Chevron indicator**: `ChevronRight` (Lucide, 16px) rotates to `ChevronDown` (90deg clockwise) when open. Rotation animates over 150ms `ease-out`.
- **Content reveal**: height animates from 0 to auto over 200ms `ease-out`. Content fades in concurrently (opacity 0 to 1, 200ms).
- **Content collapse**: height animates from current to 0 over 200ms `ease-in`. Content fades out concurrently (opacity 1 to 0, 150ms).
- **Reduced motion**: disable height animation. Content appears/disappears instantly. Chevron rotation still applies (rotation is spatial information, not decorative motion).

#### Keyboard Interaction

- Section headers are `<button>` elements, keyboard-focusable by default.
- `Enter` or `Space` toggles the section.
- `aria-expanded="true"` / `aria-expanded="false"` on the header button.
- `aria-controls="faq-section-{id}"` on the header, pointing to the content region's `id`.
- Content region has `role="region"` and `aria-labelledby="faq-header-{id}"`.

### Search

No search on the Help page. The FAQ content is small (6 sections, ~20 Q&A pairs). Adding search introduces complexity (index, highlight, no-results state) that is not justified for this content volume. If the FAQ grows beyond 30 questions, revisit.

### Deep Linking

Each section supports deep linking via URL hash:
- `/help#getting-started`, `/help#writing-editing`, `/help#ai-features`, `/help#exporting`, `/help#google-drive`, `/help#account`.
- On page load, if a hash is present, the corresponding section auto-expands and the page scrolls to it.
- This enables linking to specific sections from external sources (support emails, documentation).

Section IDs for hash targets:

| Section | Hash | ID |
|---------|------|----|
| Getting Started | `#getting-started` | `faq-section-getting-started` |
| Writing & Editing | `#writing-editing` | `faq-section-writing-editing` |
| AI Features | `#ai-features` | `faq-section-ai-features` |
| Exporting | `#exporting` | `faq-section-exporting` |
| Google Drive | `#google-drive` | `faq-section-google-drive` |
| Account | `#account` | `faq-section-account` |

### FAQ Content Structure

Each section contains 2-5 Q&A pairs. Content is defined as a static data structure in the component file (or a co-located JSON file), not fetched from an API. This keeps the page instant-loading and eliminates loading/error states.

Placeholder content structure (final copy is deferred):

**Getting Started:**
- How do I create my first book?
- How do I add chapters?
- How do I rearrange chapters?

**Writing & Editing:**
- How do I rename a chapter?
- Can I paste content from Google Docs?
- Where is my work saved?

**AI Features:**
- How do I use the rewrite feature?
- Can the AI write for me?
- How do I control the AI's tone?

**Exporting:**
- How do I export my book?
- What formats are supported?
- Can I export a single chapter?

**Google Drive:**
- How do I connect Google Drive?
- Where are my files stored?
- Can I disconnect Drive?

**Account:**
- How do I change my email?
- How do I delete my account?
- How do I sign out?

---

## Responsive Strategy

### Feedback Sheet

| Breakpoint | Layout | Dimensions | Behavior |
|------------|--------|------------|----------|
| **Portrait** (768-1023px) | Bottom sheet | 100% width, ~60% height, rounded-t-xl | Slides up from bottom. Drag handle visible. Sheet is scrollable if content exceeds visible area (critical for virtual keyboard). |
| **Landscape** (1024-1279px) | Side sheet (right) | 320px wide, full height | Slides in from right edge, matching Library panel pattern. No drag handle. Close button (X) top-right. |
| **Desktop** (1280px+) | Side sheet (right) | 400px wide, full height | Same as landscape but wider for comfortable form completion. |

**Virtual keyboard handling (portrait bottom sheet):** When the keyboard rises, the sheet's content area scrolls to keep the focused input visible. The Submit button may scroll below the fold, which is acceptable -- the user scrolls down to reach it after typing. The sheet does NOT shrink to fit above the keyboard (this would make the description field unusably small). Instead, the sheet maintains its height and the content scrolls.

Implementation: use `visualViewport.height` to detect keyboard presence. When keyboard is detected, add `overflow-y: auto` to the sheet content area and ensure the focused element is scrolled into view via `element.scrollIntoView({ block: "nearest" })`.

### Onboarding Tooltips

| Breakpoint | Card Width | Positioning | Backdrop |
|------------|-----------|-------------|----------|
| **Portrait** (768-1023px) | 320px (`w-80`) | Center-biased. All steps use center positioning since the sidebar is collapsed in portrait. | Full viewport `bg-black/20` |
| **Landscape** (1024-1279px) | 320px (`w-80`) | Per-step positioning (same as current implementation). Sidebar step positioned near left edge. Sources step positioned near right edge. | Full viewport `bg-black/20` |
| **Desktop** (1280px+) | 320px (`w-80`) | Same as landscape. | Full viewport `bg-black/20` |

**Portrait adaptation:** In portrait mode, the sidebar is collapsed (shown as a "Ch X" pill). The "Use the sidebar" step (Step 2) should position its tooltip near the collapsed pill indicator (left edge, vertically centered) rather than next to a visible sidebar. The positioning class for the `sidebar` target in portrait should be `top-1/2 left-4` rather than `left-[270px]`.

This requires a responsive positioning adjustment. The existing `getPositionClasses` function should accept viewport width context or use Tailwind responsive prefixes more granularly:

```
sidebar target:
  Portrait: "top-1/2 left-4 -translate-y-1/2"
  Landscape: "top-1/3 left-4 lg:left-[270px]"
```

### Help Page

| Breakpoint | Content Width | Padding | Layout |
|------------|-------------|---------|--------|
| **Portrait** (768-1023px) | 100%, `max-w-2xl`, `px-4` | 16px horizontal | Single column, full width. FAQ sections stack vertically. |
| **Landscape** (1024-1279px) | `max-w-2xl`, centered | 24px horizontal | Same single column, narrower and centered. More whitespace on sides. |
| **Desktop** (1280px+) | `max-w-2xl`, centered | 24px horizontal | Same as landscape. The content does not need to expand further -- it is a focused, short-form page. |

The Help page does not adapt its layout structure across breakpoints. It is always a single centered column. The only responsive change is the horizontal padding (tighter on portrait, looser on landscape/desktop). This matches the simplicity principle -- the page is lightweight and does not warrant a multi-column layout.

---

## Implementation Notes

### Component Architecture

| Component | File Location | New/Existing |
|-----------|--------------|-------------|
| `FeedbackSheet` | `web/src/components/feedback/feedback-sheet.tsx` | New |
| `FeedbackTypeSelector` | `web/src/components/feedback/feedback-type-selector.tsx` | New |
| `OnboardingTooltips` | `web/src/components/editor/onboarding-tooltips.tsx` | Existing (restyled) |
| `HelpPage` | `web/src/app/(protected)/help/page.tsx` | New |
| `FaqAccordion` | `web/src/components/help/faq-accordion.tsx` | New |
| `FaqSection` | `web/src/components/help/faq-section.tsx` | New |

### State Management

- **Feedback Sheet open/close:** local state in the parent component that renders it. No global state needed.
- **Onboarding completion:** `localStorage` key `dc_onboarding_completed` (existing, unchanged).
- **FAQ accordion state:** local state in `FaqAccordion` component. Hash-based initial expansion on mount.
- **Feedback form state:** local state in `FeedbackSheet`. Reset on successful submission. No persistence across sessions.

### Existing Pattern Reuse

- **Toast notifications:** reuse the existing `useToast` hook and `ToastProvider` for the "Thanks for your feedback" confirmation.
- **Sheet animation:** the Feedback Sheet bottom-sheet animation reuses the existing `slide-up` keyframe from `globals.css`. The side-sheet variant reuses the `sources-panel-slide-in` pattern (reversed to come from the right).
- **Menu pattern:** the Settings Menu addition follows the existing `SettingsMenu` component's menu item pattern exactly (44px min-height, icon + label, same padding and hover states).
- **Accordion pattern:** new, but follows the disclosure pattern already used in the Sources panel for expandable content.
