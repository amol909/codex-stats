import { Database } from "bun:sqlite";
import { basename, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { resolveDayWindow, resolveMonthWindow, type DayWindow } from "./time";

export type ReportMode = "minimal" | "verbose";

export type TokenUsage = {
  input: number;
  cachedInput: number;
  output: number;
  reasoningOutput: number;
  total: number;
};

export type SessionSummary = {
  id: string;
  title: string;
  cwd: string;
  workspace: string;
  createdAtMs: number;
  updatedAtMs: number;
  spanMs: number;
  crossesMidnight: boolean;
  tokens: number;
  tokenUsage: TokenUsage;
  model: string;
  reasoningEffort: string;
  rolloutPath: string;
  summary: string;
  finalMessage: string;
  toolCalls: Record<string, number>;
};

export type CodexReport = {
  day: DayWindow;
  sessions: SessionSummary[];
  totals: {
    sessions: number;
    spanMs: number;
    tokens: number;
    tokenUsage: TokenUsage;
    workspaces: Array<{ workspace: string; sessions: number; tokens: number; spanMs: number }>;
    models: Array<{ model: string; sessions: number; tokens: number; tokenUsage: TokenUsage; spanMs: number }>;
    tools: Array<{ tool: string; count: number }>;
    days: Array<{ date: string; sessions: number; tokens: number; spanMs: number }>;
  };
};

type ThreadRow = {
  id: string;
  title: string | null;
  cwd: string;
  created_at: number;
  updated_at: number;
  tokens_used: number;
  model: string | null;
  reasoning_effort: string | null;
  rollout_path: string;
  first_user_message: string | null;
};

type JsonEvent = {
  type?: string;
  payload?: any;
};

export function buildReport(options: {
  codexHome?: string;
  day?: string;
  now?: Date;
}): CodexReport {
  return buildReportForWindow(resolveDayWindow(options.day ?? "yesterday", options.now), options.codexHome);
}

export function buildMonthReport(options: {
  codexHome?: string;
  month?: string;
  now?: Date;
}): CodexReport {
  return buildReportForWindow(resolveMonthWindow(options.month ?? "this-month", options.now), options.codexHome);
}

function buildReportForWindow(day: DayWindow, codexHomeOverride?: string): CodexReport {
  const codexHome = codexHomeOverride ?? join(process.env.HOME ?? "", ".codex");
  const statePath = join(codexHome, "state_5.sqlite");
  if (!existsSync(statePath)) {
    throw new Error(`Codex state database not found: ${statePath}`);
  }

  const db = new Database(statePath, { readonly: true });

  try {
    const rows = db
      .query<ThreadRow, [number, number]>(
        `select id, title, cwd, created_at, updated_at, tokens_used, model, reasoning_effort, rollout_path, first_user_message
         from threads
         where created_at >= ? and created_at < ?
         order by created_at asc`,
      )
      .all(day.startSec, day.endSec);

    const sessions = rows.map((row) => summarizeSession(row, day));
    return {
      day,
      sessions,
      totals: summarizeTotals(sessions),
    };
  } finally {
    db.close();
  }
}

function summarizeSession(row: ThreadRow, day: DayWindow): SessionSummary {
  const telemetry = parseRollout(row.rollout_path);
  const createdAtMs = row.created_at * 1000;
  const updatedAtMs = row.updated_at * 1000;
  const tokens = chooseTokenTotal(row.tokens_used, telemetry.tokenUsage.total);
  const title = cleanText(row.title) || cleanText(row.first_user_message) || basename(row.cwd) || row.id;
  const finalMessage = cleanText(telemetry.finalMessage);
  const summary = briefSummary(title, finalMessage, row.cwd);

  return {
    id: row.id,
    title,
    cwd: row.cwd,
    workspace: basename(row.cwd) || row.cwd,
    createdAtMs,
    updatedAtMs,
    spanMs: Math.max(0, updatedAtMs - createdAtMs),
    crossesMidnight: updatedAtMs >= day.endMs,
    tokens,
    tokenUsage: { ...telemetry.tokenUsage, total: tokens },
    model: row.model ?? "unknown",
    reasoningEffort: row.reasoning_effort ?? "unknown",
    rolloutPath: row.rollout_path,
    summary,
    finalMessage,
    toolCalls: telemetry.toolCalls,
  };
}

function parseRollout(path: string): {
  tokenUsage: TokenUsage;
  finalMessage: string;
  toolCalls: Record<string, number>;
} {
  const out = {
    tokenUsage: emptyTokenUsage(),
    finalMessage: "",
    toolCalls: {} as Record<string, number>,
  };

  if (!path || !existsSync(path)) return out;

  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;

    let event: JsonEvent;
    try {
      event = JSON.parse(line) as JsonEvent;
    } catch {
      continue;
    }

    const payload = event.payload;
    if (event.type === "event_msg" && payload?.type === "token_count") {
      const tokenUsage = parseTokenUsage(payload.info?.total_token_usage);
      if (tokenUsage.total > out.tokenUsage.total) {
        out.tokenUsage = tokenUsage;
      }
    }

    if (event.type === "event_msg" && payload?.type === "task_complete") {
      out.finalMessage = cleanText(payload.last_agent_message) || out.finalMessage;
    }

    if (event.type === "response_item") {
      const name = payload?.name;
      if (
        (payload?.type === "function_call" || payload?.type === "custom_tool_call") &&
        typeof name === "string"
      ) {
        out.toolCalls[name] = (out.toolCalls[name] ?? 0) + 1;
      }
    }
  }

  return out;
}

