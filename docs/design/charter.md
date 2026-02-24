# DraftCrane Design Charter

This charter governs design decisions for DraftCrane. It captures the principles, standards, conventions, and anti-patterns that engineers and designers must follow during implementation. When in doubt, consult this document first. When this document is silent, consult the design brief (`docs/design/brief.md`).

---

## 1. Design Principles

Ordered by priority. When two principles conflict, the higher-numbered principle yields.

**1. Writing Comes First.** The editor is the product. Every design decision must protect the writing surface. Panels slide in from edges, not from above. Toolbars are minimal. The center of the screen belongs to the author's words. In Chapter View, the Tiptap editor fills the center. In Book View, the manuscript-level view fills the center. The left (Editor panel) and right (Library panel) are supporting wings that the author opens when needed and closes when writing.

**2. Show the Work.** Authors need to feel that their book is a real, organized, progressing thing. Word counts, chapter counts, save indicators, "View in Drive" links -- these are not features. They are the emotional infrastructure that prevents overwhelm. Make the invisible visible.

**3. Respect the Surface.** iPad Safari is the primary target. Touch targets are generous (44px minimum, 48px for primary actions). Panels and sheets respect safe areas. No hover-dependent patterns. The product must feel designed for the device, not ported to it.

**4. Spatial Consistency.** The spatial model is fixed: Editor (left), Writing (center), Library (right). The author develops muscle memory for where to look. Left for editing help. Right for source material. Center for writing. This spatial contract must never break, regardless of view mode.

**5. Invisible Technology.** Drop "AI" from labels. Drop "sync" from indicators. "Rewrite" not "AI Rewrite." "Saved" not "Synced to Google Drive." "Editor" not "AI Assistant." The technology is plumbing; the action is what the author sees.

**6. Progressive Disclosure.** The product must be graspable in 10 seconds. First-time users see the writing surface and the chapter list. The Library panel, the Editor panel, Book View, instruction sets, export options -- these reveal as the author needs them. No feature announces itself before the author is ready.

**7. Nothing Precious.** No confirmation dialogs unless destruction is irreversible. No "Are you sure?" on closing panels. Undo handles mistakes. The author's flow state is more valuable than preventing a misclick. The only exceptions: chapter deletion and project deletion.

---

## 2. Decision-Making Process

**Design brief** (`docs/design/brief.md`) is the source of truth for visual direction, interaction patterns, and brand personality. All implementation must conform to it.

**PRD** (`docs/pm/prd.md`) is the source of truth for what to build -- feature scope, user stories, and acceptance criteria.

When a question arises:

1. **Check the brief and PRD first.** If the answer is specified, follow it.
2. **Open design decisions** listed in the brief (Section 11) require founder/captain approval before implementation. Do not resolve them independently.
3. **Design changes that affect the brief** require updating the brief first. The brief is a living document, but changes flow through it, not around it.
4. **Significant technical design decisions** (layout strategy, state management patterns, new dependency adoption) require an ADR in `docs/adr/`.
5. **Component-level decisions** (prop interfaces, ARIA patterns, animation details) can be resolved by the implementing engineer, provided they conform to this charter.

---

## 3. Token Naming Conventions

All CSS custom properties use the `--dc-` venture prefix to prevent collisions with third-party libraries. Tokens follow this pattern:

```
--dc-{category}-{property}-{variant}
```

### Categories

| Category      | Prefix          | Example                      |
| ------------- | --------------- | ---------------------------- |
| Color         | `--dc-color-`   | `--dc-color-surface-primary` |
| Spacing       | `--dc-spacing-` | `--dc-spacing-4`             |
| Typography    | `--dc-type-`    | `--dc-type-size-base`        |
| Border radius | `--dc-radius-`  | `--dc-radius-md`             |
| Shadow        | `--dc-shadow-`  | `--dc-shadow-panel`          |
| Motion        | `--dc-motion-`  | `--dc-motion-slow`           |
| Z-index       | `--dc-z-`       | `--dc-z-overlay`             |
| Layout        | `--dc-`         | `--dc-panel-width`           |

### Examples

