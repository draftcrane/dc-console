# DC Console

Central infrastructure and documentation hub for the dc venture.

## Quick Start

```bash
# Start a work session
/sod

# End a work session
/eod
```

## Directory Structure

```
dc-console/
├── .claude/commands/     # Claude Code slash commands
├── .github/              # Issue templates, workflows
├── docs/                 # Documentation
│   ├── adr/              # Architecture Decision Records
│   ├── pm/               # PM documents (PRD, specs)
│   └── process/          # Process documentation
├── web/                  # Next.js 16 frontend
├── workers/              # Cloudflare Workers
│   └── dc-api/           # Main API worker (Hono)
└── scripts/              # Utility scripts
```

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install               # Install all workspace dependencies
```

### Running locally

```bash
# Frontend (port 3000)
cd web && npm run dev

# API worker (port 8787)
cd workers/dc-api && npx wrangler dev

# Apply database migrations (local D1)
cd workers/dc-api && npx wrangler d1 migrations apply dc-main --local
```

### Secrets

Secrets are managed via [Infisical](https://infisical.com) at path `/dc`. To launch a session with secrets injected:

```bash
crane dc
```

### Quality checks

```bash
npm run lint              # ESLint across all workspaces
npm run typecheck         # TypeScript validation
npm test                  # Run all tests
npm run format            # Format with Prettier
```
