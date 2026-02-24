# DraftCrane Help & Support System - Design Brief

> Synthesized from 1-round, 4-role design brief process. Generated 2026-02-24.
> Design Maturity: Tokens defined

## Table of Contents

1. Product Identity
2. Brand Personality & Design Principles
3. Target User Context
4. Visual Language
5. Screen Inventory & Key Screens
6. Interaction Patterns
7. Component System Direction
8. Technical Constraints
9. Inspiration & Anti-Inspiration
10. Design Asks
11. Open Design Decisions

---

## 1. Product Identity

**Product:** DraftCrane
**Tagline:** Your book. Your files. Your cloud. With an AI writing partner.
**Stage:** Phase 0 - Prototype, approaching beta launch
**Primary Platform:** iPad Safari (iPadOS 17+), desktop secondary

The Help & Support system is scoped to three components:

1. **In-app feedback/issue reporting** - handles both bugs and feature suggestions
2. **Onboarding tooltips redesign** - visual polish of existing 4-step tour
3. **Help page** - lightweight `/help` route with collapsible FAQ sections

This system is not a product differentiator. It is a trust signal. The existence of polished help surfaces tells the user that DraftCrane is maintained by a real team - a critical message for authors who are anxious about investing their book in an early-stage tool.

---

## 2. Brand Personality & Design Principles

### Brand Personality Applied to Help & Support

DraftCrane's five traits carry into help surfaces with a shifted emotional register. In the editor, the brand is invisible. In help and support, the brand speaks directly.

| Trait                | In Help & Support Context                                                                                                            | This, Not That                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Quiet Confidence** | Does not panic when something goes wrong. Error messages are calm. Auto-captures diagnostics so the user does not do debugging work. | "We got your report and will look into it" - not "Error code 0x4F2A has been logged. Reference ticket #38291."                           |
| **Literate**         | Copy reads like it was written by a person. FAQ answers are direct and conversational. Every word earns its place.                   | "Your chapters save automatically to Google Drive" - not "DraftCrane leverages Google Drive's API to provide real-time synchronization." |
| **Trustworthy**      | Acknowledges problems honestly. Tells the user what happens next. No false promises.                                                 | "Sent. We read every report." - not "Your feedback is important to us! Our team will review your submission as soon as possible."        |
| **Purposeful**       | Help page is lean. FAQ exists as a safety net, not a feature showcase. If the tour needs more than 4 steps, the UI has failed.       | Six focused FAQ sections - not a searchable knowledge base with 200 articles and a chatbot.                                              |
| **Author-Centric**   | Language stays in the author's world. "Your chapter" not "the document." "Report a problem" not "Submit a ticket."                   | FAQ titled "Writing & Editing" - not "Editor Features."                                                                                  |

### Design Principles Applied to Help & Support

| #   | Principle                  | Help & Support Application                                                                                                                                                                                 |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Writing Comes First**    | No floating help widget. Feedback lives in settings menu, not the toolbar. Onboarding appears once, then permanently gone. Help page is a separate route, not an editor overlay.                           |
| 2   | **Show the Work**          | When feedback is submitted, confirm that context was auto-captured: "We included your browser info and recent activity so you don't have to describe your setup." Onboarding shows progress (step 2 of 4). |
| 3   | **Respect the Surface**    | Every element meets 44px minimum touch targets. Feedback form works with iPad virtual keyboard. Help page is scrollable with touch.                                                                        |
| 4   | **Spatial Consistency**    | Onboarding tooltips point at elements in their correct spatial positions - sidebar tooltip near the sidebar, library tooltip near the right edge.                                                          |
| 5   | **Invisible Technology**   | Feedback form never asks browser version, device type, or error codes. All captured automatically. Bug vs. suggestion is a simple toggle, not a category dropdown.                                         |
| 6   | **Progressive Disclosure** | Onboarding: 4 steps, no more. Help page: collapsible sections - see titles, expand what you need. Feedback form: starts with one text field.                                                               |
| 7   | **Nothing Precious**       | Skip the tour? Fine. Dismiss a tooltip? No "Are you sure?" Close the form mid-typing? Text is lost (it was one field). Exception: 50+ character draft gets a "Discard?" confirmation.                      |

