# CLAUDE.md - DC Console

This file provides guidance for Claude Code agents working in this repository.

## About This Repository

DC Console is the monorepo for DraftCrane (dc) - a browser-based nonfiction book writing environment with AI assistance. It contains:

- **web/** - Next.js 16 frontend with Clerk authentication and Tiptap editor
- **workers/** - Cloudflare Workers for backend services
  - `dc-api/` - Main API worker (Hono) - auth, projects, chapters, Google Drive, AI rewrite
- **docs/** - Technical documentation, ADRs, handoffs, planning
- **scripts/** - Automation scripts

## Session Start

At the start of every session, initialize your context:

1. Call the `crane_preflight` MCP tool (no arguments)
2. Call the `crane_sod` MCP tool with `venture: "dc"`

This creates a session in the Context Worker, downloads venture documentation, and establishes context for handoffs.

**Read `docs/process/dc-project-instructions.md` before making any infrastructure or stack decisions.** It defines the tech stack, coding standards, quality requirements, and Phase 0 scope. Deviations require an ADR.

## Enterprise Rules

- **All changes through PRs.** Never push directly to main. Branch, PR, CI, QA, merge.
- **Never echo secret values.** Transcripts persist in ~/.claude/ and are sent to API providers. Pipe from Infisical, never inline.
- **Verify secret VALUES, not just key existence.** Agents have stored descriptions as values before.
- **Never auto-save to VCMS** without explicit Captain approval.
- **Scope discipline.** Discover additional work mid-task - finish current scope, file a new issue.
- **Escalation triggers.** Credential not found in 2 min, same error 3 times, blocked >30 min - stop and escalate.

## Secrets Management

Secrets are managed through **Infisical** at path `/dc`. Never hardcode secrets.

```bash
# Launch agent with DC secrets injected
crane dc

# Or manually
infisical run --path /dc -- claude

# Add a new secret
infisical secrets set NEW_KEY="value" --path /dc --env dev
```

Worker secrets are provisioned by piping from Infisical - never echo values inline. See Enterprise Rules above.

## Build Commands

### Root (monorepo)

```bash
npm install             # Install all workspace dependencies
npm run lint            # Lint all workspaces
npm run typecheck       # Typecheck all workspaces
npm run test            # Test all workspaces
npm run format          # Format all files with Prettier
npm run format:check    # Check formatting (CI uses this)
```

### Frontend (web/)

```bash
cd web
npm run dev             # Local dev server (port 3000)
npm run build           # Production build
npm run lint            # ESLint check
npm run typecheck       # TypeScript validation
```

**Deployment:** Vercel auto-deploys from GitHub on push to `main`. Do NOT run `npx vercel` manually - just push and Vercel handles it. Live at `draftcrane.app`.

### API Worker (workers/dc-api/)

```bash
cd workers/dc-api
npx wrangler dev        # Local dev server (port 8787)
npx wrangler deploy     # Deploy to Cloudflare
npx tsc --noEmit        # TypeScript validation
npm test                # Run Vitest tests
```

**Deployment:** Cloudflare Workers. The API worker is deployed at `dc-api.automation-ab6.workers.dev`.

### Database Migrations

```bash
cd workers/dc-api
npx wrangler d1 migrations apply dc-main --local   # Local
npx wrangler d1 migrations apply dc-main --remote  # Production
```

Migrations are forward-only and numbered sequentially in `workers/dc-api/migrations/`.

## Tech Stack

| Layer          | Technology                                       | Notes                                         |
| -------------- | ------------------------------------------------ | --------------------------------------------- |
| Frontend       | Next.js 16, React 19, Tailwind CSS               | Tiptap editor for writing                     |
| Auth           | Clerk                                            | Email + Google OAuth                          |
| Frontend Host  | Vercel                                           | draftcrane.app                                |
| Backend        | Cloudflare Workers (Hono)                        | dc-api worker                                 |
| Database       | Cloudflare D1 (dc-main)                          | Projects, chapters, metadata                  |
| Object Storage | Cloudflare R2 (dc-exports)                       | Export artifacts, image cache                 |
| Cache          | Cloudflare KV (dc-cache)                         | Rate limiting, session data                   |
| File Storage   | Google Drive (user's account)                    | Canonical manuscript storage                  |
| AI             | Workers AI (Mistral Small 3.1) / OpenAI (gpt-4o) | Edge tier + frontier tier (default: frontier) |

## Cloudflare Resources

| Type | Name       | Binding          |
| ---- | ---------- | ---------------- |
| D1   | dc-main    | `DB`             |
| R2   | dc-exports | `EXPORTS_BUCKET` |
| KV   | dc-cache   | `CACHE`          |

## API Routes

| Method | Path                        | Purpose                    |
| ------ | --------------------------- | -------------------------- |
| GET    | /health                     | Health check               |
| \*     | /auth/\*                    | Clerk webhook, user sync   |
| \*     | /users/\*                   | User management            |
| \*     | /drive/\*                   | Google Drive OAuth + sync  |
| \*     | /projects/\*                | Project CRUD               |
| \*     | /chapters/\*                | Chapter CRUD               |
| POST   | /ai/rewrite                 | AI rewrite (SSE streaming) |
| POST   | /ai/interactions/:id/accept | Accept AI result           |
| POST   | /ai/interactions/:id/reject | Reject AI result           |

## Key Files

- `web/src/app/(protected)/` - Authenticated pages (dashboard, editor, setup)
- `web/src/components/chapter-editor.tsx` - Tiptap rich text editor
- `web/src/components/ai-rewrite-sheet.tsx` - AI rewrite UI
- `workers/dc-api/src/index.ts` - Route mounting
- `workers/dc-api/src/routes/` - One file per domain
- `workers/dc-api/src/services/` - Business logic (no HTTP concerns)
- `workers/dc-api/src/types/env.ts` - Environment bindings type
- `workers/dc-api/migrations/` - D1 schema migrations
- `docs/adr/` - Architecture Decision Records
- `docs/process/dc-project-instructions.md` - Full project instructions and standards

## Slash Commands

Session start uses MCP tools (see Session Start above). Additional workflow commands are available in `.claude/commands/`. Key commands include `/eod` for end-of-day handoffs, `/status` for work queue, and `/critique` for plan review.

## Instruction Modules

Detailed domain instructions stored as on-demand documents.
Fetch the relevant module when working in that domain.

| Module              | Key Rule (always applies)                                                | Fetch for details                             |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| `secrets.md`        | Verify secret VALUES, not just key existence                             | Infisical, vault, API keys, GitHub App        |
| `content-policy.md` | Never auto-save to VCMS; agents ARE the voice                            | VCMS tags, storage rules, editorial, style    |
| `team-workflow.md`  | All changes through PRs; never push to main                              | Full workflow, QA grades, escalation triggers |
| `fleet-ops.md`      | Bootstrap phases IN ORDER: Tailscale > CLI > bootstrap > optimize > mesh | SSH, machines, Tailscale, macOS               |

Fetch with: `crane_doc('global', '<module>')`

## Design Principles

1. **iPad-first.** Safari on iPad is the primary test target. No desktop-only patterns.
2. **User files are sacred.** Manuscripts live in the user's Google Drive. We index and cache, never become the canonical store.
3. **AI assists, never replaces.** Every AI action requires user approval. No silent rewrites.
4. **Phase 0 only.** Do not build Phase 1+ features until Phase 0 is validated. See `docs/process/dc-project-instructions.md` for scope.

## Pre-commit / CI

- **Prettier** formats on commit (if husky configured)
- **CI** runs lint, typecheck, format check, and tests on PR and push to main
- Never merge with red CI. Fix root cause, not symptoms.

## Security

- Never commit secrets - use Infisical (`/dc` path) and `wrangler secret`
- Parameterized queries only (always `.bind()` for D1)
- OAuth tokens stored server-side, encrypted with AES-256-GCM
- User content isolation enforced at the query level
- No wildcard CORS in production

## Related Documentation

- `docs/process/dc-project-instructions.md` - **Read this first.** Product requirements, tech stack, coding standards, Phase 0 scope.
- `docs/pm/prd.md` - Full Product Requirements Document
- `docs/adr/` - Architecture Decision Records (ADR-001: Tiptap editor selection)
- `docs/handoffs/DEV.md` - Latest dev team handoff
