import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { buildMonthReport, buildReport } from "../src/report";
import { formatTokens, renderTextReport } from "../src/render";

test("daily report includes detailed Codex token usage from rollout events", () => {
  const codexHome = createCodexHome([
    {
      id: "thread-1",
      title: "Token details",
      cwd: "/work/codex-stats",
      createdAt: Date.parse("2026-06-10T09:00:00+05:30") / 1000,
      updatedAt: Date.parse("2026-06-10T09:05:00+05:30") / 1000,
      tokensUsed: 222,
      model: "gpt-5.1-codex",
      reasoningEffort: "medium",
      tokenEvents: [
        {
          input_tokens: 100,
          cached_input_tokens: 40,
          output_tokens: 20,
          reasoning_output_tokens: 5,
          total_tokens: 120,
        },
        {
          input_tokens: 200,
          cached_input_tokens: 80,
          output_tokens: 22,
          reasoning_output_tokens: 7,
          total_tokens: 222,
        },
      ],
    },
  ]);

  const report = buildReport({ day: "2026-06-10", codexHome });

  expect(report.sessions[0]?.tokenUsage).toEqual({
    input: 200,
    cachedInput: 80,
    output: 22,
    reasoningOutput: 7,
    total: 222,
  });
  expect(report.totals.tokenUsage).toEqual({
    input: 200,
    cachedInput: 80,
    output: 22,
    reasoningOutput: 7,
    total: 222,
  });
});

test("compact token formatting keeps significant trailing zeroes", () => {
  expect(formatTokens(950_299_840)).toBe("95,02,99,840 (950M)");
});

test("text report shows token breakdown and model usage", () => {
  const codexHome = createCodexHome([
    {
      id: "thread-1",
      title: "Rendered details",
      cwd: "/work/codex-stats",
      createdAt: Date.parse("2026-06-10T09:00:00+05:30") / 1000,
      updatedAt: Date.parse("2026-06-10T09:05:00+05:30") / 1000,
      tokensUsed: 222,
      model: "gpt-5.1-codex",
      reasoningEffort: "medium",
      tokenEvents: [
        {
          input_tokens: 200,
          cached_input_tokens: 80,
          output_tokens: 22,
          reasoning_output_tokens: 7,
          total_tokens: 222,
        },
      ],
    },
  ]);

  const output = renderTextReport(buildReport({ day: "2026-06-10", codexHome }), "minimal");

  expect(output).toContain("Token breakdown: input 200, cached 80, output 22, reasoning 7");
  expect(output).toContain("Models:");
  expect(output).toContain("- gpt-5.1-codex: 1 session(s), 222 (222)");
});

test("monthly report groups usage by Codex model", () => {
  const codexHome = createCodexHome([
    {
      id: "thread-1",
      title: "First model",
      cwd: "/work/a",
      createdAt: Date.parse("2026-06-10T09:00:00+05:30") / 1000,
      updatedAt: Date.parse("2026-06-10T09:05:00+05:30") / 1000,
      tokensUsed: 120,
      model: "gpt-5.1-codex",
      reasoningEffort: "medium",
      tokenEvents: [
        {
          input_tokens: 100,
          cached_input_tokens: 40,
          output_tokens: 20,
          reasoning_output_tokens: 5,
          total_tokens: 120,
        },
      ],
    },
    {
      id: "thread-2",
      title: "Same model",
      cwd: "/work/b",
      createdAt: Date.parse("2026-06-11T09:00:00+05:30") / 1000,
      updatedAt: Date.parse("2026-06-11T09:10:00+05:30") / 1000,
      tokensUsed: 240,
      model: "gpt-5.1-codex",
      reasoningEffort: "high",
      tokenEvents: [
        {
          input_tokens: 200,
          cached_input_tokens: 80,
          output_tokens: 40,
          reasoning_output_tokens: 10,
          total_tokens: 240,
        },
      ],
    },
    {
      id: "thread-3",
      title: "Other model",
      cwd: "/work/c",
      createdAt: Date.parse("2026-06-12T09:00:00+05:30") / 1000,
      updatedAt: Date.parse("2026-06-12T09:03:00+05:30") / 1000,
      tokensUsed: 60,
      model: "gpt-5-mini-codex",
      reasoningEffort: "low",
      tokenEvents: [
        {
          input_tokens: 50,
          cached_input_tokens: 20,
          output_tokens: 10,
          reasoning_output_tokens: 2,
          total_tokens: 60,
        },
      ],
    },
  ]);

  const report = buildMonthReport({ month: "2026-06", codexHome });

  expect(report.totals.models).toEqual([
    {
      model: "gpt-5.1-codex",
      sessions: 2,
      spanMs: 900_000,
      tokens: 360,
      tokenUsage: {
        input: 300,
        cachedInput: 120,
        output: 60,
        reasoningOutput: 15,
        total: 360,
      },
    },
    {
      model: "gpt-5-mini-codex",
      sessions: 1,
      spanMs: 180_000,
      tokens: 60,
      tokenUsage: {
        input: 50,
        cachedInput: 20,
        output: 10,
        reasoningOutput: 2,
        total: 60,
      },
    },
  ]);
});

type ThreadFixture = {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  tokensUsed: number;
  model: string;
  reasoningEffort: string;
  tokenEvents: Array<{
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    reasoning_output_tokens: number;
    total_tokens: number;
  }>;
};

function createCodexHome(threads: ThreadFixture[]): string {
  const codexHome = mkdtempSync(join(tmpdir(), "codex-stats-test-"));
  const db = new Database(join(codexHome, "state_5.sqlite"));
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

  for (const thread of threads) {
    const rolloutPath = join(codexHome, "sessions", `${thread.id}.jsonl`);
    mkdirSync(join(codexHome, "sessions"), { recursive: true });
    writeFileSync(
      rolloutPath,
      thread.tokenEvents.map((tokenUsage) => JSON.stringify(tokenEvent(tokenUsage))).join("\n"),
    );

    db.query(
      `insert into threads
       (id, title, cwd, created_at, updated_at, tokens_used, model, reasoning_effort, rollout_path, first_user_message)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      thread.id,
      thread.title,
      thread.cwd,
      thread.createdAt,
      thread.updatedAt,
      thread.tokensUsed,
      thread.model,
      thread.reasoningEffort,
      rolloutPath,
      null,
    );
  }

  db.close();
  return codexHome;
}

function tokenEvent(totalTokenUsage: ThreadFixture["tokenEvents"][number]) {
  return {
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: totalTokenUsage,
      },
    },
  };
}
