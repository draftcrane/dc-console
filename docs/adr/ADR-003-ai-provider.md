# ADR-003: AI Provider - OpenAI for Phase 0

## Status

**Accepted** - 2026-02-16

## Context

DraftCrane's PRD originally specified Anthropic Claude as the AI provider. During strategic review, a misalignment surfaced: DraftCrane targets non-technical professionals who know Google Drive and ChatGPT - not Anthropic. These users won't sign up for new services or understand API keys.

We evaluated delivering DraftCrane as a ChatGPT App (OpenAI Apps SDK). Research found a critical blocker: **OpenAI prohibits digital product sales, subscriptions, and SaaS monetization inside ChatGPT apps.** Additional constraints include no passthrough to the user's Google Drive (still requires separate OAuth), no control over AI prompts/tone, unstable iPad experience (the primary device), and a 2-month-old platform.

**Key factors:**

- The target user knows "ChatGPT" as a brand - the AI should feel familiar
- OpenAI API is a drop-in replacement (same streaming SSE pattern, similar prompt structure)
- Venture absorbs API costs during Phase 0 validation (trivial for 5-10 test users)
- DraftCrane controls the full UX (editor, prompts, AI behavior, iPad experience)
- Monetization is straightforward (SaaS subscription when validated)
- No platform dependency on OpenAI's app policies

## Decision

**Keep the standalone app architecture. Swap Anthropic for OpenAI as the initial AI provider. Design for provider-agnostic future.**

### Provider-Agnostic Design

- The UI says "AI" everywhere - never "ChatGPT," "OpenAI," or any provider name
- The service layer abstracts the provider behind an `AIProvider` interface
- Phase 0 ships with `OpenAIProvider` (GPT-4o) because that's the ecosystem the target user inhabits
- Post-validation, users choose their preferred AI provider

### Implementation

- `AIProvider` interface in `services/ai-provider.ts` exposes `streamCompletion()` returning normalized `AIStreamEvent` objects (`token`, `done`, `error`)
- `OpenAIProvider` implements the interface with proper SSE event-boundary buffering
- `AIRewriteService` takes an `AIProvider` instead of a raw API key
- Model configurable via `AI_MODEL` env var (default: `gpt-4o`)
- `OPENAI_API_KEY` replaces `ANTHROPIC_API_KEY` in secrets

## Consequences

### Positive

- Target users get AI that feels like the "ChatGPT" they already know
- Full control over UX, prompts, and iPad experience
- Clean provider abstraction makes future swaps trivial
- Straightforward SaaS monetization path
- SSE stream chunk-boundary bug fixed during the refactor

### Negative

- Slightly higher per-token cost (GPT-4o vs Claude Sonnet)
- Prompt behavior may differ slightly (tested and acceptable for rewrite use case)

### What We're NOT Doing

- Building a ChatGPT App (no monetization path, immature platform)
- Exposing any provider name in the UI
- Building multi-provider selection UI in Phase 0 (interface exists for future use)
- Gold-plating before validation

## References

- PRD Section 8: AI integration requirements
- ADR-001: Editor library selection (Tiptap)
- OpenAI Apps SDK Terms of Service (monetization prohibition)
