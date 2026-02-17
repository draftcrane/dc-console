# Code Review: Draft Crane

**Date:** 2026-02-17
**Reviewer:** Claude Code (automated)
**Scope:** Full codebase
**Mode:** Quick (Phase 1 - Claude-only)
**Models Used:** Claude Opus 4.6
**Golden Path Tier:** Tier 1

## Summary

**Overall Grade: C**

DraftCrane has a well-architected backend with strong security practices, consistent patterns, and excellent documentation. The Hono API follows clean separation of concerns with typed middleware, parameterized SQL, AES-256-GCM token encryption, strict CORS, and proper rate limiting. TypeScript strict mode is enabled with zero `any` usage across the entire codebase.

The two most significant risks are (1) the near-total absence of tests -- particularly for the 6 core backend services and the frontend which has zero test coverage -- and (2) the 1,257-line editor page component that concentrates too much responsibility in a single file.

## Scorecard

| Dimension     | Grade | Trend |
| ------------- | ----- | ----- |
| Architecture  | C     | new   |
| Security      | C     | new   |
| Code Quality  | C     | new   |
| Testing       | D     | new   |
| Dependencies  | C     | new   |
| Documentation | B     | new   |
| Golden Path   | B     | new   |

**Overall: C** (first review)

## Detailed Findings

### 1. Architecture

**Findings:**

1. [HIGH] `web/src/app/(protected)/editor/[projectId]/page.tsx` (1,257 lines) - God component managing project loading, chapter CRUD, content editing, AI rewrite, Drive integration, export, deletion dialogs, sign-out, settings menus, crash recovery, and onboarding in a single file with 20+ `useState` and 10+ `useCallback` declarations. Recommendation: Extract into focused custom hooks (`useChapterCrud`, `useProjectSettings`, `useEditorToolbar`) and sub-components. Target under 300 lines for the page component.

2. [MEDIUM] `web/src/components/sidebar.tsx` (761 lines), `workers/dc-api/src/services/project.ts` (689 lines), `workers/dc-api/src/services/export.ts` (655 lines) - Multiple files exceed the 500-line threshold. `ProjectService` combines project and chapter CRUD which could be split. `ExportService` has significant duplication between `exportBook` and `exportChapter`. Recommendation: Extract `ChapterService` from `ProjectService`. In `ExportService`, factor out shared orchestration logic into a private method.

3. [LOW] `workers/dc-api/src/index.ts:75-76` - Two route modules mounted at `/` root path (`exportRoutes` and `chapters`), requiring knowledge of internal route definitions to understand the URL space. Recommendation: Mount at descriptive prefixes or document the convention.

4. [LOW] Route handlers contain inline DB queries in fire-and-forget closures (`workers/dc-api/src/routes/chapters.ts:58-82`). This mixes persistence concerns into the routing layer. Noted as intentional per MEMORY.md ("Drive write-through lives in route handlers, NOT in ContentService"). Acceptable for Phase 0.

**Grade: C**
**Rationale:** 4+ files exceeding 500 lines, with the editor page being a significant God component. Backend separation of concerns is clean, but the frontend architecture has a major monolith risk.

---

### 2. Security

**Findings:**

1. [MEDIUM] `workers/dc-api/src/services/drive.ts:340` - Google Drive API query `'${folderId}' in parents and trashed = false` interpolates `folderId` directly into the query string. While sourced from the database (not user input), this is a Drive query injection vector if a DB row were compromised. Recommendation: Validate `folderId` against a strict alphanumeric pattern before interpolation.

2. [MEDIUM] `workers/dc-api/src/services/drive.ts:377` - Same pattern: `name = '${folderName}'` interpolated directly into Google Drive search query in `findOrCreateSubfolder`. Currently hardcoded to `"_exports"` at the call site but the method signature accepts arbitrary strings. Recommendation: Escape single quotes in the parameter.

3. [MEDIUM] `workers/dc-api/src/routes/projects.ts:160` and `workers/dc-api/src/routes/export.ts:126` - `Content-Disposition` header interpolates `fileName` without escaping. If a file name contains double quotes or newlines, this could lead to header injection. Recommendation: Sanitize or use RFC 5987 encoding (`filename*=UTF-8''...`).