---

## 3. Target User Context

> Written from the perspective of Diane Mercer (52, leadership consultant, iPad Pro user), synthesized from the Target User contribution.

**Who she is:** A professional with 14 years of consulting experience, writing a nonfiction book. She has invested real writing time in DraftCrane. She is cautiously optimistic but slightly anxious - she has been burned by tools before.

**Her environment:** iPad Pro 12.9" with Smart Keyboard Folio, Safari, usually landscape. Often in hotel lobbies between client meetings. When something breaks, she has about fifteen seconds to find help and zero technical vocabulary. "It stopped working" is her most precise language.

**What the help system means to her:**

> "When I hear that DraftCrane is building a help system, my first reaction is relief. **This makes the product feel more real.** A tool that has a help page and a way to report problems is a tool that someone is maintaining."

**Her three make-or-break moments:**

1. **The first time something goes wrong.** If she finds "Report a problem" within ten seconds and submits in under thirty seconds, she trusts DraftCrane. If she cannot find it, she starts copying chapters back to Google Docs that evening.

2. **Returning after a two-week break.** She opens the app and cannot remember how to export. If the help page gives her a one-sentence answer, she feels competent. If the answers are too long or too technical, she feels the familiar deflation.

3. **Quality of the onboarding tooltips.** They happen once, but they set the emotional baseline. Clean and professional tooltips mean "these people know what they are doing." Rough tooltips mean every subsequent hiccup reinforces doubt.

**What turns her off:**

- Category dropdowns on the feedback form ("UI Bug," "Performance Issue" - she does not know which one her problem is)
- Tooltips that are cute or playful ("I'm a 52-year-old professional, not playing Duolingo")
- Help page opening in a new Safari tab (losing her writing context)
- "Community forum" as a support channel
- No acknowledgment after submitting feedback
- Help page that looks different from the rest of the app

**How she expects to navigate:**

- Looks for a `?` icon, the settings menu, or scrolls to the bottom
- Feedback and help should be one tap from any screen
- The word "Help" should be visible, not just an icon she has to decode when already frustrated

---

## 4. Visual Language

### Color System

No new hues are introduced. The Help & Support system uses the existing palette with semantic additions for feedback states. All pairings pass WCAG AA.

#### Neutral Palette (Existing)

| Token                          | Hex       | Usage in Help/Support                                           |
| ------------------------------ | --------- | --------------------------------------------------------------- |
| `--foreground`                 | `#171717` | Headings, primary button backgrounds, input text                |
| `--dc-color-text-secondary`    | `#374151` | Body text in tooltips, FAQ answers, form instructions           |
| `--dc-color-text-muted`        | `#6B7280` | Skip button, context disclosure, chevron icons (5.0:1 vs white) |
| `--dc-color-text-placeholder`  | `#9CA3AF` | Input placeholder text                                          |
| `--dc-color-border`            | `#E5E7EB` | FAQ dividers, tooltip ring, inactive step dots                  |
| `--dc-color-border-strong`     | `#D1D5DB` | Input field borders                                             |
| `--dc-color-surface-secondary` | `#F9FAFB` | FAQ answer background, alternating section background           |
| `--background`                 | `#FFFFFF` | Card backgrounds, form backgrounds, page backgrounds            |

#### Semantic Colors (Additions)

| Token                                   | Hex       | Usage                                     | Contrast vs White |
| --------------------------------------- | --------- | ----------------------------------------- | ----------------- |
| `--dc-color-interactive-primary`        | `#2563EB` | Active step dot, links, suggestion toggle | 4.6:1             |
| `--dc-color-interactive-primary-subtle` | `#EFF6FF` | Suggestion toggle active background       | --                |
| `--dc-color-status-error`               | `#DC2626` | Bug toggle active text, validation errors | 4.5:1             |
| `--dc-color-error-bg`                   | `#FEF2F2` | Bug toggle active background              | --                |
| `--dc-color-status-success`             | `#059669` | Success confirmation text, checkmark      | 4.6:1             |
| `--dc-color-success-bg`                 | `#ECFDF5` | Success confirmation background           | --                |

### Typography

No new fonts. Existing stack: Geist Sans (UI), Lora (page-level content headings).

