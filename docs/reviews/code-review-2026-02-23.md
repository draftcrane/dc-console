# Code Review: Draft Crane

**Date:** 2026-02-23
**Reviewer:** Claude Code (automated)
**Scope:** Full codebase
**Mode:** Quick (Phase 1 - Claude-only)
**Models Used:** Claude Opus 4.6
**Golden Path Tier:** Tier 1

## Summary

**Overall Grade: B** (improved from C on 2026-02-19)

DraftCrane has matured significantly since the last review. The most impactful improvement is the decomposition of the 1,257-line editor god component into a clean 327-line orchestrator with 7 focused hooks and 4 sub-components. All previously flagged security vulnerabilities (Drive query injection, Content-Disposition header injection) have been properly remediated with dedicated utility modules. The test suite has grown from near-zero frontend coverage to 154 tests across 14 files, complementing the 528-test backend suite.

The remaining action items are minor: consolidate word count implementations, add tests for the dashboard page and export menu, and run `npm audit fix` for a dev-dependency finding.

## Scorecard

| Dimension     | Grade | Trend  |
| ------------- | ----- | ------ |
| Architecture  | B     | up     |
| Security      | A     | up     |
| Code Quality  | B     | up     |
| Testing       | B     | up     |
| Dependencies  | B     | up     |
| Documentation | B     | stable |
| Golden Path   | A     | up     |

**Overall: B** (improved from C)

## Previous Issue Resolution

21 of 24 findings from previous reviews resolved. 3 open issues remain:

- #167 — 2026-02-19 finding log and remediation checklist (tracking issue)
- #169 — Implement archived source reactivation for Drive reconnect
- #170 — Update API docs for current Drive and project endpoints

## Detailed Findings

### 1. Architecture

**Findings:**

1. [HIGH — RESOLVED] `web/src/app/(protected)/editor/[projectId]/page.tsx` — Previously a 1,257-line god component. Now 327 lines acting as a clean orchestrator, delegating to focused hooks (`useAutoSave`, `useChapterManagement`, `useEditorAI`, `useEditorTitle`, `useProjectActions`, `useEditorProject`, `useChapterContent`) and sub-components (`EditorSidebar`, `EditorToolbar`, `EditorWritingArea`, `EditorDialogs`). Excellent decomposition.

2. [LOW] `web/src/components/project/export-menu.tsx` (787 lines) — Contains inline SVG icons, toast UI, download logic, Drive save logic, destination picker orchestration, and keyboard handling. Internally well-organized but approaching the upper limit. Recommendation: Extract inline SVG icons into shared icon components and consider an `ExportToast` sub-component.

3. [LOW] `web/src/components/layout/sidebar.tsx` (761 lines) — Contains `Sidebar`, `SortableChapterItem`, `ChapterListItem`, `InlineRenameInput`, and `SidebarOverlay`. Tightly coupled components justify co-location, but the overlay with focus trap logic has independent responsibility. Recommendation: Extract `SidebarOverlay` into its own file.

4. [MEDIUM] `workers/dc-api/src/services/drive-files.ts` (696 lines) — Handles folder CRUD, file listing, upload, update, rename, trash, download, export, and content parsing. The `getFileContent` method (line 657) dynamically imports `mammoth` and `unpdf` for format conversion, mixing I/O orchestration with content transformation. Recommendation: Extract content parsing/conversion logic into a dedicated `drive-content-parser.ts` module.

5. [LOW] `workers/dc-api/src/routes/drive.ts` (616 lines) — Large but handles a complex OAuth flow + multiple endpoints. The public/authenticated route split is clean. No action needed unless more Drive routes are added.

6. [LOW] Route mounting in `workers/dc-api/src/index.ts:91-94` uses `app.route("/", ...)` for four sub-routers. Works correctly but is less self-documenting. Minor concern — no action needed.

**Grade: B**
**Rationale:** The major god component has been expertly decomposed. One medium finding (drive-files.ts mixing concerns). Several files approach 800 lines but are internally well-organized. Clean routes-services-types layering throughout the backend.

