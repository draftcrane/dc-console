# Parallelization Plan - P0 Issues

Generated: 2026-02-09

## Executive Summary

**Maximum reliable parallel streams: 2-3**

The P0 issues have significant dependencies that limit parallelization. However, we can achieve meaningful concurrency by:
1. Separating backend from frontend work (with shared type contracts)
2. Working on independent file domains simultaneously
3. Pipelining: starting infrastructure while completing prerequisites

---

## Dependency Analysis

```
                    ┌─────────────────────────────────────────┐
                    │           SHARED TYPES                   │
                    │    (contracts between streams)           │
                    └──────────────┬──────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   ┌──────────────┐       ┌──────────────┐        ┌──────────────┐
   │ STREAM A     │       │ STREAM B     │        │ STREAM C     │
   │ Backend API  │       │ Frontend UI  │        │ Infrastructure│
   └──────┬───────┘       └──────┬───────┘        └──────┬───────┘
          │                      │                       │
          ▼                      ▼                       ▼
   #19 Projects API       #21 Editor Component    AI Client Setup
          │                      │                 (Anthropic SDK)
          ▼                      │                       │
   #20 Chapters API              │                Export Worker
          │                      │                 (PDF/EPUB libs)
          └──────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     INTEGRATION         │
                    │  (streams converge)     │
                    └─────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
   #22 Sidebar            #26 Auto-save          #30 Selection Bar
                                 │                      │
                                 ▼                      ▼
                          #31 AI Rewrite          #33 Export UI
                                 │
                                 ▼
                          #32 Accept/Reject
```

---

## File Domain Separation

| Domain | Files | Owner |
|--------|-------|-------|
| **Projects API** | `workers/dc-api/src/routes/projects.ts`, `services/projects.ts` | Stream A |
| **Chapters API** | `workers/dc-api/src/routes/chapters.ts`, `services/chapters.ts` | Stream A |
| **Editor Component** | `web/src/components/editor/**` | Stream B |
| **Sidebar Component** | `web/src/components/sidebar/**` | Stream B |
| **AI Backend** | `workers/dc-api/src/routes/ai.ts`, `services/ai.ts` | Stream C |
| **Export Backend** | `workers/dc-api/src/routes/exports.ts`, `services/exports.ts` | Stream C |
| **Shared Types** | `workers/dc-api/src/types/`, `web/src/types/` | Foundation (first) |

---

## Phased Execution Plan

### Phase 0: Foundation (Sequential - Must Complete First)
**Duration:** Initial setup
**Goal:** Define contracts that enable parallel work

| Task | Description | Files |
|------|-------------|-------|
| Shared API Types | Request/response shapes for all endpoints | `src/types/api.ts` |
| Editor Types | TipTap document format, selection events | `src/types/editor.ts` |
| AI Types | Rewrite request/response, SSE event shapes | `src/types/ai.ts` |
| Export Types | Job status, format options | `src/types/export.ts` |

**Output:** Type definitions that both backend and frontend teams use.

---

### Phase 1: Core APIs + Editor Shell (2-3 Parallel Streams)

#### Stream A: Backend API (Sequential within stream)
| Issue | Task | Depends On |
|-------|------|------------|
| #19 | `POST /projects`, `GET /projects`, `GET /projects/:id` | Types |
| #20 | `POST /projects/:id/chapters`, `GET /chapters/:id`, `PATCH /chapters/:id` | #19 |

**Files touched:**
- `workers/dc-api/src/routes/projects.ts`
- `workers/dc-api/src/routes/chapters.ts`
- `workers/dc-api/src/services/projects.ts`
- `workers/dc-api/src/services/chapters.ts`

#### Stream B: Editor Component (Can start with mock data)
| Issue | Task | Depends On |
|-------|------|------------|
| #21 | TipTap editor setup, toolbar, formatting commands | Types only |

**Files touched:**
- `web/src/components/editor/Editor.tsx`
- `web/src/components/editor/Toolbar.tsx`
- `web/src/components/editor/extensions/`
- `web/src/lib/editor.ts`

**Note:** Uses mock chapter data until Stream A completes API.