```css
:root {
  /* Color */
  --dc-color-surface-primary: #ffffff;
  --dc-color-text-muted: #6b7280;
  --dc-color-interactive-primary: #2563eb;
  --dc-color-status-error: #dc2626;

  /* Spacing (4px base unit) */
  --dc-spacing-1: 4px;
  --dc-spacing-4: 16px;
  --dc-spacing-12: 48px;

  /* Typography */
  --dc-type-family-sans: var(--font-geist-sans), system-ui, sans-serif;
  --dc-type-family-serif: var(--font-lora), Georgia, serif;
  --dc-type-size-lg: 1.125rem;
  --dc-type-weight-semibold: 600;

  /* Radius */
  --dc-radius-md: 8px;

  /* Shadow */
  --dc-shadow-panel: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 16px rgba(0, 0, 0, 0.08);

  /* Motion */
  --dc-motion-slow: 200ms;
  --dc-motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  /* Z-index */
  --dc-z-panel: 20;
  --dc-z-overlay: 50;

  /* Layout */
  --dc-panel-width: 320px;
  --dc-sidebar-width: 260px;
  --dc-toolbar-height: 48px;
}
```

### Tailwind Integration

Tokens are exposed to Tailwind via `@theme inline` in `globals.css`, enabling classes like `bg-dc-primary`, `text-dc-text-muted`, `border-dc-border`. The token source of truth is always the CSS custom property. Tailwind aliases reference the token, never duplicate the value.

The full token architecture is defined in the design technologist contribution (`docs/design/contributions/round-1/design-technologist.md`).

---

## 4. Component Contribution Guidelines

### File Location

- Application components: `web/src/components/`
- UI primitives (buttons, inputs, shared patterns): `web/src/components/ui/`

### Naming

- PascalCase for component files and exports: `EditorPanel.tsx`, `WorkspaceToggle.tsx`
- TypeScript interfaces for all props, exported from the component file

### Requirements

Every component must:

1. **Specify its ARIA role/pattern.** Declare the ARIA role in the component's JSDoc or a comment at the top of the file. Reference the WAI-ARIA Authoring Practices for the correct pattern.
2. **Work on iPad Safari.** This is the primary test target. Test touch interactions, safe area handling, and virtual keyboard behavior.
3. **Meet touch target minimums.** 44px minimum for all interactive elements. 48px preferred for primary actions.
4. **Avoid hover-only interactions.** Every hover state must have a touch-accessible equivalent. Hover may enhance but never gate functionality.
5. **Use design tokens.** Reference `--dc-*` tokens for colors, spacing, radii, shadows, and motion. Do not hardcode hex values or pixel dimensions that have a token equivalent.
6. **Support reduced motion.** Any animation must have a `prefers-reduced-motion` override that disables or replaces it.

### Props Interface Example

```typescript
interface EditorPanelProps {
  /** Panel variant based on workspace mode */
  variant: "chapter" | "book";
  /** Whether the panel is open */
  isOpen: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Width in pixels (desktop only, resizable) */
  width?: number;
  /** Called when width changes via resize handle */
  onWidthChange?: (width: number) => void;
}
```

---

## 5. Accessibility Standards

### Target

WCAG 2.1 AA compliance.

### Color Contrast

- All text/background pairings must pass **4.5:1** contrast ratio (normal text).
- Large text (18px+ regular, or 14px+ bold) must pass **3:1** contrast ratio.
- Placeholder text (`--dc-color-text-disabled`, 2.9:1) is intentionally below AA for normal text. For small placeholders, use `--dc-color-text-muted` (5.0:1) instead.
- No information conveyed by color alone. Always pair color with text, icons, or patterns.

### Focus Management

- **Visible focus rings** on all interactive elements. Use `--dc-color-border-focus` (`#3b82f6`).
- **Focus trap** for modal overlays (mobile panel overlays, dialogs). Inline persistent panels do NOT trap focus.
- **Focus restoration** when a panel or dialog closes -- focus returns to the triggering element.
- **Skip link** to the writing area: `<a href="#editor-content">Skip to writing area</a>`, visible only on keyboard focus.

### Keyboard Navigation

All interactive elements must be keyboard accessible:

