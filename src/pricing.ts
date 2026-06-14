const TOKENS_PER_MILLION = 1_000_000;
const LONG_CONTEXT_INPUT_THRESHOLD = 272_000;

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  maxPromptInputTokens: number;
};

export type CostEstimate = {
  usd: number;
  model: string;
  pricedAsModel: string;
  pricingPlan: "standard";
  context: "short" | "long";
  inputCostUsd: number;
  cachedInputCostUsd: number;
  outputCostUsd: number;
};

type TokenRates = {
  input: number;
  cachedInput: number;
  output: number;
};

type ModelStandardPricing = {
  short: TokenRates;
  long?: TokenRates;
};

export const STANDARD_PRICING_SOURCE =
  "https://developers.openai.com/api/docs/pricing";
export const STANDARD_PRICING_LAST_CHECKED = "2026-05-15";

const STANDARD_PRICING_PER_1M_TOKENS: Record<string, ModelStandardPricing> = {
  "gpt-5.5": {
    short: { input: 5.0, cachedInput: 0.5, output: 30.0 },
    long: { input: 10.0, cachedInput: 1.0, output: 45.0 },
  },
  "gpt-5.5-pro": {
    short: { input: 30.0, cachedInput: 30.0, output: 180.0 },
    long: { input: 60.0, cachedInput: 60.0, output: 270.0 },
  },
  "gpt-5.4": {
    short: { input: 2.5, cachedInput: 0.25, output: 15.0 },
    long: { input: 5.0, cachedInput: 0.5, output: 22.5 },
  },
  "gpt-5.4-pro": {
    short: { input: 30.0, cachedInput: 30.0, output: 180.0 },
    long: { input: 60.0, cachedInput: 60.0, output: 270.0 },
  },
  "gpt-5.4-mini": {
    short: { input: 0.75, cachedInput: 0.075, output: 4.5 },
  },
  "gpt-5.4-nano": {
    short: { input: 0.2, cachedInput: 0.02, output: 1.25 },
  },
  "gpt-5.3-codex": {
    short: { input: 1.75, cachedInput: 0.175, output: 14.0 },
  },
  "gpt-5.2-codex": {
    short: { input: 1.75, cachedInput: 0.175, output: 14.0 },
  },
  "gpt-5.2": {
    short: { input: 1.75, cachedInput: 0.175, output: 14.0 },
  },
  "gpt-5-codex": {
    short: { input: 1.25, cachedInput: 0.125, output: 10.0 },
  },
  "gpt-5": {
    short: { input: 1.25, cachedInput: 0.125, output: 10.0 },
  },
  "gpt-5-mini": {
    short: { input: 0.25, cachedInput: 0.025, output: 2.0 },
  },
  "gpt-5-nano": {
    short: { input: 0.05, cachedInput: 0.005, output: 0.4 },
  },
};

const KNOWN_MODELS = Object.keys(STANDARD_PRICING_PER_1M_TOKENS).sort((a, b) => b.length - a.length);

export function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    maxPromptInputTokens: 0,
  };
}

export function estimateStandardCost(model: string, usage: TokenUsage): CostEstimate | null {
  if (usage.totalTokens <= 0) return null;

  const pricedAsModel = normalizeModelForPricing(model);
  const pricing = STANDARD_PRICING_PER_1M_TOKENS[pricedAsModel];
  if (!pricing) return null;

  const useLongContext = Boolean(pricing.long && usage.maxPromptInputTokens > LONG_CONTEXT_INPUT_THRESHOLD);
  const context = useLongContext ? "long" : "short";
  const rates = useLongContext && pricing.long ? pricing.long : pricing.short;
  const cachedInputTokens = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens);
  const inputCostUsd = (uncachedInputTokens / TOKENS_PER_MILLION) * rates.input;
  const cachedInputCostUsd = (cachedInputTokens / TOKENS_PER_MILLION) * rates.cachedInput;
  const outputCostUsd = (usage.outputTokens / TOKENS_PER_MILLION) * rates.output;

  return {
    usd: inputCostUsd + cachedInputCostUsd + outputCostUsd,
    model,
    pricedAsModel,
    pricingPlan: "standard",
    context,
    inputCostUsd,
    cachedInputCostUsd,
    outputCostUsd,
  };
}

function normalizeModelForPricing(model: string): string {
  if (STANDARD_PRICING_PER_1M_TOKENS[model]) return model;

  for (const knownModel of KNOWN_MODELS) {
    if (model.startsWith(`${knownModel}-`)) return knownModel;
  }

  return model;
}