| Element                        | Size | Weight | Font       | Rationale                          |
| ------------------------------ | ---- | ------ | ---------- | ---------------------------------- |
| Help page heading ("Help")     | 30px | 600    | Lora       | Standalone content page            |
| Help section headings          | 20px | 600    | Lora       | Content hierarchy                  |
| Feedback form heading          | 20px | 600    | Geist Sans | Functional UI surface, not content |
| FAQ question text              | 16px | 500    | Geist Sans | Scannable reading on iPad          |
| FAQ answer text                | 16px | 400    | Geist Sans | Body reading weight                |
| Tooltip step text              | 14px | 400    | Geist Sans | Compact for floating card          |
| Step indicator ("Step 2 of 4") | 12px | 500    | Geist Sans | Caption                            |
| Form textarea input            | 16px | 400    | Geist Sans | Prevents iOS zoom on focus         |
| Context disclosure             | 12px | 500    | Geist Sans | De-emphasized                      |

### Spacing & Rhythm

4px base unit. Key dimensions:

| Component         | Property                | Value                                                     |
| ----------------- | ----------------------- | --------------------------------------------------------- |
| **Tooltip card**  | Width                   | 300px (max `calc(100vw - 32px)`)                          |
|                   | Padding                 | 20px                                                      |
|                   | Border radius           | 12px                                                      |
|                   | Shadow                  | `0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)` |
| **Feedback form** | Max width               | 480px                                                     |
|                   | Padding                 | 24px                                                      |
|                   | Textarea min-height     | 120px                                                     |
|                   | Border radius           | 12px                                                      |
| **Help page**     | Content max-width       | 640-680px (centered)                                      |
|                   | FAQ row min-height      | 48px                                                      |
|                   | Between FAQ sections    | 32px                                                      |
|                   | Footer links top margin | 48px                                                      |

### Iconography

All Lucide, 24px grid, 2px stroke, outline style:

| Action                    | Icon                        | Size |
| ------------------------- | --------------------------- | ---- |
| Help entry point (header) | `HelpCircle`                | 20px |
| Report a problem          | `MessageSquare`             | 20px |
| Bug report indicator      | `AlertTriangle`             | 16px |
| Feature request indicator | `Lightbulb`                 | 16px |
| FAQ expand/collapse       | `ChevronDown` / `ChevronUp` | 20px |
| Getting Started section   | `Rocket`                    | 20px |
| Writing & Editing section | `PenLine`                   | 20px |
| AI Features section       | `Sparkles`                  | 20px |
| Exporting section         | `FileDown`                  | 20px |
| Google Drive section      | `HardDrive`                 | 20px |
| Account section           | `User`                      | 20px |
| Tour replay               | `RotateCcw`                 | 16px |
| Success checkmark         | `Check`                     | 20px |
| Context info              | `Info`                      | 14px |

No illustrations. No mascots. No decorative imagery.

---

## 5. Screen Inventory & Key Screens

### Screen Inventory

| #   | Surface                       | Type                                             | Route                | Purpose                                                          | Primary Action                 |
| --- | ----------------------------- | ------------------------------------------------ | -------------------- | ---------------------------------------------------------------- | ------------------------------ |
| 1   | Feedback Sheet                | Bottom sheet (portrait) / side sheet (landscape) | None (overlay)       | Collect bug reports and feature suggestions                      | Submit feedback                |
| 2   | Onboarding Tooltips (4 steps) | Fixed-position tooltip overlay                   | None (within editor) | Guide first-time user through writing environment                | Next / Done                    |
| 3   | Help Page                     | Full page (protected layout)                     | `/help`              | FAQ with collapsible sections, links to feedback and tour replay | Find answer / Report a problem |

**Total: 3 surfaces, 1 new route.**

### Key Screen: Feedback Sheet

```
Portrait (bottom sheet):                    Landscape (side sheet):
+------------------------------------------+   +-------------------------+---------+
|  [Writing environment visible above]     |   |                         |  [X]    |
+------------------------------------------+   |  [Writing environment]  |         |
|  ======  (drag handle)                   |   |                         | Report  |
|                                     [X]  |   |                         | a       |
|  Report a Problem                        |   |                         | Problem |
|  Describe what happened.                 |   |                         |         |
|                                          |   |                         | [form]  |
|  [Something broke]  [I have an idea]     |   |                         |         |
|                                          |   +-------------------------+---------+
|  +------------------------------------+  |
|  | What happened?                     |  |
|  |                                    |  |
|  +------------------------------------+  |
|                                          |
|  (i) Includes: browser, device, chapter  |
|                                          |
|               [ Send ]                   |
+------------------------------------------+
```

