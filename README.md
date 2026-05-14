# codex-stats

Brief local Codex usage reports from `~/.codex`.

Created by Codex.

## Usage

Run a daily report:

```bash
bun run index.ts report yesterday
bun run index.ts report yesterday --mode verbose
bun run index.ts report 2026-05-12 --mode verbose
```

Run a monthly report:

```bash
bun run index.ts month this-month
bun run index.ts month 2026-05 --mode verbose
```

Open the TUI:

```bash
bun run index.ts tui
bun run index.ts tui 2026-05-12
bun run index.ts tui --month this-month
bun run index.ts tui --month 2026-05
```

If the package is linked as a binary, the same commands are available through `codex-stats`:

```bash
codex-stats report yesterday
codex-stats month this-month
codex-stats tui
```

## TUI Filters

The TUI has built-in period filters so you do not need to remember CLI flags while browsing usage:

- `y`: switch to yesterday.
- `t` or `d`: switch to today.
- `m`: switch to this month.
- `←` or `h`: move to the previous day or previous month.
- `→` or `l`: move to the next day or next month.
- `q`: quit.

The previous and next shortcuts keep the current period type. If you are viewing a day, they move by one day. If you are viewing a month, they move by one month.

## Report Model

The report uses the decisions from the planning session:

- `yesterday` is the previous calendar day in `Asia/Kolkata`.
- `this-month` is the current calendar month in `Asia/Kolkata`.
- Sessions belong to the day they started.
- Monthly reports use the same start-day ownership rule.
- Duration is wall-clock session span, labeled as span.
- Tokens use `threads.tokens_used` first, then max cumulative token events from rollout JSONL.
- Summaries prefer thread title, then task completion message, then workspace folder.

## Data Sources

- `~/.codex/state_5.sqlite`
- `~/.codex/sessions/**/*.jsonl`

No OpenTelemetry collector is required for v1.
