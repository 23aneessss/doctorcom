# Agent Instructions

Use `agents/AGENTS.md` as the main repository guide.

When the user provides a Figma link, use the configured `figma` MCP server first, then implement the design in `apps/web` using the existing React + Tailwind patterns.

For local frontend + backend development, run:

```bash
bun run dev:app
```

This starts:

- Web: `http://localhost:3001`
- Server: `http://localhost:3000`
