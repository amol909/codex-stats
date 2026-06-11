import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("day command prints a report without requiring the report subcommand", () => {
  const codexHome = createCodexHome();
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "index.ts", "day", "2026-06-10", "--codex-home", codexHome],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Codex stats for 2026-06-10");
  expect(result.stdout.toString()).toContain("Token breakdown:");
});

test("cost command prints an API pricing estimate", () => {
  const codexHome = createCodexHome();
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "index.ts", "cost", "day", "2026-06-10", "--codex-home", codexHome],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Estimated API cost for 2026-06-10");
  expect(result.stdout.toString()).toContain("Pricing source: OpenAI API pricing");
});

test("chart command prints terminal usage charts", () => {
  const codexHome = createCodexHome();
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "index.ts", "chart", "month", "2026-06", "--codex-home", codexHome],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Codex usage chart for June 2026");
  expect(result.stdout.toString()).toContain("Token curve:");
  expect(result.stdout.toString()).toContain("Daily token trend:");
});

test("commands helper lists available CLI commands", () => {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "index.ts", "commands"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  const output = result.stdout.toString();
  expect(output).toContain("Available commands");
  expect(output).toContain("./cs today");
  expect(output).toContain("today");
  expect(output).toContain("models month this-month");
  expect(output).toContain("cost day yesterday");
  expect(output).toContain("chart month this-month");
});

test("repo-local wrapper runs the CLI without typing bun run index.ts", () => {
  const result = Bun.spawnSync({
    cmd: ["./cs", "commands"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Available commands");
});

function createCodexHome(): string {
  const codexHome = mkdtempSync(join(tmpdir(), "codex-stats-cli-test-"));
  const db = new Database(join(codexHome, "state_5.sqlite"));
  const rolloutPath = join(codexHome, "sessions", "thread-1.jsonl");

  mkdirSync(join(codexHome, "sessions"), { recursive: true });
  writeFileSync(
    rolloutPath,
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 200,
            cached_input_tokens: 80,
            output_tokens: 22,
            reasoning_output_tokens: 7,
            total_tokens: 222,
          },
        },
      },
    }),
  );

  db.run(`create table threads (
    id text primary key,
    title text,
    cwd text not null,
    created_at integer not null,
    updated_at integer not null,
    tokens_used integer not null,
    model text,
    reasoning_effort text,
    rollout_path text not null,
    first_user_message text
  )`);

  db.query(
    `insert into threads
     (id, title, cwd, created_at, updated_at, tokens_used, model, reasoning_effort, rollout_path, first_user_message)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "thread-1",
    "CLI report",
    "/work/codex-stats",
    Date.parse("2026-06-10T09:00:00+05:30") / 1000,
    Date.parse("2026-06-10T09:05:00+05:30") / 1000,
    222,
    "gpt-5.1-codex",
    "medium",
    rolloutPath,
    null,
  );
  db.close();

  return codexHome;
}
