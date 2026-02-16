# Draft Crane — Project Instructions

**Last Updated:** February 16, 2026

---

## 0) Project Identity

**Product:** DraftCrane — a browser-based writing environment that helps non-technical professionals turn their knowledge into a publishable book.

**Tagline:** Your book. Your files. Your cloud. With an AI writing partner.

**Mission:** Remove process friction so subject-matter experts can focus on writing, not tools. Turn scattered expertise into structured, publishable authority.

**What DraftCrane Is:**

- A guided writing environment for nonfiction authors
- A source-to-manuscript pipeline that connects to the author's own cloud storage
- An AI writing partner that respects the author's voice, sources, and ownership

**What DraftCrane Is Not:**

- Not a general-purpose word processor (Google Docs already exists)
- Not a fiction/creative writing tool (Scrivener owns that)
- Not an AI ghostwriter (the author writes; the AI assists)
- Not a publishing house (we produce export-ready files, not printed books)

**The Test:** Every feature must either reduce the author's cognitive overhead or move the manuscript closer to publishable. If it does neither, cut it.

---

## 1) Development Philosophy

### Build What You Can Kill

DraftCrane is a Venture Crane portfolio product. It follows the Business Validation Machine methodology:

```
IDEATION → DESIGN → PROTOTYPE → MARKET TEST → PIVOT/KILL → SCALE → MAINTAIN
```

We are entering **Design → Prototype**. The goal is to reach a functional writing + export tool (Phase 0 in the PRD) and put it in front of real users. Speed matters more than polish. Validated learning matters more than feature count.

### Kill Criteria

DraftCrane gets killed if:

- After prototype: No user completes a full chapter in their first session
- After market test: Fewer than 3 of 10 beta users return for a second session
- After 90 days: No signal of willingness to pay

These are real. No heroics, no "one more feature."

### Core Principles

1. **Ship the smallest thing that teaches us something.** The PRD has 4 phases. We are building Phase 0. Do not build Phase 1 features until Phase 0 is validated.

2. **The user is not technical.** They use an iPad. They know Google Docs. Every UI decision must pass the "would a management consultant figure this out in 10 seconds?" test.

3. **The user's files are sacred.** All manuscript content lives in the user's Google Drive. We index and cache; we never become the canonical store. If DraftCrane disappears tomorrow, the user still has their book.

4. **AI assists, never replaces.** Every AI action requires user approval. No silent rewrites. No ghost-generated content presented as the author's work. Source attribution is non-negotiable.

5. **Browser-first, iPad-native.** No desktop app. No Electron. Safari on iPad is the primary test target. If it works there, it works everywhere.

---

## 2) Tech Stack

DraftCrane inherits the Venture Crane standard stack. Deviations require an ADR (Architecture Decision Record) with justification.

