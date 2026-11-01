# ProjectCV: instructions for Claude

Every change in this repo follows the Karpathy guidelines, installed as the
`andrej-karpathy-skills` plugin (see `.claude/settings.json`, source:
https://github.com/multica-ai/andrej-karpathy-skills). Load the
`karpathy-guidelines` skill before writing, reviewing or refactoring code:

1. Think before coding: state assumptions, surface tradeoffs, ask when unclear.
2. Simplicity first: the minimum code that solves the problem.
3. Surgical changes: touch only what the request needs.
4. Goal-driven execution: define a check, then loop until it passes.

Project rules:
- The two dashboards in `src/legacy/admin/` (Super Admin) and the "Who saw your page"
  card (`src/components/stats/WhoSawCard.tsx`) are the owner's designs. Keep their
  markup, CSS and three.js scenes as they are; only the data feeding them may change.
- No em or en dashes in UI copy. Sentence case. No emoji.
- Check command: `bash ./verify` (types, lint, unit + DB tests, build, e2e).
- Next.js 16: read `node_modules/next/dist/docs/` before using an API you are unsure of.