---

### 2. Security

**Findings:**

1. [RESOLVED] Drive query string interpolation — Fixed. `workers/dc-api/src/utils/drive-query.ts` provides `validateDriveId()` (regex `^[a-zA-Z0-9_-]+$`) and `escapeDriveQuery()` (escapes backslashes and single quotes). Used consistently throughout `drive-files.ts`.

2. [RESOLVED] Content-Disposition header injection — Fixed. `workers/dc-api/src/utils/file-names.ts:34` (`safeContentDisposition`) sanitizes quotes, backslashes, and newlines with RFC 5987 `filename*` encoding. Used in both `projects.ts:174` and `export.ts:130`.

3. [LOW] Test auth bypass in `workers/dc-api/src/middleware/auth.ts:54` is properly gated behind `ALLOW_TEST_AUTH === "true"` AND `isLocalRequest()`. Fails closed on non-local requests.

4. [LOW] CORS is restrictive — no wildcard origins. Falls closed if `FRONTEND_URL` not configured. Credentials enabled.

5. [LOW] All D1 queries use parameterized `.bind()` calls. Verified across all route and service files. No string interpolation in SQL.

6. [LOW] AES-256-GCM encryption with random IV per operation for OAuth tokens at rest (`services/crypto.ts`).

7. [LOW] Rate limiting covers all route groups: `standardRateLimit` on chapters/projects/users/sources/research, `aiRateLimit` on AI rewrite, `exportRateLimit` on exports, custom limit on Drive picker tokens.

8. [LOW] HTML sanitization via `sanitize-html` with strict allowlist matching Tiptap schema. Script/style blocks explicitly excluded.

9. [LOW] JWT verification in `middleware/auth.ts:121` — payload parsed before signature verification (needed to extract `kid` for key lookup). Standard JWT practice. Properly rejects on verification failure.

**Grade: A**
**Rationale:** All checklist items pass. All previously flagged medium-severity findings are remediated. CORS, SQL parameterization, encryption, rate limiting, and auth are all implemented correctly. No injection vectors found.

---

### 3. Code Quality

**Findings:**

1. [MEDIUM] Word count duplication — Three implementations remain:
   - `workers/dc-api/src/utils/word-count.ts:5-12` (backend utility, properly extracted)
   - `web/src/hooks/use-chapter-content.ts:79-86` (inline, strips HTML + counts words)
   - `web/src/hooks/use-text-selection.ts:31-35` (plain text word count)
     Backend duplication was fixed per previous review; frontend still has two inline implementations. Recommendation: Create `web/src/utils/word-count.ts` and import in both hooks.

2. [MEDIUM] `package.json:18-23` — Root devDependencies include `docx`, `mammoth`, `pdf-lib`, `unpdf` used only by `scripts/generate-doc-parse-fixtures.ts`. Adds unnecessary install weight. Recommendation: Move to `scripts/package.json` or add a comment documenting their purpose.

3. [LOW] Zero `any` type usage across entire codebase. TypeScript `strict: true` in both workspaces. Exemplary type safety.

4. [LOW] Consistent error handling via `AppError` class with typed error codes and helper functions (`notFound`, `forbidden`, `conflict`, `validationError`, `rateLimited`, `authRequired`) that all return `never`. Global error handler logs structured JSON and writes to KV.

5. [LOW] Consistent naming conventions: camelCase for variables/functions, PascalCase for types/classes, kebab-case for file names. Service classes follow `{Domain}Service` pattern.

6. [LOW] Previously flagged DRY violations in `sanitizeFileName`/`formatDate`/`buildFileName` and export orchestration have been resolved — utilities extracted to `utils/file-names.ts`.

**Grade: B**
**Rationale:** One DRY violation remaining (word count on frontend) and a minor housekeeping item (root devDeps). TypeScript discipline is exemplary with zero `any` usage, consistent error handling, and clean naming conventions. Major improvement from 3 DRY violation groups to 1.

