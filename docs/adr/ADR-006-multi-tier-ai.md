# ADR-006: Multi-Tier AI (Edge + Frontier)

## Status

**Accepted** - 2026-02-17

## Context

User testing revealed AI rewrite latency is too high. GPT-4o (frontier tier) takes 2-5+ seconds to first token when routed through the OpenAI API. Combined with the original implementation that accumulated all tokens before showing results, perceived latency equaled the full streaming duration.

Cloudflare Workers AI provides edge inference that can dramatically reduce time-to-first-token (TTFT) by running models on the same network as the worker. Mistral Small 3.1 24B is a strong English-native instruction-following model available on Workers AI.

## Decision

Implement a two-tier AI architecture:

1. **Edge tier** (`@cf/mistralai/mistral-small-3.1-24b-instruct` via Workers AI binding) — fast, runs on Cloudflare edge. Default for initial rewrites.
2. **Frontier tier** (GPT-4o via OpenAI API) — higher quality, higher latency. Available via "Go Deeper" escalation.

The frontend defaults to `edge` tier. After seeing the edge result, the user can tap "Go Deeper" to re-run the same instruction through the frontier model. This is a fresh rewrite, not a refinement of the edge result.

The default tier is controlled by `AI_DEFAULT_TIER` in wrangler.toml vars, initially set to `"frontier"` until edge quality is validated via B0 quality gate.

## Rationale

- **Latency**: Edge inference eliminates the internet round-trip. Expected TTFT < 1 second vs 2-5+ seconds.
- **Cost**: Workers AI is included in the Cloudflare Workers plan. Edge rewrites have zero marginal API cost.
- **Quality tradeoff**: Mistral Small 3.1 is a 24B dense English-native model with strong instruction following, adequate for common rewrite tasks (grammar, clarity, concision). The "Go Deeper" escape hatch addresses cases where frontier quality is needed.
- **Progressive disclosure**: Most rewrites don't need frontier quality. Users who want more can escalate explicitly.
- **Infrastructure simplicity**: Workers AI is a binding — no new external service, no API key management.
- **128K context window**: Ample headroom for chapter-length context.
- **Neuron-priced**: Covered by free 10K neurons/day (~217 medium rewrites/day at Phase 0 scale).

## Implementation

- `WorkersAIProvider` implements the same `AIProvider` interface as `OpenAIProvider`
- Workers AI streaming format (`{"response":"..."}`) is handled by a separate transform function
- `tier` column added to `ai_interactions` table for analytics
- `AI_DEFAULT_TIER` env var controls which tier is used by default
- Both tiers share the same rate limit counter (10 req/min)

## Quality Gate (B0)

Before flipping `AI_DEFAULT_TIER` to `"edge"`:

1. Run `scripts/ai-quality-gate.ts` — 10 representative rewrite scenarios across 5 instruction types and 2 genres
2. Both tiers process the same inputs using production prompts (imported from `ai-rewrite.ts`)
3. Outputs are written to `docs/adr/ADR-006-quality-gate-results.md` as blind A/B pairs (random label assignment)
4. Human reviewer reads each pair, judges quality, then checks the reveal key
5. **Pass criteria**: Edge output is acceptable for all 5 instruction types (grammar, clarity, concision, expansion, tone shift). Minor quality differences vs frontier are acceptable; failures to follow instructions or hallucination are not.
6. If quality is insufficient, keep frontier as default and evaluate alternative edge models

## Cost Analysis

| Tier              | Cost                     | TTFT          |
| ----------------- | ------------------------ | ------------- |
| Edge (Workers AI) | Included in plan         | < 1s expected |
| Frontier (GPT-4o) | ~$0.005-0.02 per rewrite | 2-5s          |

At Phase 0 scale (5-10 users), frontier costs are negligible. Edge-first reduces costs as usage scales.

## Consequences

- **Positive**: Dramatically improved perceived latency for most rewrites
- **Positive**: Zero marginal cost for edge rewrites
- **Positive**: Users have explicit control over quality/speed tradeoff
- **Negative**: Two code paths for AI streaming (OpenAI SSE vs Workers AI SSE formats)
- **Negative**: Edge model quality may not match frontier for all instruction types
- **Risk**: Workers AI model availability and quality may change; `AI_DEFAULT_TIER` provides a quick rollback

## Model Change History

| Date       | Edge Model                                     | Reason                                                                                                                                                                                                                                              |
| ---------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-17 | `@cf/zai-org/glm-4.7-flash`                    | Initial selection — 30B MoE (3B active), fast inference                                                                                                                                                                                             |
| 2026-02-17 | `@cf/mistralai/mistral-small-3.1-24b-instruct` | GLM-4.7-Flash unsuitable: only 3B active params, Chinese-origin with CCP censorship patterns, poor English nonfiction quality. Mistral Small 3.1 is 24B dense, English-native, strong instruction following, standard Workers AI `messages` format. |