- **Type toggle:** Two tappable cards. Bug selected: `#DC2626` text on `#FEF2F2` bg. Idea selected: `#2563EB` text on `#EFF6FF` bg. Unselected: `#374151` text on white, `1px #D1D5DB` border.
- **Textarea:** 16px input (prevents iOS zoom), `1px #D1D5DB` border, blue focus ring
- **Submit button:** Full-width, `#171717` bg, white text, 44px min-height. Disabled until 10+ characters.
- **Context disclosure:** 12px muted text with `Info` icon. "Includes: browser, device, current chapter, recent errors"
- **Success state:** Sheet closes, toast: "Thanks for your feedback" (2500ms auto-dismiss)
- **Error state:** Inline red message above submit button: "Something went wrong. Please try again." Input preserved.

### Key Screen: Onboarding Tooltip (Redesigned)

```
+------------------------------------------+
|  Step 1 of 4                             |
|                                          |
|  This is your chapter. Start writing     |
|  here, or paste what you already have.   |
|                                          |
|  [*] [.] [.] [.]                         |
|                                          |
|  Skip                        [ Next -> ] |
+------------------------------------------+
         |
         V  (pointer arrow to target)
```

Key changes from current implementation:

| Aspect          | Current            | Redesigned                                                |
| --------------- | ------------------ | --------------------------------------------------------- |
| Shadow          | `shadow-xl ring-1` | `0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)` |
| Width           | 288px              | 300px (max `calc(100vw - 32px)`)                          |
| Pointer arrow   | None               | 8px CSS triangle pointing toward target                   |
| Entrance        | Instant            | Scale 0.95 + opacity, 200ms ease-out                      |
| Exit            | Instant            | Scale 0.95 + opacity, 150ms ease-in                       |
| Step transition | Instant            | Exit 150ms, enter 150ms (300ms total)                     |
| Progress dots   | Static color swap  | Width + color transition, 200ms                           |
| Step label      | None               | "Step N of 4" in 12px caption                             |

### Key Screen: Help Page

```
+--------------------------------------------+
| [DraftCrane]                 [?] [UserBtn] |
+--------------------------------------------+
|                                            |
|          Help                              |
|                                            |
|  [Rocket] Getting Started              [v] |
|  ----------------------------------------  |
|    How do I create a new book?             |
|    [answer...]                             |
|    How do I add chapters?                  |
|    [answer...]                             |
|                                            |
|  [PenLine] Writing & Editing           [>] |
|  ----------------------------------------  |
|  [Sparkles] Editing Help               [>] |
|  ----------------------------------------  |
|  [FileDown] Exporting                  [>] |
|  ----------------------------------------  |
|  [HardDrive] Google Drive              [>] |
|  ----------------------------------------  |
|  [User] Account                        [>] |
|  ----------------------------------------  |
|                                            |
|  Still need help?                          |
|                                            |
|  [ Report a problem ]                      |
|  [ Replay the tour  ]                      |
|                                            |
+--------------------------------------------+
```

- Max width 640-680px, centered (matches editor content width)
- "Help" heading: 30px Lora, `#171717`
- Section headings: 20px Lora with section icon
- FAQ rows: 48px min-height, `1px #E5E7EB` borders
- Multiple sections can be open simultaneously
- Deep linking via URL hash (`/help#exporting`)
- Static content, no API calls, instant render

---

## 6. Interaction Patterns

### Navigation Model

Three entry points to help, all within 2-tap maximum:

| Entry Point      | Location                                    | Taps from Editor | Element                                                    |
| ---------------- | ------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Header `?` icon  | Protected layout header, left of UserButton | **1 tap**        | `HelpCircle` icon, 44px touch target, navigates to `/help` |
| Settings menu    | "Help & Support" item in SettingsMenu       | **2 taps**       | Text menu item, navigates to `/help`                       |
| Dashboard footer | "Help" text link below project cards        | **1 tap**        | `text-sm text-gray-400`, navigates to `/help`              |

