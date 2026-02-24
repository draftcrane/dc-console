# Brand Strategist Contribution - Design Brief Round 1

**Author:** Brand Strategist
**Date:** 2026-02-24
**Design Maturity:** Tokens defined
**Scope:** Help & Support System (in-app feedback, onboarding tooltips redesign, /help page)

---

## Brand Personality

The Help & Support system is the most emotionally charged surface in DraftCrane. When a user reaches for help, they are already experiencing friction -- something broke, something confused them, or they cannot find what they need. The brand personality must do double duty here: resolve the friction while reinforcing the product's core promise that this tool respects the author's intelligence and time.

### How the Established Traits Apply to Help & Support

DraftCrane's five personality traits -- Quiet Confidence, Literate, Trustworthy, Purposeful, Author-Centric -- were defined in the workspace design brief. They carry forward unchanged. What changes is the emotional register. In the editor, the brand is invisible. In Help & Support, the brand speaks directly.

**1. Quiet Confidence in support contexts** means the product does not panic when something goes wrong. Error messages are calm. The feedback form does not ask the user to do diagnostic work. The help page does not over-explain. The product handles complexity behind the scenes (auto-attaching browser info, project state, recent errors) so the author can describe the problem in their own words.

**This, not that:** "We got your report and will look into it" -- not "Error code 0x4F2A has been logged. Our team has been notified. Reference ticket #38291." No ticket numbers, no error codes, no system language.

**2. Literate in support contexts** means the copy reads like it was written by a person, not generated from a template library. FAQ answers are direct and conversational. Tooltip text is precise -- every word earns its place. The help page does not use bullet-point walls or corporate support-desk language.

**This, not that:** "Your chapters are saved to your Google Drive automatically. If you see 'Saved,' the file is current." -- not "DraftCrane leverages Google Drive's API to provide real-time synchronization of your manuscript data."

**3. Trustworthy in support contexts** means the product acknowledges problems honestly and tells the user what happens next. When a bug report is submitted, the confirmation tells them exactly where the report went and what to expect. No false promises ("We'll fix this immediately!"), no vague platitudes ("Your feedback is important to us."). Just honest, direct communication.

**This, not that:** "Sent. We read every report." -- not "Thank you for your valuable feedback! Our dedicated support team will review your submission and get back to you as soon as possible."

**4. Purposeful in support contexts** means no feature theater. The help page is lean because the product should be self-explanatory. The FAQ exists as a safety net, not as a feature showcase. The onboarding tour exists because first impressions matter, not because we need to demonstrate how much the product can do. If the tour has to explain more than four concepts, the product's UI has failed.

**This, not that:** A help page with six focused FAQ sections -- not a searchable knowledge base with 200 articles, a chatbot, a community forum link, and a "What's New" section.

**5. Author-Centric in support contexts** means the language stays in the author's world. "Your chapter" not "the document." "Your book" not "your project." "Report a problem" not "Submit a ticket." The feedback form asks "What happened?" not "Describe the issue." The help page answers questions the author would actually ask, not questions organized by engineering subsystem.

**This, not that:** FAQ section titled "Writing & Editing" -- not "Editor Features." "Exporting" -- not "Export Pipeline."

---

## Design Principles

These are the existing seven principles, re-examined through the lens of help and support. No new principles are added -- the existing hierarchy applies directly.

### 1. Writing Comes First

The help and support system must never interrupt the writing flow unless the author explicitly asks for it. The feedback button lives in the settings menu or help page, not in the toolbar. Onboarding tooltips appear on first project creation only, and dismiss permanently after completion. The help page is a separate route (`/help`), not an overlay on the editor.

**Tradeoff example:** An always-visible "?" floating button would make help more discoverable but would compete for the writing surface. Writing wins. Help is reachable from the settings menu (one tap) and the help page (one navigation).

### 2. Show the Work

When the author submits feedback, the confirmation shows them that context was automatically captured -- "We included your browser info and recent activity so you don't have to describe your setup." This transparency builds trust without requiring effort. The onboarding tour shows progress (step 2 of 4) so the author knows how much remains.

**Tradeoff example:** Auto-capturing project state and error logs is invisible by default. Showing a summary of what was captured ("Browser: Safari on iPad, Chapter: 3, Recent errors: none") is more transparent. Showing the work wins, but the summary must be collapsible -- the author should not be forced to read it.

### 3. Respect the Surface

Every interactive element in the help system -- FAQ collapsible sections, feedback form fields, onboarding tooltip buttons -- must meet the 44px minimum touch target. The feedback form must be usable with the iPad virtual keyboard active. The help page must be scrollable with touch. Onboarding tooltips must not obscure critical UI on portrait iPad.