| Layer              | Choice                        | Notes                                                           |
| ------------------ | ----------------------------- | --------------------------------------------------------------- |
| **Frontend**       | Next.js + Tailwind            | Deployed on Cloudflare Pages or Vercel                          |
| **Backend**        | Cloudflare Workers (Hono)     | AI orchestration, document processing                           |
| **Database**       | Cloudflare D1                 | Indexing, metadata, user projects                               |
| **Object Storage** | Cloudflare R2                 | Image caching, export artifacts                                 |
| **Cache**          | Cloudflare KV                 | Session data, fast lookups                                      |
| **Auth**           | Clerk                         | When user accounts are needed                                   |
| **File Storage**   | Google Drive (user's account) | Canonical manuscript storage via OAuth                          |
| **AI**             | OpenAI API (GPT-4o)           | Writing partner via `AIProvider` interface (see ADR-003)        |
| **AI Agents**      | Claude Code SDK               | Custom agents for drafting, source analysis, consistency checks |
| **Export**         | PDF/EPUB generation library   | TBD during Phase 0                                              |
| **Repo**           | GitHub (draftcrane org)       | All code, issues, PRs                                           |
| **CI/CD**          | GitHub Actions                | Lint, typecheck, test, deploy                                   |

### Resource Naming Conventions

| Resource     | Pattern        | Example                   |
| ------------ | -------------- | ------------------------- |
| D1 Database  | `dc-{purpose}` | `dc-main`, `dc-sessions`  |
| R2 Bucket    | `dc-{purpose}` | `dc-exports`, `dc-images` |
| KV Namespace | `dc-{purpose}` | `dc-cache`                |
| Worker       | `dc-{service}` | `dc-api`, `dc-ai`         |

---

## 3) Coding Standards

### Language & Tooling

- **TypeScript** everywhere. No plain JavaScript files.
- **ESLint** configured and enforced in CI.
- **Prettier** for formatting consistency.
- **Vitest** for testing.

### Code Style

- **Explicit over clever.** The next person reading this code might be an AI agent with no prior context. Write for clarity.
- **Small functions, clear names.** If a function needs a comment to explain what it does, rename it.
- **No dead code.** Delete unused imports, functions, and files. Don't comment them out "for later."
- **Type everything.** No `any` unless there's a documented reason. Prefer explicit interfaces over inferred types at API boundaries.

### API Patterns (Hono Workers)

Follow the modular structure:

```
workers/dc-api/
├── src/
│   ├── index.ts           # Route mounting only
│   ├── middleware/         # Auth, CORS, logging, error handling
│   ├── routes/            # One file per domain (projects, chapters, ai)
│   ├── services/          # Business logic (no HTTP concerns)
│   ├── types/             # Shared type definitions
│   └── utils/             # Pure utility functions
├── test/                  # Vitest tests mirror src/ structure
├── migrations/            # D1 SQL migrations (numbered)
└── wrangler.toml
```

### Database Patterns

- **Parameterized queries only.** Never interpolate user input into SQL strings.
- **Migrations are forward-only.** Number them sequentially: `0001_create_projects.sql`, `0002_add_chapters.sql`.
- **Batch reads.** Cloudflare Workers have a ~1000 subrequest limit. Design data access accordingly.

### Security

- **No hardcoded secrets.** Use environment variables via Infisical or wrangler secrets.
- **No wildcard CORS origins** in production.
- **OAuth tokens** are stored server-side, never exposed to the client.
- **User content isolation.** One user must never see another user's data. Enforce at the query level, not just the UI level.

---

## 4) Quality Standards

DraftCrane starts at **Golden Path Tier 1** (Validation):

| Requirement          | Status               |
| -------------------- | -------------------- |
| GitHub repo with CI  | Done                 |
| CLAUDE.md            | Done                 |
| TypeScript + ESLint  | Template includes it |
| No hardcoded secrets | Infisical configured |

Graduate to **Tier 2** after market validation. Tier 2 adds Sentry, full CI/CD pipeline, branch protection, and uptime monitoring. Don't gold-plate before validation.

### Definition of Ready

An issue is READY for development when:

- GitHub Issue exists with acceptance criteria
- Acceptance criteria are specific and testable
- `status:ready` label applied
- Priority label assigned

### Definition of Done

An issue is DONE when:

- PR merged to main
- All acceptance criteria verified
- Deployed to production
- Issue closed with `status:done` label

---

## 5) Workflow

### Session Protocol

Every dev session follows the Crane workflow:

| Command   | When             | What                                 |
| --------- | ---------------- | ------------------------------------ |
| `/sod`    | Start of session | Load context, see priorities, orient |
| `/update` | During session   | Sync progress mid-session            |
| `/eod`    | End of session   | Create handoff for next session      |

### Issue Lifecycle

```
status:triage → status:ready → status:in-progress → status:qa → status:done
```

### PR Workflow

1. Create branch from `main`
2. Implement against acceptance criteria
3. PR with description linking the issue
4. CI passes (lint, typecheck, test)
5. Merge to main
6. Deploy

### Handoff Protocol

When you stop working, leave a handoff. When you start working, read the last handoff. Context loss between sessions is the number one velocity killer.

---

## 6) Phase 0 Scope — What We Are Building First

From the PRD, Phase 0 delivers a functional writing + export tool:

- **Auth system** — User can sign in
- **Google Drive integration** — Connect via OAuth, select a Book Folder
- **Basic editor** — Chapter-based writing with auto-save
- **Simple AI rewrite** — Select text, ask AI to rewrite/expand/simplify
- **PDF/EPUB export** — One-click generation saved to Book Folder

**Explicitly NOT in Phase 0:**

- Book Blueprint
- Outline generation
- Craft buttons
- Idea Inbox
- Source Intelligence
- Collaboration
- Cover toolkit

Build Phase 0. Validate Phase 0. Then decide if Phase 1 is worth building.

---

## 7) Key Decisions Still Needed

These should be resolved via ADRs as development begins:

1. **Editor library** — Which rich text editor? (Tiptap, ProseMirror, Lexical, Plate)
2. **Google Drive sync strategy** — Real-time vs. periodic vs. on-save
3. ~~**AI provider integration**~~ — Resolved: OpenAI API via `AIProvider` interface (ADR-003)
4. **PDF/EPUB generation** — Server-side vs. client-side, which library
5. **Data model** — What lives in D1 vs. what lives in Google Drive
6. **AI agent architecture** — Where Claude Code SDK agents fit in the stack (Craft Buttons, Source Intelligence, Consistency Engine are all candidates for purpose-built agents rather than raw API calls)

---

## 8) What Belongs Where

### In dc-console (this repo)

- Product requirements, specs, ADRs
- Application source code
- Infrastructure config (wrangler.toml, CI workflows)
- Process documentation

### In crane-console (shared infrastructure)

- Crane Relay, Classifier, Context worker code
- Cross-venture standards and templates
- Venture setup tooling

### In GitHub Issues

- All work items, bugs, feature requests
- Sprint planning and prioritization
- Acceptance criteria and verification evidence

### NOT in this codebase

- Strategic business decisions (Apple Notes / Captain's Log)
- Entity/legal matters (SMDurgan LLC governance)
- Marketing copy, brand assets (separate when needed)
