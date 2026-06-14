# Agent Notes

## Project Overview

`codex-stats` is a Bun TypeScript CLI that reads local Codex state from `~/.codex` and renders concise usage reports.

The CLI supports:

- `report [day]`: daily reports for `yesterday` or `YYYY-MM-DD`.
- `month [month]`: monthly reports for `this-month` or `YYYY-MM`.
- `tui [day]`: an OpenTUI dashboard with keyboard filters.

## Development Commands

Use Bun for all project tasks:

```bash
bun run index.ts report yesterday
bun run index.ts month this-month
bun run index.ts tui
bun run typecheck
```

Do not use `npm`, `pnpm`, `yarn`, `node`, or `npx` equivalents unless the project is intentionally migrated.

## TUI Controls

Keep the in-app filter hints visible near the top of the dashboard. Current controls:

- `y`: yesterday.
- `t` or `d`: today.
- `m`: this month.
- `←` or `h`: previous day/month.
- `→` or `l`: next day/month.
- `q`: quit.

When adding period filters, update both `README.md` and the TUI hint in `src/render.ts`.

## Data Rules

- Time windows are resolved in `Asia/Kolkata`.
- Sessions are assigned to the period in which they started.
- Monthly reports aggregate the same session ownership rule used by daily reports.
- Calendar period is the selected day/month duration; thread span is summed session lifetime and can exceed calendar hours.
- Token totals prefer `threads.tokens_used`, falling back to max cumulative token events from rollout JSONL.
- Cost is an estimated OpenAI API Standard price only, not actual Codex or ChatGPT billing.
- Keep Standard pricing updates in `src/pricing.ts` with a source URL and checked date.
- Use long-context rates only when a priced model has them and rollout telemetry shows a prompt over 272K input tokens.
- Keep report output concise by default; use verbose mode for session-level detail.

## Implementation Notes

- Report construction lives in `src/report.ts`.
- Date and month window handling lives in `src/time.ts`.
- Standard pricing estimates live in `src/pricing.ts`.
- Text rendering lives in `src/render.ts`.
- TUI state and keyboard handling live in `src/tui.ts`.

Run `bun run typecheck` after TypeScript changes.
