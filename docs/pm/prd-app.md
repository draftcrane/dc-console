# Product Requirements Document (PRD)

**Product Name:** DraftCrane
**Tagline:** Your book. Your files. Your cloud. With an AI writing partner.
**Source:** VCMS note_01KH5MW1NJ9SSHPV926B48CBKZ (2026-02-11)

---

## 1. Product Vision

DraftCrane is a browser-based writing environment that helps non-technical professionals turn their knowledge into a publishable book using an iPad and their existing cloud files. It combines structured long-form writing, source integration from personal cloud storage, and an AI writing partner — while ensuring authors retain full ownership and portability of their work.

DraftCrane removes process friction so authors can focus on writing, not tools.

---

## 2. Target Users

**Primary User:**
Non-technical professionals (consultants, coaches, academics, founders, executives, subject-matter experts) who want to write a nonfiction book but feel overwhelmed by tools and process.

**User Characteristics:**

- Works primarily on iPad or browser
- Comfortable with Google Docs, not technical software
- Has existing notes/materials in Google Drive or similar
- Values ownership and control of their intellectual property
- Wants guidance and structure, not a blank page

---

## 3. Core Problem

Writing a professional book today requires stitching together:

- Word processors
- Note apps
- Research folders
- AI tools
- Formatting software

This fragmented workflow creates:

- Cognitive overload
- Lost materials
- Structural confusion
- Technical barriers to publishing

---

## 4. Product Principles

1. **Browser-first** — Works in Safari, Chrome, or any modern iPad browser
2. **No lock-in** — User files are stored in their own cloud account
3. **AI as partner, not replacement**
4. **Structure reduces overwhelm**
5. **Publishing is a button, not a project**

---

## 5. Core User Journey

1. User creates a book project
2. Connects cloud storage and selects source materials
3. Receives AI-generated outline and Book Blueprint
4. Writes in a structured, guided editor
5. Uses AI to draft, refine, and integrate sources
6. Clicks Publish to generate professional book outputs

---

## 6. Feature Overview

### Core MVP Features

#### 6.1 Project Setup

- Book title
- Audience
- Promise/outcome
- Tone selection
- Length target

#### 6.2 Book Blueprint (formerly "bible")

A living document that defines:

- Voice & tone rules
- Terminology glossary
- Key claims
- Target reader
- Structural intent

Used by AI to maintain consistency.

#### 6.3 Cloud File Integration

**Initial Support:** Google Drive

**Future Support:** iCloud Drive, Dropbox, Box, OneDrive

**Capabilities:**

- Connect account via OAuth
- Select a folder as "Book Folder"
- Import:
  - Google Docs
  - PDFs
  - Images

All originals remain in user Drive.

**Source Type Model:** Users add sources through a Source Type Picker that presents all supported (and coming-soon) source types. Google Drive and Local Files are available in Phase 0. Additional cloud providers are added as new source types — no UX redesign required. See `docs/design/source-review/design-spec.md` for the full Source Type Picker specification.

#### 6.4 Writing Environment

- Chapter-based manuscript structure
- Clean, touch-friendly editor
- Sidebar chapter navigation
- Inline comments/notes
- Auto-save to user's cloud file

#### 6.5 AI Writing Partner

**Ask Mode** — Freeform chat:

- "Rewrite this"
- "Explain more clearly"
- "Give examples"

**Craft Buttons** — One-tap transformations:

- Expand
- Shorten
- Simplify
- Improve flow
- Add example
- Strengthen argument
- Match Book Blueprint voice

#### 6.6 Source Intelligence

- Search imported source materials
- Suggest relevant sources for current section
- Insert quote or summary with link to original file

#### 6.7 Idea Inbox

- Quick text capture
- Voice dictation → transcript
- Tag suggestions
- AI suggests where idea fits in book

#### 6.8 Export Manager

**Export Generation:**

- One-click generation of print-ready PDF and EPUB
- Full-book or single-chapter scope
- Server-side rendering via Cloudflare Browser Rendering
- Artifacts stored in R2 with download URLs

**Destination Selection:**

- **This Device** — standard browser download; OS controls save location (Downloads on desktop, share sheet on iPad Safari)
- **Google Drive** — save to a selected folder in the user's connected Drive account; default folder: `{Book Title}/_exports/`
- Folder browsing within Drive destinations (folders only, breadcrumb navigation, create new folder)
- When only one destination exists (no Drive connected), export downloads directly — no picker shown
- When multiple destinations exist (Drive connected), show Export Destination Picker bottom sheet