---

### 4. Testing

**Findings:**

1. [LOW] Backend: 29 test files, 528 tests — all passing. Covers auth, CORS, health, crypto, AI interactions, AI rewrite, export, HTML sanitization, chunking, drive tokens, prompt builder, research clips, snippet parser, backup, drive connection resolver, drive query, research query, source search, linked folder, AI analysis, AI instructions, chapters, content, export preferences, integration, projects, source material, and text extraction.

2. [LOW] Frontend: 14 test files, 154 tests — all passing. Covers hooks (chapter management, AI rewrite, chapter content, editor title, auto save, editor project, project actions, editor init order), components (editor sidebar, writing area, toolbar), extensions (footnote, clip insert), and library (IndexedDB).

3. [MEDIUM] No tests for dashboard page (`web/src/app/(protected)/dashboard/page.tsx`, 502 lines). Has project CRUD, import, overflow menus, and routing logic. Recommendation: Add tests for project list rendering and overflow menu actions.

4. [MEDIUM] No tests for export menu (`web/src/components/project/export-menu.tsx`, 787 lines). Complex state management with export + drive save + delivery phases + preferences. Recommendation: Add tests for the export flow state machine and destination picker interactions.

5. [LOW] Integration test at `workers/dc-api/test/integration.test.ts` covers full request lifecycle: authentication, project CRUD, chapter management, content save/load, export generation with download, and backup.

6. [LOW] Both workspaces use Vitest. API uses `@cloudflare/vitest-pool-workers` for Workers runtime compatibility. Web uses `jsdom` with `@testing-library/react`. Infrastructure is solid.

**Grade: B**
**Rationale:** Massive improvement from the previous review (D → B). Frontend went from zero tests to 154 across 14 files. Backend has comprehensive 528-test suite. Gaps remain in dashboard and export menu testing, but critical paths are covered. Test-to-code ratio is healthy for Phase 0.

---

### 5. Dependencies

**Findings:**

1. [LOW] `npm audit` — dc-api: 0 vulnerabilities. web: 1 moderate (`ajv <6.14.0` ReDoS with `$data` option, GHSA-2g4f-4pwh-qvx6). Fixable via `npm audit fix`. Dev-dependency only. Recommendation: Run `npm audit fix`.