**No floating help button.** Conflicts with the floating action bar, would be the only FAB in the app, and risks overlapping the iPad home indicator.

**Feedback Sheet access:** From the Help page, tap "Report a problem" (2-3 taps total). If testing shows this is too many, promote "Send Feedback" to a direct Settings Menu item.

### User Flows

**Flow: "I found a bug"**
`?` icon -> `/help` -> scroll to "Still need help?" -> "Report a problem" -> Feedback Sheet slides up -> select "Something broke" -> type description -> "Send" -> toast confirmation

**Flow: "I have a suggestion"**
`?` icon -> `/help` -> "Report a problem" -> Feedback Sheet -> select "I have an idea" -> type suggestion -> "Send" -> toast

**Flow: "I'm confused"**
`?` icon -> `/help` -> scan section headers -> tap "Exporting" -> chevron rotates, section expands -> read 1-sentence answer -> back to editor

**Flow: "First time using the app"**
Project created -> editor loads -> 800ms delay -> backdrop fades in -> Step 1 tooltip fades in -> "Next" -> cross-fade to Step 2 -> ... -> Step 4 "Done" -> backdrop fades out -> localStorage marks complete

**Flow: "Replay the tour"**
`?` icon -> `/help` -> "Replay the tour" -> localStorage cleared -> navigate to editor -> tooltips trigger from Step 1

### Feedback Form Fields

| Field       | Type                                        | Required | Validation         |
| ----------- | ------------------------------------------- | -------- | ------------------ |
| Type        | Radio: "Something broke" / "I have an idea" | Yes      | Must select one    |
| Description | Textarea                                    | Yes      | 10-2000 chars      |
| Screenshot  | File (image/\*)                             | Deferred | See Open Decisions |

Auto-attached context (not user-editable): userAgent, viewport, devicePixelRatio, keyboard status, touch support, online status, current route, projectId, chapterId, drive connection, app version, recent errors (last 5), submission timestamp.

### Accordion Behavior

- Multiple sections can be open simultaneously (not mutually exclusive)
- `grid-template-rows: 0fr` to `1fr` transition (200ms ease-out) for smooth expand/collapse
- Chevron rotation: 180deg, 150ms ease-out
- Keyboard: Enter/Space toggle, Arrow Up/Down between headers, Home/End
- Deep link: hash in URL auto-expands corresponding section on load

### Animation Summary

| Animation               | Duration      | Easing             | Reduced Motion    |
| ----------------------- | ------------- | ------------------ | ----------------- |
| Feedback sheet entrance | 300ms         | ease-out           | Instant           |
| Feedback sheet exit     | 200ms         | ease-in            | Instant           |
| Feedback success        | 200ms         | ease-out           | Instant           |
| Tooltip entrance        | 200ms         | ease-out           | Instant           |
| Tooltip exit            | 150ms         | ease-in            | Instant           |
| Tooltip step transition | 150ms + 150ms | ease-in / ease-out | Instant crossfade |
| Backdrop fade           | 200ms         | ease-out / ease-in | Instant           |
| Accordion expand        | 200ms         | ease-out           | Instant           |
| Accordion collapse      | 150ms         | ease-in            | Instant           |
| Chevron rotation        | 150ms         | ease-out           | Instant rotation  |
| Step dot transition     | 200ms         | ease-out           | Instant           |

All respect `prefers-reduced-motion: reduce`.

---

## 7. Component System Direction

### New Components