#### Stream C: Infrastructure Scaffolding (Independent)
| Task | Description |
|------|-------------|
| Anthropic Client | SDK setup, error handling, rate limit tracking |
| Export Worker | PDF/EPUB library integration, R2 upload helpers |

**Files touched:**
- `workers/dc-api/src/services/ai-client.ts`
- `workers/dc-api/src/services/export-worker.ts`
- `workers/dc-api/src/lib/anthropic.ts`

---

### Phase 2: Integration + Features (2-3 Parallel Streams)

#### Stream A: Navigation & Persistence
| Issue | Task | Depends On |
|-------|------|------------|
| #22 | Chapter sidebar, navigation, responsive layout | #20 API |
| #26 | Auto-save (IndexedDB → R2 → D1 three-tier) | #21 Editor |

#### Stream B: AI Rewrite Chain (Sequential)
| Issue | Task | Depends On |
|-------|------|------------|
| #30 | Floating selection bar, text selection events | #21 Editor |
| #31 | SSE endpoint, bottom sheet UI, streaming display | #30, AI client |
| #32 | Accept/reject actions, text replacement | #31 |

#### Stream C: Export Flow
| Issue | Task | Depends On |
|-------|------|------------|
| #33 | Export UI, job tracking, download handling | Export worker |

---

## Recommended Team Allocation

### Option A: Two Parallel Streams (Conservative)
```
Stream 1 (Full-stack): #19 → #20 → #21 → #22 → #26
Stream 2 (AI Focus):   Infrastructure → #30 → #31 → #32
Export:                After Stream 1 completes #21
```
**Risk:** Lower parallelism, but fewer coordination issues.

### Option B: Three Parallel Streams (Aggressive)
```
Stream 1 (Backend):    #19 → #20 → API for #22, #26
Stream 2 (Frontend):   #21 → #22 → #26 (frontend parts)
Stream 3 (AI/Export):  AI client → #30 → #31 → #32 → Export
```
**Risk:** Requires tight type contracts and integration checkpoints.

---

## Coordination Requirements

### Shared Types Contract
Before parallel work begins, define and freeze:
```typescript
// Project & Chapter shapes
interface Project { id: string; title: string; ... }
interface Chapter { id: string; projectId: string; content: JSONContent; ... }

// Editor events
interface SelectionEvent { from: number; to: number; text: string; }
interface ContentChange { type: 'insert' | 'delete' | 'format'; ... }

// AI shapes
interface RewriteRequest { text: string; instruction: string; }
interface RewriteChunk { type: 'token' | 'complete' | 'error'; content: string; }
```

### Integration Checkpoints
| Checkpoint | When | What to Verify |
|------------|------|----------------|
| API Ready | After Phase 1 Stream A | Frontend can fetch real data |
| Editor Ready | After Phase 1 Stream B | Selection events fire correctly |
| AI Ready | After Phase 2 #31 | SSE streaming works end-to-end |

### Git Strategy
- **Main branch:** Protected, requires PR review
- **Feature branches:** `feat/<issue-number>-<short-name>`
- **Integration branch:** `integration/phase-1` for merging streams before main

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Type contract changes mid-stream | Version types, communicate changes immediately |
| Merge conflicts in shared files | Assign clear file ownership per stream |
| Integration bugs at checkpoints | Write integration tests before merging |
| Scope creep within issues | Stick to acceptance criteria, defer "nice to haves" |

---

## Recommended Starting Point

**Immediate action (this session):**
1. Create shared types file with all API contracts
2. Start #19 (Projects API) - unblocks everything else
3. If time permits, scaffold #21 (Editor) with mock data

**Next session:**
- Continue #20 (Chapters API)
- Begin #21 (Editor) implementation in parallel

---

## Summary Table

| Phase | Streams | Issues | Max Parallelism |
|-------|---------|--------|-----------------|
| 0 | 1 | Types/Contracts | 1 |
| 1 | 2-3 | #19, #20, #21, Infrastructure | 3 |
| 2 | 2-3 | #22, #26, #30, #31, #32, #33 | 3 |

**Total reliable parallel capacity: 2-3 concurrent workstreams**

The limiting factor is the editor (#21) - almost everything depends on it existing. Once the editor is in place, parallelism options expand significantly.