4. [LOW] `workers/dc-api/wrangler.toml:28` - Comment references `OPENAI_API_KEY` as a secret name. The actual AI provider configuration is mixed (Anthropic Claude + Workers AI Mistral). The secret name is misleading. Recommendation: Rename to a provider-agnostic name like `AI_API_KEY`.

5. [LOW] `workers/dc-api/src/middleware/auth.ts:55` - Cookie token extraction via regex `/__session=([^;]+)/` does not URL-decode the cookie value. Low risk since JWTs are base64url (no %-encoding). Recommendation: Document the assumption.

**Grade: C**
**Rationale:** Three medium-severity findings. The fundamentals are excellent (parameterized SQL everywhere, strict CORS, JWKS signature verification, AES-256-GCM token encryption, CSRF-protected OAuth state), but the Drive query injection and Content-Disposition header injection represent real, if narrow, attack surfaces.

---

### 3. Code Quality

**Findings:**

1. [MEDIUM] `workers/dc-api/src/services/content.ts:181-188` and `workers/dc-api/src/services/backup.ts:276-283` - `countWords` function duplicated verbatim across two files. `backup.ts` has a comment acknowledging this. Additionally, `web/src/app/(protected)/editor/[projectId]/page.tsx:813-819` has a third implementation on the frontend. Recommendation: Extract into `workers/dc-api/src/utils/word-count.ts`.

2. [MEDIUM] `workers/dc-api/src/services/export.ts:637-654` and `workers/dc-api/src/services/backup.ts:257-269` - `sanitizeFileName`, `formatDate`, and `buildFileName` utilities duplicated between export and backup services. Recommendation: Extract into `workers/dc-api/src/utils/file-names.ts`.

3. [MEDIUM] `workers/dc-api/src/services/export.ts:106-237` and `:248-371` - `exportBook` and `exportChapter` share ~70% of their logic (create job, fetch content, assemble, store in R2, update job). Recommendation: Extract common orchestration into `executeExport(userId, projectId, chapters, format)`.

4. [LOW] `web/src/components/sidebar.tsx:422-423` - ESLint suppression for `@typescript-eslint/no-explicit-any` on `dragListeners`. Legitimate case where `@dnd-kit/core` types are imprecise. Acceptable.

5. [LOW] `web/src/components/ai-rewrite-sheet.tsx:106` - ESLint suppression for `react-hooks/exhaustive-deps`. Deliberate optimization using `result?.interactionId` instead of full `result` object. Acceptable; add comment explaining why.

6. [LOW] Zero `any` usage found in the entire codebase. TypeScript strict mode enabled in both workspaces. Excellent.

**Grade: C**
**Rationale:** Notable DRY violations across 3 separate function groups, despite excellent TypeScript discipline (zero `any`, strict mode, consistent error handling via `AppError` helpers, structured logging).

---

### 4. Testing

**Findings:**

1. [HIGH] Zero frontend tests. No test files exist in `web/src/`. The 1,257-line editor page, all hooks, and all components are completely untested. Recommendation: Add integration tests for core hooks (`use-auto-save.ts`, `use-ai-rewrite.ts`), unit tests for `indexeddb.ts`. Consider Playwright for the critical editor flow.

2. [HIGH] No tests for core business logic services: `ProjectService`, `ContentService`, `DriveService`, `ExportService`, `AIRewriteService`, `BackupService`. These contain the most critical logic (CRUD, version conflict detection, token encryption, content storage). Recommendation: Add Vitest tests for each service with mocked D1 and R2 bindings. Priority: `ContentService` (version conflicts), `ProjectService` (chapter operations), `BackupService` (import/export round-trip).

3. [MEDIUM] Existing tests are exclusively negative-path or smoke tests. Auth tests verify rejection only (no valid auth flow). CORS test verifies allow/block. Crypto tests verify round-trip. Health tests verify the health endpoint. None exercise happy-path business logic. Recommendation: Add happy-path integration tests exercising authenticated CRUD flows through the Worker.

4. [LOW] 5 test files with ~200 lines of test code covering ~15,000+ lines of production TypeScript. Test-to-code ratio is under 1%. Recommendation: Establish a coverage target. For Tier 1, aim for 60%+ backend service coverage as a first milestone.

**Grade: D**
**Rationale:** Minimal tests exist (5 files, ~200 lines) for a non-trivial codebase. Critical business logic paths are completely untested. Framework is configured correctly but coverage is severely lacking.