- `Escape` closes panels and dialogs.
- `Arrow Left/Right` navigates within tab bars and radio groups.
- `Arrow Up/Down` navigates within lists (chapter sidebar, instruction picker).
- `Enter` activates the focused element.
- `Tab/Shift+Tab` cycles within focus-trapped overlays.
- Keyboard shortcuts: `Cmd+Shift+E` (Editor panel), `Cmd+Shift+L` (Library panel), `Cmd+Shift+B` (Book/Chapter toggle).

### Reduced Motion

All animations must respect `prefers-reduced-motion: reduce`. The override pattern:

```css
@media (prefers-reduced-motion: reduce) {
  .editor-panel-slide-in,
  .editor-panel-slide-out,
  .workspace-crossfade {
    animation: none;
  }
}
```

Every new `@keyframes` definition in `globals.css` must have a corresponding reduced-motion override.

### Screen Reader Announcements

Use `aria-live="polite"` regions for dynamic content updates:

- Panel open/close: "Editor panel opened" / "Library panel closed"
- AI streaming start: `aria-busy="true"`, announce "Rewriting..."
- AI streaming complete: `aria-busy="false"`, announce "Rewrite complete. {n} words."
- Workspace mode change: "Switched to Book View" / "Switched to Chapter View"
- Save status and toast notifications are already implemented with live regions.

---

## 6. Visual Language Summary

### Spatial Model

```
+----------+-----------------------------------+-------------------+
|          |                                   |                   |
| Editor   |  Center Writing Area              | Library Panel     |
| Panel    |  (author's words)                 | (source material) |
| (left)   |                                   | (right)           |
|          |                                   |                   |
+----------+-----------------------------------+-------------------+
```

- **Editor panel** (left, 320px, on demand): Writing assistance, rewrite interface.
- **Center** (flexible, min 400px): The writing surface. Never collapses below 400px.
- **Library panel** (right, 320px, on demand): Source documents, tagged desk.
- **Sidebar** (260px): Chapter navigation, word counts, reorder.

### Color Code

| Zone             | Color   | Token Prefix                        |
| ---------------- | ------- | ----------------------------------- |
| Library (right)  | Blue    | `--dc-color-interactive-primary`    |
| Editor (left)    | Violet  | `--dc-color-interactive-escalation` |
| Center (writing) | Neutral | `--dc-color-surface-primary`        |

### Typography

| Role  | Font       | Usage                                                                                |
| ----- | ---------- | ------------------------------------------------------------------------------------ |
| Sans  | Geist Sans | UI text, toolbar, sidebar, buttons, panels, editor body                              |
| Serif | Lora       | Headlines, book titles, chapter titles (displayed prominently), landing page, export |
| Mono  | Geist Mono | Tabular word counts, numeric displays                                                |

**Rules:**

- Serif for titles and author-facing headings. Sans for interface and editor body.
- Never mix serif and sans in the same text block.
- Tabular figures (`font-variant-numeric: tabular-nums`) for all numeric displays.
- Maximum editor content width: 680px.

### Iconography

- **Library:** Lucide Icons (`lucide-react`), MIT licensed.
- **Grid:** 24px viewBox, 2px stroke weight.
- **Style:** Outline only. No filled icons, no illustrations, no photography.
- Typography and whitespace are the visual identity.

### Animation Timing

| Category             | Duration          | Usage                                |
| -------------------- | ----------------- | ------------------------------------ |
| Micro-interactions   | 100-150ms         | Button press, checkbox, tooltip      |
| Panel slide          | 200ms ease-out    | Editor/Library panel open/close      |
| Workspace transition | 300ms ease-in-out | Chapter/Book mode crossfade          |
| Maximum              | 300ms             | Nothing in the product exceeds 300ms |

Entrances decelerate (`ease-out`). Exits accelerate (`ease-in`). State changes use symmetric easing (`ease-in-out`).

---

## 7. Anti-Patterns

Things we do not do. If you find yourself reaching for one of these, stop and reconsider.

