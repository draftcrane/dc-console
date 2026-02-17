# ADR-006: Multi-Tier AI (Edge + Frontier)

## Status

**Accepted** - 2026-02-17

## Context

User testing revealed AI rewrite latency is too high. GPT-4o (frontier tier) takes 2-5+ seconds to first token when routed through the OpenAI API. Combined with the original implementation that accumulated all tokens before showing results, perceived latency equaled the full streaming duration.

Cloudflare Workers AI provides edge inference that can dramatically reduce time-to-first-token (TTFT) by running models on the same network as the worker. The GLM-4.7-Flash model is available and suitable for common rewrite tasks (grammar, clarity, concision).

## Decision

Implement a two-tier AI architecture:

1. **Edge tier** (`@cf/zai-org/glm-4.7-flash` via Workers AI binding) — fast, runs on Cloudflare edge. Default for initial rewrites.
2. **Frontier tier** (GPT-4o via OpenAI API) — higher quality, higher latency. Available via "Go Deeper" escalation.

The frontend defaults to `edge` tier. After seeing the edge result, the user can tap "Go Deeper" to re-run the same instruction through the frontier model. This is a fresh rewrite, not a refinement of the edge result.

The default tier is controlled by `AI_DEFAULT_TIER` in wrangler.toml vars, initially set to `"frontier"` until edge quality is validated via B0 quality gate.

## Rationale

- **Latency**: Edge inference eliminates the internet round-trip. Expected TTFT < 1 second vs 2-5+ seconds.
- **Cost**: Workers AI is included in the Cloudflare Workers plan. Edge rewrites have zero marginal API cost.
- **Quality tradeoff**: GLM-4.7-Flash is adequate for "Improve this text" style instructions but may underperform on nuanced creative requests. The "Go Deeper" escape hatch addresses this.
- **Progressive disclosure**: Most rewrites don't need frontier quality. Users who want more can escalate explicitly.
- **Infrastructure simplicity**: Workers AI is a binding — no new external service, no API key management.

## Implementation

- `WorkersAIProvider` implements the same `AIProvider` interface as `OpenAIProvider`
- Workers AI streaming format (`{"response":"..."}`) is handled by a separate transform function
- `tier` column added to `ai_interactions` table for analytics
- `AI_DEFAULT_TIER` env var controls which tier is used by default
- Both tiers share the same rate limit counter (10 req/min)

## Quality Gate (B0)

Before flipping `AI_DEFAULT_TIER` to `"edge"`:

- Run 20-30 representative rewrite scenarios through GLM-4.7-Flash
- Compare against GPT-4o on same inputs
- Pass criteria: acceptable for grammar/clarity/concision instructions
- If quality is insufficient, keep frontier as default and revisit when better edge models are available

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