### 4. Spatial Consistency

The onboarding tour points at elements in their correct spatial positions. The tooltip for the sidebar appears near the sidebar. The tooltip for the library appears near the right edge. This reinforces the spatial model from the first interaction. The help page and feedback form exist outside the editor spatial model -- they are standalone surfaces.

### 5. Invisible Technology

The feedback form never asks the author to identify what browser they use, what device they are on, or what error code they saw. All of this is captured automatically and silently. The distinction between "bug report" and "feature request" is made through a simple toggle ("Something broke" / "I have an idea"), not through separate forms or technical categorization.

### 6. Progressive Disclosure

The onboarding tour is the purest expression of this principle. Four steps. No more. Each step reveals one concept. The author can skip at any time. The tour only triggers on first project creation -- returning users never see it. The help page uses collapsible sections -- the author sees six section titles and expands only what they need. The feedback form starts with a single text field; optional details expand on request.

### 7. Nothing Precious

Skip the onboarding tour? Fine. Dismiss a tooltip? It does not come back with "Are you sure?" Close the feedback form mid-typing? The text is lost, but the form was one field -- re-typing is trivial. No confirmation dialogs in the help system. The only exception: if the author has typed a substantive message (50+ characters) in the feedback form and taps outside, a lightweight "Discard draft?" confirmation is warranted.

---

## Color System

The established color system applies without modification to the help and support surfaces. No new hues are introduced. The help system uses the existing neutral palette plus semantic colors for feedback states.

### Colors in Context: Help & Support Surfaces

#### Onboarding Tooltips