| Anti-Pattern                                     | Reason                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Hover-dependent interactions                     | iPad-first. Every hover state must have a touch equivalent.                                                                      |
| "AI" in user-facing labels                       | Invisible Technology principle. Say "Rewrite," "Editor," "Summarize."                                                            |
| Jargon in the interface                          | No "workflow," "pipeline," "sync," "model," "tier." The author does not care about the mechanism.                                |
| Confirmation dialogs for non-destructive actions | Nothing Precious principle. Use undo instead. Only confirm chapter deletion and project deletion.                                |
| Animations over 300ms                            | Animations communicate spatial relationships, not delight. Keep them fast.                                                       |
| `100vh`                                          | Use `100dvh`. The `vh` unit does not account for mobile browser chrome or virtual keyboards.                                     |
| Center area below 400px                          | The writing surface must remain usable. If panels would compress it below 400px, the second panel renders as an overlay instead. |
| Hardcoded hex values                             | Use `--dc-*` tokens. Hardcoded values drift from the system and block dark mode.                                                 |
| `!important` in CSS                              | Never. Restructure the selector instead.                                                                                         |
| Decorative animation                             | Every animation must communicate a spatial relationship or state change. No animation for its own sake.                          |
| "Generate" buttons or template libraries         | The author writes. The product assists. Never position the AI as the author.                                                     |
| Desktop-first patterns ported to iPad            | Design for touch first. Desktop gets progressive enhancements (resize handles, keyboard shortcuts, dual panels).                 |
| Floating help widgets                            | No Intercom-style chat bubbles. Help lives in header icon and settings menu, not floating over content.                          |
| Category dropdowns on feedback forms             | Users do not know if their problem is a "UI Bug" or "Performance Issue." Simple toggle: "Something broke" / "I have an idea."    |
| Help page in a new tab                           | Never navigate away from the app for help. Help page is an in-app route (`/help`).                                               |
| Community forums as support                      | No "Ask the community" deflection. Feedback goes to the team.                                                                    |
| Playful or cute tooltip copy                     | Onboarding tooltips are professional and calm. No mascots, no gamification, no Duolingo energy.                                  |

---

## 8. Help & Support Design Standards

Standards specific to the Help & Support system (feedback, onboarding tooltips, help page). These supplement the general charter above.

### Voice & Tone

| Surface        | Register                      | Example                                        | Anti-Example                                          |
| -------------- | ----------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Tooltip copy   | Brief, spatial, instructional | "This is your chapter. Start writing here."    | "Welcome to DraftCrane's powerful editor!"            |
| Feedback form  | Calm, reassuring              | "Describe what happened."                      | "Provide a detailed description of the issue."        |
| FAQ answers    | Direct, one sentence          | "Tap Export in the toolbar to download a PDF." | "DraftCrane supports exporting via our PDF pipeline." |
| Confirmations  | Honest, brief                 | "Sent. We read every report."                  | "Your feedback is important to us!"                   |
| Error messages | Calm, actionable              | "Something went wrong. Please try again."      | "Error: Request failed with status 500."              |

### Vocabulary

| Use              | Do Not Use      |
| ---------------- | --------------- |
| Your chapter     | The document    |
| Report a problem | Submit a ticket |
| Editing help     | AI features     |
| Your book        | Your project    |
| Save             | Sync            |

### Component Architecture

| Component Group       | Location                                            | Notes                                       |
| --------------------- | --------------------------------------------------- | ------------------------------------------- |
| Feedback components   | `web/src/components/feedback/`                      | Sheet, form, type selector, success state   |
| Help page components  | `web/src/components/help/`                          | Page, accordion group, accordion item       |
| Onboarding (existing) | `web/src/components/editor/onboarding-tooltips.tsx` | Visual redesign, expose `resetOnboarding()` |
| Context hook          | `web/src/hooks/use-feedback-context.ts`             | Auto-captures 14 diagnostic fields          |
| Error store           | `web/src/lib/error-store.ts`                        | Ring buffer of last 5 client errors         |

### Navigation Contract

| Entry Point      | Location                | Taps from Editor  |
| ---------------- | ----------------------- | ----------------- |
| Header `?` icon  | Protected layout header | 1 tap to `/help`  |
| Settings menu    | "Help & Support" item   | 2 taps to `/help` |
| Dashboard footer | "Help" text link        | 1 tap to `/help`  |

No floating help button. No chat widget. No third-party support tools.
