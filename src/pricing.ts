import type { TokenUsage } from "./report";

export type ModelPricing = {
  model: string;
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
};

export type CostEstimate = {
  model: string;
  matchedModel: string | null;
  inputCost: number;
  cachedInputCost: number;
  outputCost: number;
  totalCost: number;
};

export const PRICING_SOURCE = {
  title: "OpenAI API pricing and model pages",
  url: "https://developers.openai.com/api/docs/pricing",
  checkedAt: "2026-06-11",
};

const PRICING: ModelPricing[] = [
  {
    model: "gpt-5.5",
    inputPerMillion: 5,
    cachedInputPerMillion: 0.5,
    outputPerMillion: 30,
  },
  {
    model: "gpt-5.4",
    inputPerMillion: 2.5,
    cachedInputPerMillion: 0.25,
    outputPerMillion: 15,
  },
  {
    model: "gpt-5.3-codex",
    inputPerMillion: 1.75,
    cachedInputPerMillion: 0.175,
    outputPerMillion: 14,
  },
  {
    model: "gpt-5.1-codex-mini",
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    outputPerMillion: 2,
  },
  {
    model: "gpt-5.1-codex-max",
    inputPerMillion: 1.25,
    cachedInputPerMillion: 0.125,
    outputPerMillion: 10,
  },
  {
    model: "gpt-5.1-codex",
    inputPerMillion: 1.25,
    cachedInputPerMillion: 0.125,
    outputPerMillion: 10,
  },
  {
    model: "gpt-5-codex",
    inputPerMillion: 1.25,
    cachedInputPerMillion: 0.125,
    outputPerMillion: 10,
  },
];

export function estimateCostForModel(model: string, tokenUsage: TokenUsage): CostEstimate {
  const pricing = findPricing(model);
  if (!pricing) {
    return {
      model,
      matchedModel: null,
      inputCost: 0,
      cachedInputCost: 0,
      outputCost: 0,
      totalCost: 0,
    };
  }

  const uncachedInput = Math.max(0, tokenUsage.input - tokenUsage.cachedInput);
  const inputCost = costForTokens(uncachedInput, pricing.inputPerMillion);
  const cachedInputCost = costForTokens(tokenUsage.cachedInput, pricing.cachedInputPerMillion);
  const outputCost = costForTokens(tokenUsage.output, pricing.outputPerMillion);

  return {
    model,
    matchedModel: pricing.model,
    inputCost,
    cachedInputCost,
    outputCost,
    totalCost: inputCost + cachedInputCost + outputCost,
  };
}

export function knownPricing(): ModelPricing[] {
  return PRICING.slice();
}

function findPricing(model: string): ModelPricing | null {
  const normalized = model.toLowerCase();
  return PRICING.find((pricing) => normalized === pricing.model || normalized.startsWith(`${pricing.model}-`)) ?? null;
}

function costForTokens(tokens: number, dollarsPerMillion: number): number {
  return (tokens / 1_000_000) * dollarsPerMillion;
}