---

### 5. Dependencies

**Findings:**

1. [HIGH] `wrangler 4.0.0-4.59.0` has a known OS Command Injection vulnerability in `pages deploy` (GHSA-36p8-mvp6-cv38). DraftCrane does not use `pages deploy` (it uses `wrangler deploy` for Workers), so real risk is low. Recommendation: Update wrangler to `>=4.60.0` when available to clear the audit signal.

2. [MEDIUM] 11 moderate vulnerabilities from `markdown-it` transitive dependencies. Likely from `eslint-config-next` or another dev dependency, not production code. Recommendation: Run `npm audit fix` and evaluate. If dev-only transitive deps, production risk is negligible.

3. [LOW] `ulid` package (`^2.3.0`) has not had a release since 2020 and is effectively unmaintained. Works correctly but receives no security patches. Recommendation: Consider migrating to `ulidx` (actively maintained fork).

4. [LOW] Dependency count is appropriate. Backend: 4 runtime deps (hono, jszip, svix, ulid). Frontend: 10 runtime deps (Next.js, React, Clerk, Tiptap, dnd-kit). No unused dependencies detected.

**Grade: C**
**Rationale:** Medium-severity audit findings from transitive dependencies. The wrangler HIGH vulnerability has low real risk since the affected command (`pages deploy`) is unused. Dependencies are lean and well-chosen overall.

---

### 6. Documentation

**Findings:**

1. [LOW] CLAUDE.md is comprehensive and well-maintained: tech stack table, API routes table, key files, build commands, design principles, security notes. One of the most thorough CLAUDE.md files reviewed. No changes needed.

2. [LOW] README.md is minimal (27 lines) and primarily agent-oriented (`/sod`, `/eod` commands). It lacks human-readable setup instructions, environment variable documentation, and local development setup. Recommendation: Add a "Local Development" section with prerequisites, env var setup, and `npm run dev` instructions.

3. [LOW] `wrangler.toml:28` references `OPENAI_API_KEY` but CLAUDE.md says "Anthropic Claude API (claude-sonnet-4)". The `AI_MODEL` var is set to `gpt-4o`. Multiple AI providers are in use (frontier = OpenAI, edge = Workers AI Mistral) but this isn't documented clearly. Recommendation: Reconcile documentation and configuration.

4. [LOW] Inline code comments are thorough. Every service, route, and middleware has JSDoc with PRD section references. Schemas documented via migration SQL files. No changes needed.

**Grade: B**
**Rationale:** CLAUDE.md and README exist and are useful. CLAUDE.md is excellent. README is minimal and lacks human developer onboarding. Minor documentation inconsistencies around AI provider configuration.

---

### 7. Golden Path Compliance

**Findings:**

1. [PASS] Source control: Git repo with conventional commits. CI runs on push to main and PRs.

2. [PASS] CLAUDE.md present and complete: Tech stack, commands, architecture, security notes, API surface, key files.

3. [PASS] TypeScript strict mode enabled in both workspaces. ESLint configured via `web/eslint.config.mjs` with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

4. [PASS] No hardcoded secrets. All secrets managed via `wrangler secret` (sourced from Infisical). Non-sensitive config in `[vars]`. `.env` files in `.gitignore`.

5. [PASS] CI pipeline present in `.github/workflows/ci.yml`: lint, typecheck, format check, and tests run on push to main and PRs.

6. [MEDIUM] CI does not run frontend tests (none exist). No test job for web workspace. Recommendation: Add frontend testing infrastructure and CI job.

7. [LOW] No PR template found. Recommendation: Add `.github/pull_request_template.md` with checklist for test coverage, documentation updates, and migration notes.

**Grade: B**
**Rationale:** All critical Tier 1 requirements met. Two non-critical items missing (frontend test CI, PR template).

---

## Trend Analysis

First review for this venture. No previous scorecard to compare against.

## File Manifest

| Type             | Count       |
| ---------------- | ----------- |
| TypeScript (.ts) | 49          |
| React (.tsx)     | 29          |
| Markdown (.md)   | 48          |
| JSON (.json)     | 9           |
| SQL (.sql)       | 8           |
| YAML (.yml)      | 2           |
| Shell (.sh)      | 2           |
| TOML (.toml)     | 1           |
| CSS (.css)       | 1           |
| **Total lines**  | **~35,535** |