| Component               | Purpose                                   | ARIA Pattern                                       | Status |
| ----------------------- | ----------------------------------------- | -------------------------------------------------- | ------ |
| `FeedbackSheet`         | Bottom/side sheet for feedback submission | `role="dialog"`, `aria-modal="true"`, focus trap   | New    |
| `FeedbackTypeSelector`  | Bug/suggestion toggle                     | `role="radiogroup"` with `role="radio"`            | New    |
| `FeedbackForm`          | Description textarea and submit           | Native `<form>`, `aria-describedby`                | New    |
| `FeedbackSuccessState`  | Post-submission confirmation              | `role="status"`, `aria-live="polite"`              | New    |
| `HelpPage`              | `/help` route page                        | `role="main"`, landmarks                           | New    |
| `AccordionGroup`        | Manages FAQ sections                      | Delegates to items                                 | New    |
| `AccordionItem`         | Single collapsible section                | `button[aria-expanded]`, `region[aria-labelledby]` | New    |
| `OnboardingTooltipCard` | Redesigned tooltip card with arrow        | `role="dialog"`, step-aware `aria-label`           | New    |
| `OnboardingBackdrop`    | Spotlight backdrop with SVG mask cutout   | `aria-hidden="true"`                               | New    |
| `OnboardingStepDots`    | Animated progress dots                    | `aria-hidden="true"`                               | New    |
| `ContextCollector`      | Auto-gathers browser/app context          | Headless hook, no DOM                              | New    |

### Existing Components to Update

| Component            | Update                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `OnboardingTooltips` | Full visual redesign. New card, animations, pointer arrow. Expose `resetOnboarding()` for tour replay. |
| `SettingsMenu`       | Add "Help & Support" menu item linking to `/help`.                                                     |
| `Toast`              | No code changes. Reuse for feedback confirmation.                                                      |

### File Locations

| Component            | Path                                                |
| -------------------- | --------------------------------------------------- |
| Feedback components  | `web/src/components/feedback/`                      |
| Help page components | `web/src/components/help/`                          |
| Help page route      | `web/src/app/(protected)/help/page.tsx`             |
| Onboarding (updated) | `web/src/components/editor/onboarding-tooltips.tsx` |
| Context hook         | `web/src/hooks/use-feedback-context.ts`             |
| Error store          | `web/src/lib/error-store.ts`                        |

---

## 8. Technical Constraints

### D1 Schema

```sql
-- Migration: 0025_create_feedback.sql
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,                -- ULID
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('bug', 'suggestion')),
  description TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triaged', 'github_issue_created', 'resolved', 'closed')),
  github_issue_number INTEGER,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_feedback_created_at ON feedback(created_at);
```

Design decisions:

- Single table for bugs and suggestions (discriminated by `type`)
- Context stored as JSON blob (write-once, never queried by field)
- `github_issue_number` optional - not auto-created on submission
- No screenshot storage initially (auto-context is more actionable)
- Status column supports future admin dashboard

### API Routes

| Method | Path        | Purpose                                         | Rate Limit |
| ------ | ----------- | ----------------------------------------------- | ---------- |
| `POST` | `/feedback` | Submit feedback (201 response)                  | 5 req/min  |
| `GET`  | `/feedback` | List user's own submissions (cursor pagination) | Standard   |

Validation: type required (`bug`/`suggestion`), description required (10-2000 chars).

### Performance Budget

| Component              | Size (gzipped) | Loading Strategy                      |
| ---------------------- | -------------- | ------------------------------------- |
| Feedback Sheet + Form  | ~4-5 KB        | `React.lazy`, modulepreload on hover  |
| Help Page + Accordion  | ~3-4 KB        | Route-level split (Next.js automatic) |
| Onboarding Tooltips    | ~3-4 KB        | In existing editor bundle             |
| Context collector hook | ~1 KB          | Bundled with Feedback Sheet           |
| **Total**              | **~11-14 KB**  | Not in critical path                  |

No new fonts. No new npm dependencies.

### Accessibility

- **Focus management:** Focus trap in Feedback Sheet. Initial focus on textarea. Focus restoration on close. Escape to dismiss. Body scroll lock.
- **Accordion keyboard:** Full WAI-ARIA Accordion pattern (Enter/Space, Arrow keys, Home/End).
- **Onboarding ARIA:** `role="dialog"` with step-aware `aria-label`. Dots and backdrop `aria-hidden`. `aria-live="polite"`.
- **Screen reader:** Feedback events announced at every lifecycle point.
- **Reduced motion:** All animations have static-state alternatives.
- **Touch targets:** 44px minimum throughout.

---

## 9. Inspiration & Anti-Inspiration

### Inspiration