2. [LOW] `npm outdated` — Minor/patch updates available for `hono`, `svix`, `wrangler`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`. `vitest` in dc-api is pinned to `~3.2.0` for `@cloudflare/vitest-pool-workers` compatibility. No critical version gaps.

3. [MEDIUM] Root devDependencies (`docx`, `mammoth`, `pdf-lib`, `unpdf`) are script-only. Same finding as Code Quality #2. Recommendation: Document or relocate.

4. [LOW] Dependency count is lean and appropriate. Backend: 7 runtime deps. Frontend: 13 runtime deps. No bloat.

5. [LOW] `overrides` in root `package.json` pins `minimatch@^10.2.1` for a known vulnerability fix. Appropriate.

6. [LOW — RESOLVED] Previously flagged `ulid` package has been replaced with `ulidx` (actively maintained).

7. [LOW — RESOLVED] Previously flagged `wrangler` OS Command Injection vulnerability has been resolved (current version 4.67.0).

8. [LOW — RESOLVED] Previously flagged `markdown-it` moderate vulnerabilities no longer appear in audit.

**Grade: B**
**Rationale:** One moderate audit finding in dev dependencies, trivially fixable. All previously flagged dependency issues resolved. Lean dependency tree with no unused production dependencies.

---

### 6. Documentation

**Findings:**

1. [LOW] CLAUDE.md is comprehensive: tech stack table, API routes table, key files, build commands, enterprise rules, secrets management, design principles, CI configuration, security practices. One of the most thorough CLAUDE.md files reviewed.

2. [LOW] README.md covers directory structure, local development setup (prerequisites, installation, running, secrets), and quality checks. Appropriate for a private repository.

3. [LOW] Database schema documented through 22 sequential migration files, each descriptively named.

4. [LOW] API routes documented in CLAUDE.md and via JSDoc comments with PRD section references.

5. [LOW] Services have thorough JSDoc explaining purpose, parameters, and behavior with PRD traceability.

6. [MEDIUM] No formal external API documentation (OpenAPI/Swagger). Routes are well-documented internally but no generated spec for external consumers. Acceptable for Phase 0 but will need addressing before any third-party API access.

**Grade: B**
**Rationale:** Internal documentation is excellent. CLAUDE.md, code comments, and migration files provide comprehensive coverage. External API docs are the main gap, acceptable for current phase.

---

### 7. Golden Path Compliance

**Findings:**

1. [PASS] Source control: Git repo on GitHub with PR workflow. CI runs on push to main and PRs.
2. [PASS] CLAUDE.md: Comprehensive and actively maintained.
3. [PASS] TypeScript: `strict: true` in both workspaces. Zero `any` usage. `forceConsistentCasingInFileNames: true`.
4. [PASS] ESLint: Configured in web via `eslint-config-next/core-web-vitals` + TypeScript rules.
5. [PASS] No hardcoded secrets. Managed via Infisical with `wrangler secret put`.
6. [PASS] CI pipeline: `.github/workflows/ci.yml` — lint, typecheck (both workspaces), format check, tests (both workspaces). Three parallel jobs.
7. [PASS] Prettier: Root-level configuration. CI enforces `prettier --check`. `npm run format` available.
8. [PASS — NEW] PR template exists at `.github/PULL_REQUEST_TEMPLATE.md`. Previously flagged as missing.
9. [PASS — NEW] Frontend tests now included in CI (`test-web` job). Previously flagged as missing.

**Grade: A**
**Rationale:** All Tier 1 requirements met. Both previously missing items (PR template, frontend test CI) have been added. No exceptions.

---

## Trend Analysis

### Grade Progression

| Dimension     | Feb 17 | Feb 19 | Feb 23 | Trend        |
| ------------- | ------ | ------ | ------ | ------------ |
| Architecture  | C      | C      | B      | Improved     |
| Security      | C      | C      | A      | Improved     |
| Code Quality  | C      | C      | B      | Improved     |
| Testing       | D      | C      | B      | Improved     |
| Dependencies  | C      | C      | B      | Improved     |
| Documentation | B      | C      | B      | Recovered    |
| Golden Path   | B      | B      | A      | Improved     |
| **Overall**   | **C**  | **C**  | **B**  | **Improved** |

### Key Improvements Since Feb 17

- Editor god component decomposed: 1,257 → 327 lines (7 hooks + 4 sub-components)
- Frontend tests: 0 → 154 tests across 14 files
- Security remediations: Drive query injection fixed, Content-Disposition injection fixed
- DRY violations: 3 groups → 1 remaining (word count)
- Dependencies: `ulid` → `ulidx`, wrangler vulnerability resolved, markdown-it resolved
- Golden Path: PR template added, frontend test CI added

### Issue Resolution

21 of 24 code-review issues resolved (87.5% closure rate).

## File Manifest

| Type             | Count       |
| ---------------- | ----------- |
| TypeScript (.ts) | 148         |
| React (.tsx)     | 52          |
| Markdown (.md)   | 38          |
| JSON (.json)     | 21          |
| Shell (.sh)      | 3           |
| YAML (.yml)      | 2           |
| TOML (.toml)     | 2           |
| YAML (.yaml)     | 1           |
| CSS (.css)       | 1           |
| **Total lines**  | **~46,450** |

## Raw Model Outputs

### Claude Review

Performed by Claude Opus 4.6 general-purpose agent reviewing all 7 dimensions with full source code reads. Agent examined 50+ files across both workspaces including all routes, services, middleware, hooks, components, test files, configuration, and documentation.

### Codex Review

Skipped (Phase 1 — Claude-only)

### Gemini Review

Skipped (Phase 1 — Claude-only)