**Remembered Defaults (per-project):**

- "Always save exports here" checkbox in destination picker
- When set, subsequent exports auto-deliver to saved destination with compact confirmation toast
- Confirmation toast includes "Change" link to reopen picker and update/clear default
- "Export destination..." menu item provides persistent, discoverable path to manage default
- Stale defaults detected at export time (disconnected Drive, deleted folder) — fall back to picker with error context

**Edge Cases:**

- Defaults only apply to new export jobs (no idempotency conflict with re-saves)
- `ON DELETE SET NULL` on drive_connection_id — disconnected source detected automatically
- Rate limit: 5 exports/min per user

---

### Phase 2 Enhancements

#### 7.1 Structural Guidance

- Chapter health indicators
- Balance analysis (too dense, too thin)
- Missing section suggestions

#### 7.2 Consistency Engine

- Detect contradictions
- Terminology consistency checks
- Repeated idea detection

#### 7.3 Research Expansion

- AI suggests where examples/stories are missing
- Source gap detection

#### 7.4 Collaboration

- Invite editor/reviewer (comment-only)
- Version snapshots

---

### Aspirational Features (Future)

#### 8.1 Cover & Publishing Toolkit

- Trim size formatting presets
- Cover dimension guidance
- ISBN walkthrough
- KDP/Apple Books submission checklist

#### 8.2 Voice Capture Mode

Speak ideas → structured draft sections

#### 8.3 AI Developmental Editing

High-level feedback:

- Narrative flow
- Argument strength
- Reader engagement

#### 8.4 Multi-Book Knowledge Graph

AI remembers author's previous books to maintain continuity.

#### 8.5 Audiobook Prep

Export optimized manuscript for narration.

---

## 9. Non-Functional Requirements

| Area        | Requirement                         |
| ----------- | ----------------------------------- |
| Platform    | Fully functional in iPad browsers   |
| Performance | Document load < 3 seconds           |
| Reliability | Auto-save and version history       |
| Security    | OAuth-based Drive access            |
| Ownership   | All core files stored in user cloud |
| Privacy     | No model training on user content   |

---

## 10. Architecture Overview (User-Invisible)

| Layer             | Purpose                                |
| ----------------- | -------------------------------------- |
| Web App           | Writing interface                      |
| Cloudflare Worker | AI orchestration & document processing |
| D1                | Indexing & metadata                    |
| R2                | Image caching                          |
| GitHub            | Optional publishing pipeline           |
| Google Drive      | Canonical file storage                 |

---

## 11. Phased Development Plan

### Phase 0 — Foundations

- Auth system
- Drive integration
- Basic editor
- Simple AI rewrite
- PDF/EPUB export

**Outcome:** Functional writing + export tool

### Phase 1 — Guided Writing

- Book Blueprint
- Outline generation
- Craft buttons
- Idea Inbox
- Chapter organization

**Outcome:** Structured, AI-assisted authoring

### Phase 2 — Source Intelligence

- Import source materials
- Searchable source panel
- AI source suggestions
- Insert with citation links

**Outcome:** Knowledge-to-book pipeline

### Phase 3 — Publishing Polish

- Professional templates
- Layout tuning
- Cover toolkit
- Distribution checklists

**Outcome:** End-to-end publishing readiness

### Phase 4 — Advanced AI & Ecosystem

- Consistency engine
- Developmental editing
- Multi-book memory
- Audiobook tools

---

## 12. Success Metrics

| Metric                          | Target          |
| ------------------------------- | --------------- |
| Time to first draft chapter     | < 2 hours       |
| % users exporting book formats  | > 40%           |
| Monthly active writing users    | > 60% retention |
| Avg chapters completed per user | 6+              |

---

## 13. Competitive Positioning

DraftCrane sits between:

- Word processors (Docs)
- Research tools (Notion)
- AI chat tools (ChatGPT)
- Formatting tools (Vellum)

It replaces a fragmented workflow with a single guided system.

---

## 14. Risks

| Risk               | Mitigation                     |
| ------------------ | ------------------------------ |
| AI hallucinations  | Source linking + user approval |
| Overcomplexity     | Ruthless MVP scope             |
| Drive API limits   | Smart caching                  |
| Users fear lock-in | Visible file ownership         |

---

## 15. Future Vision

DraftCrane becomes the default environment where professionals turn expertise into published authority — not just a writing tool, but a knowledge-to-book pipeline.