| Product                        | What to Take                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Linear** (docs)              | Minimal help that matches the product aesthetic. Same fonts, spacing, palette. No separate "support" look. |
| **Notion** (onboarding)        | White card tooltip, subtle shadow, pointer arrow, progress indicator. Brief conversational text.           |
| **Superhuman** (bug reporting) | Single text field with automatic context capture. Brief honest confirmation. No ticket numbers.            |
| **Apple Notes**                | Essentially no help because the app is self-explanatory. When help exists, it uses native patterns.        |
| **Basecamp** (support tone)    | Human without being cute. "Here's what to do" not "We understand how frustrating this must be."            |

### Anti-Inspiration

| Product                    | What to Avoid                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| **Intercom / Zendesk**     | Floating chat bubble. Bounces. Auto-opens. No floating widget in DraftCrane.                      |
| **Grammarly** (onboarding) | Multi-screen tutorial, gamification, persistent nudges. DraftCrane: 4 steps max, no gamification. |
| **Jira** (issue creation)  | Required fields everywhere. DraftCrane: exactly two user inputs (type toggle + text field).       |

---

## 10. Design Asks

| #   | Ask                                   | Priority | Description                                                                                                     | Origin                                    |
| --- | ------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | **Redesign onboarding tooltip card**  | P0       | New shadow, pointer arrow, entrance/exit animations, step label, animated dots. Fixes the "amateur" impression. | Brand Strategist, Target User             |
| 2   | **Build Feedback Sheet component**    | P0       | Bottom sheet (portrait) / side sheet (landscape) with type toggle, textarea, auto-context, submit flow.         | Interaction Designer, Design Technologist |
| 3   | **Build Help page at /help**          | P0       | Protected route, Lora heading, 6 collapsible FAQ sections, "Report a problem" link, "Replay tour" trigger.      | Interaction Designer                      |
| 4   | **Add Help entry points**             | P0       | `?` icon in header (1 tap), "Help & Support" in Settings menu (2 taps), "Help" footer on dashboard.             | Interaction Designer                      |
| 5   | **Create feedback D1 table and API**  | P1       | Migration, `POST /feedback` with validation and rate limiting, `GET /feedback` for user's submissions.          | Design Technologist                       |
| 6   | **Implement auto-context collection** | P1       | `useFeedbackContext` hook (14 fields). Global error store capturing last 5 client errors.                       | Design Technologist                       |
| 7   | **Build Accordion components**        | P1       | WAI-ARIA pattern, `grid-template-rows` animation, keyboard nav, URL hash deep linking.                          | Design Technologist                       |
| 8   | **Add design tokens and animations**  | P1       | Extend globals.css with feedback, onboarding, help tokens. New keyframes with reduced-motion overrides.         | Design Technologist                       |
| 9   | **Write FAQ placeholder content**     | P2       | 6 sections, ~20 Q&A pairs. Short direct answers. Defer final copy until dev stabilizes.                         | Brand Strategist                          |
| 10  | **Voice & tone guide for help copy**  | P2       | Copy direction for tooltips, feedback form, FAQ. Example/anti-example tables.                                   | Brand Strategist                          |

---

## 11. Open Design Decisions

### 1. Feedback Sheet: Bottom Sheet vs. Centered Dialog (Landscape)

**Options:** Side sheet from right (matches Library panel) vs. centered dialog (simpler)
**Recommendation:** Side sheet in landscape, bottom sheet in portrait. Simplify to dialog only if responsive logic is burdensome.

### 2. "AI Features" Section Naming

**Issue:** Target user reacted negatively. She thinks of AI rewrite as "the editing help," not an "AI Feature."
**Recommendation:** Use "Editing Help" - matches how the user thinks about it.

### 3. Screenshot Attachment

**Options:** Include (Interaction Designer) vs. defer (Design Technologist - auto-context is more actionable, avoids R2 complexity)
**Recommendation:** Defer. Ship without screenshots. Auto-context provides better diagnostic data. Add later if triage reveals a gap.

### 4. Feedback to GitHub Issue Automation

**Recommendation:** No auto-creation. Store in D1 with status tracking. Manual escalation when warranted.

---

_Synthesized from 4 contributions in `docs/design/contributions/round-1/`. PRD at `docs/pm/prd.md` is the source of truth for what to build. This brief defines how it should look and feel._
