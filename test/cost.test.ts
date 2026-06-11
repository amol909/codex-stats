import { expect, test } from "bun:test";
import { estimateCostForModel } from "../src/pricing";
import { renderCostReport } from "../src/render";

test("cost estimate charges cached input separately from uncached input", () => {
  const estimate = estimateCostForModel("gpt-5.1-codex", {
    input: 1_000_000,
    cachedInput: 200_000,
    output: 100_000,
    reasoningOutput: 50_000,
    total: 1_100_000,
  });

  expect(estimate).toEqual({
    model: "gpt-5.1-codex",
    matchedModel: "gpt-5.1-codex",
    inputCost: 1,
    cachedInputCost: 0.025,
    outputCost: 1,
    totalCost: 2.025,
  });
});

test("cost estimate supports current flagship Codex models", () => {
  expect(
    estimateCostForModel("gpt-5.5", {
      input: 1_000_000,
      cachedInput: 200_000,
      output: 100_000,
      reasoningOutput: 0,
      total: 1_100_000,
    }).totalCost,
  ).toBe(7.1);

  expect(
    estimateCostForModel("gpt-5.4", {
      input: 1_000_000,
      cachedInput: 200_000,
      output: 100_000,
      reasoningOutput: 0,
      total: 1_100_000,
    }).totalCost,
  ).toBe(3.55);
});

test("cost report renders model estimates and pricing source", () => {
  const output = renderCostReport({
    day: {
      kind: "day",
      label: "2026-06-10",
      title: "2026-06-10",
      startMs: 0,
      endMs: 1,
      startSec: 0,
      endSec: 1,
    },
    sessions: [],
    totals: {
      sessions: 1,
      spanMs: 0,
      tokens: 1_100_000,
      tokenUsage: {
        input: 1_000_000,
        cachedInput: 200_000,
        output: 100_000,
        reasoningOutput: 50_000,
        total: 1_100_000,
      },
      workspaces: [],
      models: [
        {
          model: "gpt-5.1-codex",
          sessions: 1,
          spanMs: 0,
          tokens: 1_100_000,
          tokenUsage: {
            input: 1_000_000,
            cachedInput: 200_000,
            output: 100_000,
            reasoningOutput: 50_000,
            total: 1_100_000,
          },
        },
      ],
      tools: [],
      days: [],
    },
  });

  expect(output).toContain("Estimated API cost for 2026-06-10");
  expect(output).toContain("- gpt-5.1-codex: $2.0250");
  expect(output).toContain("Pricing source: OpenAI API pricing and model pages, checked 2026-06-11");
});