function chooseTokenTotal(dbTokens: number, rolloutTokens: number): number {
  if (Number.isFinite(dbTokens) && dbTokens > 0) return dbTokens;
  return rolloutTokens;
}

function parseTokenUsage(value: unknown): TokenUsage {
  if (!value || typeof value !== "object") return emptyTokenUsage();
  const usage = value as Record<string, unknown>;
  return {
    input: numberField(usage.input_tokens),
    cachedInput: numberField(usage.cached_input_tokens),
    output: numberField(usage.output_tokens),
    reasoningOutput: numberField(usage.reasoning_output_tokens),
    total: numberField(usage.total_tokens),
  };
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function emptyTokenUsage(): TokenUsage {
  return {
    input: 0,
    cachedInput: 0,
    output: 0,
    reasoningOutput: 0,
    total: 0,
  };
}

function summarizeTotals(sessions: SessionSummary[]): CodexReport["totals"] {
  const workspaceMap = new Map<string, { workspace: string; sessions: number; tokens: number; spanMs: number }>();
  const modelMap = new Map<string, { model: string; sessions: number; tokens: number; tokenUsage: TokenUsage; spanMs: number }>();
  const toolMap = new Map<string, number>();
  const dayMap = new Map<string, { date: string; sessions: number; tokens: number; spanMs: number }>();

  for (const session of sessions) {
    const workspace = workspaceMap.get(session.workspace) ?? {
      workspace: session.workspace,
      sessions: 0,
      tokens: 0,
      spanMs: 0,
    };
    workspace.sessions += 1;
    workspace.tokens += session.tokens;
    workspace.spanMs += session.spanMs;
    workspaceMap.set(session.workspace, workspace);

    const model = modelMap.get(session.model) ?? {
      model: session.model,
      sessions: 0,
      tokens: 0,
      tokenUsage: emptyTokenUsage(),
      spanMs: 0,
    };
    model.sessions += 1;
    model.tokens += session.tokens;
    model.tokenUsage = sumTokenUsage([model.tokenUsage, session.tokenUsage]);
    model.spanMs += session.spanMs;
    modelMap.set(session.model, model);

    for (const [tool, count] of Object.entries(session.toolCalls)) {
      toolMap.set(tool, (toolMap.get(tool) ?? 0) + count);
    }

    const date = istDateKey(session.createdAtMs);
    const dayTotal = dayMap.get(date) ?? { date, sessions: 0, tokens: 0, spanMs: 0 };
    dayTotal.sessions += 1;
    dayTotal.tokens += session.tokens;
    dayTotal.spanMs += session.spanMs;
    dayMap.set(date, dayTotal);
  }

  return {
    sessions: sessions.length,
    spanMs: sessions.reduce((sum, session) => sum + session.spanMs, 0),
    tokens: sessions.reduce((sum, session) => sum + session.tokens, 0),
    tokenUsage: sumTokenUsage(sessions.map((session) => session.tokenUsage)),
    workspaces: [...workspaceMap.values()].sort((a, b) => b.spanMs - a.spanMs || b.tokens - a.tokens),
    models: [...modelMap.values()].sort((a, b) => b.tokens - a.tokens || a.model.localeCompare(b.model)),
    tools: [...toolMap.entries()]
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool)),
    days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function sumTokenUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (sum, usage) => ({
      input: sum.input + usage.input,
      cachedInput: sum.cachedInput + usage.cachedInput,
      output: sum.output + usage.output,
      reasoningOutput: sum.reasoningOutput + usage.reasoningOutput,
      total: sum.total + usage.total,
    }),
    emptyTokenUsage(),
  );
}

function istDateKey(epochMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date(epochMs));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function briefSummary(title: string, finalMessage: string, cwd: string): string {
  const candidate = title || finalMessage || basename(cwd);
  return truncate(cleanText(candidate), 130);
}

export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.slice(1, match.indexOf("]")))
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}