| Element                   | Token                            | Hex                  | Contrast             | Notes                                                                                         |
| ------------------------- | -------------------------------- | -------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| Tooltip background        | `--dc-color-surface-primary`     | `#FFFFFF`            | --                   | White card on semi-transparent backdrop                                                       |
| Tooltip text              | `--dc-color-text-secondary`      | `#374151`            | 10.7:1 vs white      | Body text in tooltip. Not foreground (#171717) -- slightly softer for a coaching tone         |
| Step indicator (active)   | `--dc-color-interactive-primary` | `#2563EB`            | 4.6:1 vs white       | Active dot/bar                                                                                |
| Step indicator (inactive) | `--dc-color-border`              | `#E5E7EB`            | --                   | Inactive dots                                                                                 |
| "Next" button background  | `--dc-color-foreground`          | `#171717`            | 17.4:1 vs white text | Primary action. Matches existing dark button pattern in empty-state and crash-recovery-dialog |
| "Next" button text        | `--dc-color-surface-primary`     | `#FFFFFF`            | 17.4:1 vs #171717    | White on dark                                                                                 |
| "Skip" text               | `--dc-color-text-muted`          | `#6B7280`            | 5.0:1 vs white       | De-emphasized secondary action                                                                |
| Backdrop                  | --                               | `rgba(0, 0, 0, 0.2)` | --                   | Semi-transparent overlay. Same value as existing onboarding implementation                    |
| Tooltip border/ring       | `--dc-color-border`              | `#E5E7EB`            | --                   | Subtle ring for definition against white backgrounds                                          |
| Tooltip shadow            | `--dc-shadow-panel`              | See charter          | --                   | Elevated card shadow matching panel convention                                                |

**Design note:** The current onboarding tooltips use `bg-gray-900` for the Next button and `text-gray-700` for body text. These map directly to the token system. The visual problem is not color -- it is spacing, radius, animation, and typographic hierarchy. The color choices are already correct.

#### Feedback/Issue Reporting Form

| Element                                    | Token                                   | Hex       | Contrast             | Notes                                                |
| ------------------------------------------ | --------------------------------------- | --------- | -------------------- | ---------------------------------------------------- |
| Form background                            | `--dc-color-surface-primary`            | `#FFFFFF` | --                   | Clean white surface                                  |
| Form heading                               | `--dc-color-foreground`                 | `#171717` | 17.4:1 vs white      | "Report a Problem" or "Share an Idea"                |
| Body/instruction text                      | `--dc-color-text-secondary`             | `#374151` | 10.7:1 vs white      | Descriptive text below heading                       |
| Input field background                     | `--dc-color-surface-primary`            | `#FFFFFF` | --                   | White input                                          |
| Input field border (default)               | `--dc-color-border-strong`              | `#D1D5DB` | --                   | Gray-300 for visible border                          |
| Input field border (focus)                 | `--dc-color-interactive-primary`        | `#2563EB` | --                   | Blue focus ring, consistent with editor inputs       |
| Input placeholder                          | `--dc-color-text-placeholder`           | `#9CA3AF` | 2.9:1 vs white       | Below AA for normal text, acceptable for placeholder |
| Input text                                 | `--dc-color-foreground`                 | `#171717` | 17.4:1 vs white      | User-entered text                                    |
| Type toggle: "Something broke" (active)    | `--dc-color-status-error`               | `#DC2626` | 4.5:1 vs white       | Red tint when bug report is selected                 |
| Type toggle: "Something broke" (active bg) | `--dc-color-error-bg`                   | `#FEF2F2` | --                   | Light red background                                 |
| Type toggle: "I have an idea" (active)     | `--dc-color-interactive-primary`        | `#2563EB` | 4.6:1 vs white       | Blue tint for feature request                        |
| Type toggle: "I have an idea" (active bg)  | `--dc-color-interactive-primary-subtle` | `#EFF6FF` | --                   | Light blue background                                |
| Submit button                              | `--dc-color-foreground`                 | `#171717` | 17.4:1 vs white text | Dark primary button                                  |
| Submit button text                         | `--dc-color-surface-primary`            | `#FFFFFF` | 17.4:1 vs #171717    | White on dark                                        |
| Cancel/close                               | `--dc-color-text-muted`                 | `#6B7280` | 5.0:1 vs white       | Secondary dismiss action                             |
| Success confirmation text                  | `--dc-color-status-success`             | `#059669` | 4.6:1 vs white       | "Sent. We read every report."                        |
| Success confirmation bg                    | `--dc-color-success-bg`                 | `#ECFDF5` | --                   | Light green background                               |
| Auto-captured context label                | `--dc-color-text-muted`                 | `#6B7280` | 5.0:1 vs white       | "Browser, chapter, and recent activity included"     |

#### Help Page (/help)

| Element                          | Token                            | Hex       | Contrast        | Notes                                            |
| -------------------------------- | -------------------------------- | --------- | --------------- | ------------------------------------------------ |
| Page background                  | `--dc-color-surface-primary`     | `#FFFFFF` | --              | Clean white                                      |
| Page heading                     | `--dc-color-foreground`          | `#171717` | 17.4:1 vs white | "Help" in Lora, large                            |
| Section heading                  | `--dc-color-foreground`          | `#171717` | 17.4:1 vs white | FAQ section titles                               |
| FAQ question text                | `--dc-color-text-secondary`      | `#374151` | 10.7:1 vs white | Collapsible row label                            |
| FAQ answer text                  | `--dc-color-text-secondary`      | `#374151` | 10.7:1 vs white | Expanded content                                 |
| FAQ section border               | `--dc-color-border`              | `#E5E7EB` | --              | Dividers between questions                       |
| FAQ chevron icon                 | `--dc-color-text-muted`          | `#6B7280` | 5.0:1 vs white  | Expand/collapse indicator                        |
| "Report a problem" link          | `--dc-color-interactive-primary` | `#2563EB` | 4.6:1 vs white  | Standalone link at bottom                        |
| "Replay tour" link               | `--dc-color-interactive-primary` | `#2563EB` | 4.6:1 vs white  | Resets localStorage and triggers tour            |
| Section background (alternating) | `--dc-color-surface-secondary`   | `#F9FAFB` | --              | Optional subtle alternation for section grouping |

---

## Typography

The established type system applies directly. No new type styles are introduced. Here is how the existing scale maps to help and support surfaces.

### Onboarding Tooltips

| Element                               | Size           | Weight | Line Height | Font       | Token Reference          |
| ------------------------------------- | -------------- | ------ | ----------- | ---------- | ------------------------ |
| Step text                             | 14px (Small)   | 400    | 1.5         | Geist Sans | `--dc-type-size-sm`      |
| Step indicator label (e.g., "2 of 4") | 12px (Caption) | 500    | 1.5         | Geist Sans | `--dc-type-size-caption` |
| "Next" / "Done" button                | 14px (Small)   | 500    | 1.5         | Geist Sans | `--dc-type-size-sm`      |
| "Skip" link                           | 14px (Small)   | 400    | 1.5         | Geist Sans | `--dc-type-size-sm`      |

**Design note:** The current implementation uses `text-sm` (14px) for body and buttons, which is correct. The text should not be smaller -- this is iPad-first, and 14px is already the practical minimum for comfortable reading on a held device. The "amateur" feel comes from spacing and shadow, not font sizing.

### Feedback Form

| Element                           | Size           | Weight | Line Height | Font       | Token Reference          |
| --------------------------------- | -------------- | ------ | ----------- | ---------- | ------------------------ |
| Form heading ("Report a Problem") | 20px (H3)      | 600    | 1.4         | Geist Sans | `--dc-type-size-h3`      |
| Instruction text                  | 14px (Small)   | 400    | 1.5         | Geist Sans | `--dc-type-size-sm`      |
| Type toggle labels                | 14px (Small)   | 500    | 1.5         | Geist Sans | `--dc-type-size-sm`      |
| Textarea input                    | 16px (Body)    | 400    | 1.6         | Geist Sans | `--dc-type-size-base`    |
| Auto-context label                | 12px (Caption) | 500    | 1.5         | Geist Sans | `--dc-type-size-caption` |
| Submit button                     | 14px (Small)   | 500    | 1.5         | Geist Sans | `--dc-type-size-sm`      |
| Success message                   | 14px (Small)   | 500    | 1.5         | Geist Sans | `--dc-type-size-sm`      |

**Why Geist Sans, not Lora, for the form heading:** The feedback form is a functional UI surface, not an author-facing content heading. Lora is reserved for book titles, chapter titles, and the landing page -- contexts where the author is engaging with their manuscript or the product's identity. A bug report form is chrome. Geist Sans keeps it in the UI register.

### Help Page

| Element                                  | Size         | Weight | Line Height | Font       | Token Reference       |
| ---------------------------------------- | ------------ | ------ | ----------- | ---------- | --------------------- |
| Page heading ("Help")                    | 30px (H1)    | 600    | 1.3         | Lora       | `--dc-type-size-h1`   |
| Section heading ("Getting Started")      | 20px (H3)    | 600    | 1.4         | Lora       | `--dc-type-size-h3`   |
| FAQ question                             | 16px (Body)  | 500    | 1.6         | Geist Sans | `--dc-type-size-base` |
| FAQ answer                               | 16px (Body)  | 400    | 1.6         | Geist Sans | `--dc-type-size-base` |
| "Report a problem" / "Replay tour" links | 14px (Small) | 500    | 1.5         | Geist Sans | `--dc-type-size-sm`   |

**Why Lora for the help page heading and section titles:** The help page is a standalone page, not a panel within the editor. It functions more like a content page (similar to the landing page) than a UI surface. Using Lora for the page title and section headings gives it the same weight and seriousness as other top-level pages while keeping the FAQ body content in the functional Geist Sans register.

---

## Spacing & Rhythm

The 4px base unit and existing spacing scale apply without modification. Here is how they map to specific help and support components.

### Onboarding Tooltip Card

| Property                | Value                               | Token                          |
| ----------------------- | ----------------------------------- | ------------------------------ |
| Card padding            | 20px (5 \* 4px)                     | `--dc-spacing-5`               |
| Card border radius      | 12px                                | `--dc-radius-lg`               |
| Step indicator dot gap  | 6px (1.5 \* 4px)                    | --                             |
| Step indicator to text  | 12px                                | `--dc-spacing-3`               |
| Text to buttons         | 16px                                | `--dc-spacing-4`               |
| Button height (minimum) | 44px                                | Touch target minimum           |
| Card width              | 288px (72 \* 4px, currently `w-72`) | --                             |
| Card max-width          | 320px                               | Constrained on small viewports |

### Feedback Form (Sheet/Dialog)

| Property                         | Value | Token                                      |
| -------------------------------- | ----- | ------------------------------------------ |
| Form padding                     | 24px  | `--dc-spacing-6`                           |
| Heading to instruction text      | 8px   | `--dc-spacing-2`                           |
| Instruction text to type toggle  | 16px  | `--dc-spacing-4`                           |
| Type toggle to textarea          | 16px  | `--dc-spacing-4`                           |
| Textarea height (minimum)        | 120px | Enough for 3-4 lines at 16px               |
| Textarea to context summary      | 12px  | `--dc-spacing-3`                           |
| Context summary to submit button | 24px  | `--dc-spacing-6`                           |
| Button height                    | 44px  | Touch target minimum                       |
| Form max-width                   | 480px | Comfortable reading width for form content |
| Form border radius               | 12px  | `--dc-radius-lg`                           |

### Help Page

| Property                          | Value                          | Token                                           |
| --------------------------------- | ------------------------------ | ----------------------------------------------- |
| Page horizontal padding           | 24px (mobile), 48px (desktop)  | `--dc-spacing-6` / `--dc-spacing-12`            |
| Page max-width                    | 680px                          | Matches editor content width for reading rhythm |
| Heading to first section          | 32px                           | `--dc-spacing-8`                                |
| Between FAQ sections              | 32px                           | `--dc-spacing-8`                                |
| Section heading to first question | 16px                           | `--dc-spacing-4`                                |
| FAQ question row height           | 48px minimum                   | Touch target                                    |
| FAQ question row padding          | 16px horizontal                | `--dc-spacing-4`                                |
| FAQ answer padding                | 16px horizontal, 12px vertical | `--dc-spacing-4` / `--dc-spacing-3`             |
| Between FAQ items (border)        | 1px                            | `--dc-color-border`                             |
| Footer links section top margin   | 48px                           | `--dc-spacing-12`                               |

---

## Imagery & Iconography

### Icons for Help & Support Surfaces

All icons from Lucide, consistent with the established 24px grid, 2px stroke weight, outline style.

| Action                            | Icon                        | Size                              | Notes                                                        |
| --------------------------------- | --------------------------- | --------------------------------- | ------------------------------------------------------------ |
| Help page link (in settings menu) | `HelpCircle`                | 16px (in menu), 20px (standalone) | Standard help icon. Outline circle with question mark.       |
| Report a problem (link/button)    | `MessageSquare`             | 16px (in menu), 20px (standalone) | Conversational, not ticket-like. Not `Bug` -- too technical. |
| Feature request indicator         | `Lightbulb`                 | 16px                              | Paired with "I have an idea" toggle state                    |
| Bug report indicator              | `AlertTriangle`             | 16px                              | Paired with "Something broke" toggle state                   |
| FAQ expand/collapse               | `ChevronDown` / `ChevronUp` | 20px                              | Standard disclosure chevron                                  |
| FAQ section: Getting Started      | `Rocket`                    | 20px                              | Forward momentum, not a tutorial icon                        |
| FAQ section: Writing & Editing    | `PenLine`                   | 20px                              | Consistent with Chapter View icon                            |
| FAQ section: AI Features          | `Sparkles`                  | 20px                              | Consistent with existing rewrite icon                        |
| FAQ section: Exporting            | `FileDown`                  | 20px                              | Consistent with existing export icon                         |
| FAQ section: Google Drive         | `HardDrive`                 | 20px                              | Storage, not the Google logo                                 |
| FAQ section: Account              | `User`                      | 20px                              | Standard account/profile icon                                |
| Onboarding tooltip close/skip     | None (text only)            | --                                | "Skip" as text, not an X icon. Less abrupt.                  |
| Tour replay trigger               | `RotateCcw`                 | 16px                              | Replay/redo metaphor                                         |
| Success checkmark (after submit)  | `Check`                     | 20px                              | Paired with success color. Same as save indicator.           |
| Auto-context indicator            | `Info`                      | 14px                              | Small, beside the context disclosure                         |

### No Illustrations

The help system uses no illustrations, mascots, or decorative imagery. The existing pattern -- icon + concise text for empty states -- applies to help surfaces. If the help page ever needs visual interest, it comes from typographic hierarchy and generous whitespace, not from drawings of people scratching their heads.

---

## Inspiration Board

Scoped to help, support, feedback, and onboarding patterns. These are products whose help systems match the tone DraftCrane should achieve.

### 1. Linear -- Help & Changelog

**URL:** [https://linear.app/docs](https://linear.app/docs)

**What to take:** Linear's documentation is minimal, direct, and assumes the user is competent. No "Welcome! We're so glad you're here!" warmth theater. Questions are answered in 2-3 sentences. The visual design matches the product exactly -- same fonts, same spacing, same neutral palette. The help content feels like part of the product, not a grafted-on support site.

**Specific takeaway for DraftCrane:** The FAQ page should feel indistinguishable from the rest of the app in visual quality. Same typography, same spacing rules, same button styles. No separate "support" aesthetic.

### 2. Notion -- Onboarding Tooltips

**URL:** [https://notion.so](https://notion.so)

**What to take:** Notion's onboarding for new workspaces is a lightweight tooltip sequence that points at real UI elements with minimal text. Each tooltip has one idea. The visual treatment is a white card with a subtle shadow, a small pointer arrow, and a progress indicator. The text is conversational but brief. Skip is always available.

**Specific takeaway for DraftCrane:** The tooltip card design -- white, elevated, pointed at its target with a small arrow/caret -- is the right pattern. The current DraftCrane tooltips float in approximate regions without pointing at anything specific. Adding a directional caret that connects the tooltip to its target element will eliminate the "amateur" feeling more than any other single change.

### 3. Superhuman -- Bug Reporting

**URL:** [https://superhuman.com](https://superhuman.com)

**What to take:** Superhuman's feedback flow is a single text field with automatic context capture. The user types what happened in their own words. Browser info, recent actions, and screenshot capability are handled automatically. The confirmation is brief and honest. No ticket numbers. No expectation-setting about response times.

**Specific takeaway for DraftCrane:** The feedback form should be one primary field ("What happened?" or "What's on your mind?") with the type toggle and context capture handled around it. Do not build a multi-step form. Do not ask for email (we already know who they are -- they are authenticated). Do not ask for screenshots (auto-context is more reliable on iPad than manual screenshots anyway).

### 4. Apple Notes -- In-App Help

**URL:** Built into iPadOS (not a URL, but the reference is the device's native patterns)

**What to take:** Apple Notes has essentially no in-app help, and it works because the app is self-explanatory. When Apple does provide help (in Settings, in first-run flows), it uses the system's own typography, colors, and layout patterns. There is no "help mode" that looks different from the app.

**Specific takeaway for DraftCrane:** The help page should be styled as a first-class page of the app, not as a support portal. Same background, same font stack, same spacing. The collapsible FAQ should use the same interaction patterns (touch targets, animation timing) as the rest of the app.

### 5. Basecamp -- Support Tone

**URL:** [https://basecamp.com/support](https://basecamp.com/support)

**What to take:** Basecamp's support writing is human without being cute. Direct without being cold. They acknowledge the author's frustration without performing empathy. "Here's what to do" not "We understand how frustrating this must be." The writing assumes the reader is an intelligent adult who just needs the specific answer.

**Specific takeaway for DraftCrane:** Every piece of copy in the help system -- tooltip text, FAQ answers, feedback form instructions, success confirmations -- should pass the "would Diane roll her eyes at this?" test. If it sounds like a chatbot, a support template, or a corporate FAQ, rewrite it.

---

## Anti-Inspiration

### 1. Intercom / Zendesk Chat Widgets

**URL:** [https://www.intercom.com](https://www.intercom.com)

**What to avoid:** The floating chat bubble in the bottom-right corner of every SaaS product. It is always there. It bounces. It sometimes auto-opens with a "Hi! How can we help?" message. It represents everything wrong with support UX for a focused writing tool: it competes for screen space, it assumes the user wants to chat, and it adds visual clutter to every page.

**Specific avoidances for DraftCrane:** No floating support widget. No chat interface. No proactive "Can I help?" prompts. No bottom-right bubble. The feedback path is: Settings menu > "Report a problem" or Help page > "Report a problem." Intentional, not ambient.

### 2. Grammarly -- Onboarding Overload

**URL:** [https://www.grammarly.com](https://www.grammarly.com)

**What to avoid:** Grammarly's onboarding involves a multi-screen tutorial, a sample document with guided edits, gamification elements (goals, streaks), and persistent nudges to upgrade. The new user experience is dense with feature education. For a non-technical author who just wants to write, this feels like being enrolled in a class they did not sign up for.

**Specific avoidances for DraftCrane:** The onboarding tour is 4 steps maximum. No gamification. No sample content. No "complete your profile" step. No nudges to explore features the author has not needed yet. The tour introduces the spatial model (here is where you write, here is where your chapters are, here is where your sources go, here is how to get help from the editor) and then gets out of the way permanently.

### 3. Jira -- Issue Reporting Complexity

**URL:** [https://www.atlassian.com/software/jira](https://www.atlassian.com/software/jira)

**What to avoid:** Jira's issue creation has required fields (summary, issue type, priority, project, component, labels, assignee), optional fields (description, environment, attachment, linked issues, epic), and workflow-specific fields. This is what "Report a problem" looks like when engineers design it for engineers.

**Specific avoidances for DraftCrane:** The feedback form has exactly two user-facing inputs: (1) a type toggle (bug or idea) and (2) a text field. Everything else is captured automatically or omitted. No priority selector. No category dropdown. No "steps to reproduce" template. No required fields beyond the message itself. The author writes what happened. The system figures out the rest.

---

## Voice & Tone Guide for Help & Support Copy

This section provides the specific tonal register for all copy that appears in the three help and support surfaces. The voice is DraftCrane's brand voice; the tone shifts based on emotional context.

### Onboarding Tooltips

**Tone:** Warm, brief, orienting. The author just created their first project. They are excited and possibly nervous. The tooltips should feel like a colleague pointing things out on a quick tour, not a tutorial.

| Guideline                     | Example                                           | Anti-Example                                                                                                                                             |
| ----------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One sentence per step         | "Add documents from Google Drive or your device." | "The Library panel lets you import documents from Google Drive or upload files from your device. You can use these as reference material while writing." |
| Active voice, second person   | "Start writing here."                             | "This is the area where text can be entered."                                                                                                            |
| No feature names in isolation | "Select any text to get suggestions."             | "Use the AI Rewrite feature to improve your text."                                                                                                       |
| No exclamation marks          | "Your chapters are listed here."                  | "Welcome to your sidebar! This is where all your chapters live!"                                                                                         |

### Feedback Form

**Tone:** Calm, efficient, grateful without being performative. The author might be frustrated (bug) or enthusiastic (idea). Meet both states with steady professionalism.

| Element                 | Copy Direction                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Form heading (bug)      | "Report a Problem"                                                                        |
| Form heading (idea)     | "Share an Idea"                                                                           |
| Instruction text (bug)  | "Describe what happened. We automatically include your browser info and recent activity." |
| Instruction text (idea) | "What would make DraftCrane better for your writing?"                                     |
| Placeholder text        | "What happened?" (bug) / "I wish DraftCrane could..." (idea)                              |
| Submit button           | "Send"                                                                                    |
| Success state (bug)     | "Sent. We read every report."                                                             |
| Success state (idea)    | "Sent. We read every suggestion."                                                         |
| Context disclosure      | "Includes: browser, device, current chapter, recent errors"                               |

### Help Page / FAQ

**Tone:** Direct, confident, precise. The author has a question and wants an answer, not a paragraph. Answers should be scannable -- lead with the direct answer, then provide detail if needed.

| Guideline                           | Example                                                  | Anti-Example                                                                                                          |
| ----------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Lead with the answer                | "Yes. Your chapters save automatically to Google Drive." | "Great question! DraftCrane provides automatic saving functionality that seamlessly syncs your work to Google Drive." |
| Use the author's language           | "How do I start a new chapter?"                          | "How do I create a new chapter entity?"                                                                               |
| Keep answers under 3 sentences      | Most questions need 1-2 sentences.                       | Multi-paragraph explanations with screenshots and step numbers.                                                       |
| Link to the action, not a docs page | "Go to Settings > Export."                               | "Please refer to our comprehensive export documentation at docs.draftcrane.com/export."                               |

---

## Color Application by Surface

### Onboarding Tooltip (Redesigned)

```
+------------------------------------------+
|  [*] [.] [.] [.]                         |
|                                           |
|  Add documents from Google Drive          |
|  or your device.                          |
|                                           |
|  Skip                          [ Next ]   |
+------------------------------------------+
         |  (caret pointing to target)
         V
```

- Card: `#FFFFFF` background, `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)`, `border-radius: 12px`
- Active step dot: `#2563EB`, 8px wide pill shape
- Inactive step dots: `#E5E7EB`, 6px circles
- Body text: `#374151`, 14px Geist Sans, line-height 1.5
- "Skip" text: `#6B7280`, 14px
- "Next" button: `#171717` background, `#FFFFFF` text, `border-radius: 8px`, min-height 44px
- Caret: `#FFFFFF` triangle, 8px, matching card shadow. CSS `clip-path` or pseudo-element.
- Backdrop: `rgba(0, 0, 0, 0.2)` -- same as current, sufficient to draw focus without feeling modal

### Feedback Form (Sheet)

```
+------------------------------------------+
|                                     [X]   |
|  Report a Problem                         |
|  Describe what happened.                  |
|                                           |
|  [Something broke]  [I have an idea]      |
|                                           |
|  +--------------------------------------+ |
|  | What happened?                       | |
|  |                                      | |
|  |                                      | |
|  +--------------------------------------+ |
|                                           |
|  i Includes: browser, device, chapter     |
|                                           |
|               [ Send ]                    |
+------------------------------------------+
```

- Sheet: `#FFFFFF`, `border-radius: 12px` (top corners if bottom sheet), full `12px` if dialog
- Heading: `#171717`, 20px Geist Sans, weight 600
- Instruction: `#374151`, 14px
- Toggle (bug selected): `#DC2626` text on `#FEF2F2` background, `border: 1px solid #FECACA`, `border-radius: 8px`
- Toggle (idea selected): `#2563EB` text on `#EFF6FF` background, `border: 1px solid #93C5FD`, `border-radius: 8px`
- Toggle (unselected): `#374151` text on `#FFFFFF` background, `border: 1px solid #D1D5DB`, `border-radius: 8px`
- Textarea: `#FFFFFF` background, `border: 1px solid #D1D5DB`, `border-radius: 8px`, focus: `border-color: #2563EB` + `ring-2 ring-blue-500/20`
- Context line: `#6B7280`, 12px, `Info` icon at 14px beside text
- Send button: `#171717` background, `#FFFFFF` text, full-width, `border-radius: 8px`, min-height 44px
- Close X: `#6B7280`, 20px `X` icon, 44px touch target

### Help Page (/help)

```
+------------------------------------------+
|                                           |
|  Help                                     |
|                                           |
|  Getting Started                          |
|  +--------------------------------------+ |
|  | How do I create a new book?       v  | |
|  +--------------------------------------+ |
|  | How do I add chapters?            v  | |
|  +--------------------------------------+ |
|                                           |
|  Writing & Editing                        |
|  +--------------------------------------+ |
|  | ...                                  | |
|  +--------------------------------------+ |
|                                           |
|  ...                                      |
|                                           |
|  ---------------------------------------- |
|  Report a problem    Replay tour          |
|                                           |
+------------------------------------------+
```

- Page background: `#FFFFFF`
- "Help" heading: `#171717`, 30px Lora, weight 600
- Section headings: `#171717`, 20px Lora, weight 600
- FAQ rows: `#374151`, 16px Geist Sans, weight 500, min-height 48px, `border-bottom: 1px solid #E5E7EB`
- FAQ chevron: `#6B7280`, rotates 180 degrees on expand (150ms ease-out)
- FAQ answer: `#374151`, 16px Geist Sans, weight 400, padding 16px, `background: #F9FAFB` (subtle differentiation from question)
- Footer links: `#2563EB`, 14px, weight 500, separated by `24px` gap
- Max content width: 680px, centered. Same as editor content width for visual consistency.

---

## Animation Guidance for Help & Support

All animations within the established 150-300ms range. All respect `prefers-reduced-motion`.

### Onboarding Tooltips

| Animation         | Duration        | Easing        | Trigger                        |
| ----------------- | --------------- | ------------- | ------------------------------ |
| Tooltip entrance  | 200ms           | `ease-out`    | Step appears                   |
| Tooltip exit      | 150ms           | `ease-in`     | Step dismissed, moving to next |
| Step transition   | 200ms crossfade | `ease-in-out` | Next button tapped             |
| Backdrop fade in  | 200ms           | `ease-out`    | First step appears             |
| Backdrop fade out | 150ms           | `ease-in`     | Tour complete or skipped       |

**Key change from current implementation:** The current tooltips appear instantly (`setTimeout` delay only). Adding the 200ms entrance animation with a subtle `translateY(4px)` to `translateY(0)` movement (matching the existing `toast-fade-in` pattern) will make the tooltip feel considered rather than stamped on.

### Feedback Form

| Animation                            | Duration | Easing                  | Trigger                |
| ------------------------------------ | -------- | ----------------------- | ---------------------- |
| Sheet slide up (if bottom sheet)     | 300ms    | `ease-out` (decelerate) | Form opened            |
| Dialog scale in (if centered dialog) | 200ms    | `ease-out`              | Form opened            |
| Backdrop fade in                     | 200ms    | `ease-out`              | Form opened            |
| Success state transition             | 200ms    | `ease-in-out`           | Report submitted       |
| Form dismiss                         | 150ms    | `ease-in` (accelerate)  | Close or after success |

### Help Page FAQ

| Animation        | Duration | Easing     | Trigger               |
| ---------------- | -------- | ---------- | --------------------- |
| FAQ expand       | 200ms    | `ease-out` | Question tapped       |
| FAQ collapse     | 150ms    | `ease-in`  | Question tapped again |
| Chevron rotation | 150ms    | `ease-out` | Expand/collapse       |

**Implementation note:** FAQ expand/collapse should animate `max-height` (or use CSS `grid-template-rows: 0fr` to `1fr` for smoother performance). Avoid `height: auto` transitions -- they do not animate. The `grid-template-rows` approach is preferable because it avoids the need to set a max-height value and animates smoothly.

---

_This contribution provides brand strategy guidance scoped to the Help & Support system. It builds on the established DraftCrane brand personality, design tokens, and visual language from the workspace design brief. The full token architecture is defined in the design technologist contribution. The interaction patterns are defined in the interaction designer contribution. All three contributions should be read together for a complete picture._
