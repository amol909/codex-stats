import chalk from "chalk";
import CliGraph from "cli-graph";
import { truncate, type CodexReport, type ReportMode } from "./report";
import { formatDuration, formatIstDateTime, formatIstTime } from "./time";
import { estimateCostForModel, PRICING_SOURCE } from "./pricing";

export function renderTextReport(report: CodexReport, mode: ReportMode): string {
  const lines: string[] = [];
  lines.push(title(`Codex stats for ${report.day.title} (Asia/Kolkata)`));
  lines.push("");
  lines.push(`${label("Sessions")}: ${report.totals.sessions}`);
  lines.push(`${label("Total span")}: ${formatDuration(report.totals.spanMs)}`);
  lines.push(`${label("Total tokens")}: ${formatTokens(report.totals.tokens)}`);
  lines.push(`${label("Token breakdown")}: ${formatTokenBreakdown(report.totals.tokenUsage)}`);

  if (report.totals.models.length > 0) {
    lines.push("");
    lines.push(section("Models:"));
    for (const model of report.totals.models.slice(0, mode === "minimal" ? 5 : 10)) {
      lines.push(`- ${model.model}: ${model.sessions} session(s), ${formatTokens(model.tokens)}`);
    }
  }

  if (report.totals.workspaces.length > 0) {
    lines.push("");
    lines.push(section("Top workspaces:"));
    for (const workspace of report.totals.workspaces.slice(0, mode === "minimal" ? 5 : 10)) {
      lines.push(
        `- ${workspace.workspace}: ${workspace.sessions} session(s), ${formatDuration(
          workspace.spanMs,
        )}, ${formatTokens(workspace.tokens)}`,
      );
    }
  }

  if (mode === "verbose") {
    if (report.day.kind === "month" && report.totals.days.length > 0) {
      lines.push("");
      lines.push(section("Daily activity:"));
      for (const day of report.totals.days) {
        lines.push(
          `- ${day.date}: ${day.sessions} session(s), ${formatDuration(day.spanMs)}, ${formatTokens(day.tokens)}`,
        );
      }
    }

    lines.push("");
    lines.push(section("Sessions:"));
    for (const session of report.sessions) {
      const midnight =
        session.crossesMidnight && report.day.kind === "day"
          ? " continued past midnight"
          : session.crossesMidnight
            ? " continued past period"
            : "";
      lines.push(
        `- ${formatIstTime(session.createdAtMs)}-${formatIstTime(session.updatedAtMs)} ${session.workspace}: ${
          session.summary
        } (${formatDuration(session.spanMs)}, ${formatTokens(session.tokens)}, ${session.model}${midnight})`,
      );
    }

    if (report.totals.tools.length > 0) {
      lines.push("");
      lines.push(section("Tools:"));
      for (const tool of report.totals.tools.slice(0, 10)) {
        lines.push(`- ${tool.tool}: ${tool.count}`);
      }
    }
  }

  if (report.totals.sessions === 0) {
    lines.push("");
    lines.push("No Codex sessions started during this period.");
  }

  return lines.join("\n");
}

export function renderTuiText(report: CodexReport): string {
  const sessions = report.sessions
    .slice()
    .sort((a, b) => b.spanMs - a.spanMs)
    .slice(0, 5);

  const lines = [
    `CODEX STATS  ${report.day.title}`,
    `${formatIstDateTime(report.day.startMs)} -> ${formatIstDateTime(report.day.endMs - 1)}`,
    "Filters: y yesterday  t/d today  m this month  ←/→ prev/next  q quit",
    "",
    sparkleLine(report),
    "",
    headlineStats(report),
    "",
    ...(report.day.kind === "month" ? ["Daily token trend", ...dailyTrend(report), ""] : []),
    "Workspace span",
    ...workspaceBars(report),
    "",
    "Top tools",
    ...toolBars(report),
    "",
    "Longest sessions",
    ...sessions.map(
      (session, index) =>
        `${index + 1}. ${formatIstTime(session.createdAtMs)}  ${session.workspace.padEnd(18).slice(0, 18)} ${formatDuration(
          session.spanMs,
        ).padStart(8)}  ${truncate(session.summary, 28)}`,
    ),
  ];

  return lines.join("\n");
}

export function renderCostReport(report: CodexReport): string {
  const lines: string[] = [];
  const estimates = report.totals.models.map((model) => ({
    model,
    estimate: estimateCostForModel(model.model, model.tokenUsage),
  }));
  const known = estimates.filter(({ estimate }) => estimate.matchedModel);
  const unknown = estimates.filter(({ estimate }) => !estimate.matchedModel);
  const totalCost = known.reduce((sum, { estimate }) => sum + estimate.totalCost, 0);

  lines.push(title(`Estimated API cost for ${report.day.title} (Asia/Kolkata)`));
  lines.push("");
  lines.push(`${label("Total estimated cost")}: ${money(formatUsd(totalCost))}`);

  if (known.length > 0) {
    lines.push("");
    lines.push(section("Models:"));
    for (const { model, estimate } of known) {
      lines.push(
        `- ${model.model}: ${formatUsd(estimate.totalCost)} (${formatTokens(model.tokens)}, ${model.sessions} session(s))`,
      );
    }
  }

  if (unknown.length > 0) {
    lines.push("");
    lines.push(section("Models without pricing:"));
    for (const { model } of unknown) {
      lines.push(`- ${model.model}: ${formatTokens(model.tokens)}`);
    }
  }

  lines.push("");
  lines.push(`${label("Pricing source")}: ${PRICING_SOURCE.title}, checked ${PRICING_SOURCE.checkedAt}`);
  lines.push(PRICING_SOURCE.url);
  lines.push("Estimate uses API token pricing, not ChatGPT plan billing.");

  return lines.join("\n");
}

export function renderModelsReport(report: CodexReport): string {
  const lines: string[] = [];
  lines.push(title(`Codex model usage for ${report.day.title} (Asia/Kolkata)`));

  if (report.totals.models.length === 0) {
    lines.push("");
    lines.push("No model usage recorded.");
    return lines.join("\n");
  }

  lines.push("");
  for (const model of report.totals.models) {
    lines.push(
      `- ${model.model}: ${model.sessions} session(s), ${formatDuration(model.spanMs)}, ${formatTokens(model.tokens)}`,
    );
    lines.push(`  ${formatTokenBreakdown(model.tokenUsage)}`);
  }

  return lines.join("\n");
}

export function renderChartReport(report: CodexReport): string {
  const lines: string[] = [];
  lines.push(title(`Codex usage chart for ${report.day.title} (Asia/Kolkata)`));
  lines.push("");

  if (report.day.kind === "month") {
    lines.push(section("Token curve:"));
    lines.push(...tokenCurve(report));
    lines.push("");
    lines.push(section("Daily token trend:"));
    lines.push(...dailyBarChart(report));
    lines.push("");
  }

  lines.push(section("Model token comparison:"));
  lines.push(...modelTokenBars(report));

  return lines.join("\n");
}

export function renderCommandsHelp(): string {
  return [
    title("Available commands"),
    "",
    section("Reports:"),
    "  codex-stats today",
    "  codex-stats yesterday",
    "  codex-stats day 2026-06-10",
    "  codex-stats month this-month",
    "",
    section("Breakdowns:"),
    "  codex-stats models day yesterday",
    "  codex-stats models month this-month",
    "  codex-stats cost day yesterday",
    "  codex-stats cost month this-month",
    "",
    section("Charts and UI:"),
    "  codex-stats chart day today",
    "  codex-stats chart month this-month",
    "  codex-stats tui",
    "",
    section("Options:"),
    "  --codex-home <path>  Read a different Codex home directory",
    "  --mode verbose       Show session-level details on report commands",
  ].join("\n");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

export function formatTokens(value: number): string {
  return `${formatNumber(value)} (${formatCompactTokens(value)})`;
}

function formatTokenBreakdown(tokenUsage: CodexReport["totals"]["tokenUsage"]): string {
  return [
    `input ${formatNumber(tokenUsage.input)}`,
    `cached ${formatNumber(tokenUsage.cachedInput)}`,
    `output ${formatNumber(tokenUsage.output)}`,
    `reasoning ${formatNumber(tokenUsage.reasoningOutput)}`,
  ].join(", ");
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatCompactTokens(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${trimScale(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trimScale(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimScale(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

function trimScale(value: number): string {
  return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function headlineStats(report: CodexReport): string {
  const sessions = `${report.totals.sessions} sessions`;
  const span = `${formatDuration(report.totals.spanMs)} span`;
  const tokens = `${formatCompactTokens(report.totals.tokens)} tokens`;
  return `${sessions.padEnd(18)} ${span.padEnd(18)} ${tokens}`;
}

function workspaceBars(report: CodexReport): string[] {
  const top = report.totals.workspaces.slice(0, 5);
  const max = Math.max(...top.map((workspace) => workspace.spanMs), 1);

  if (top.length === 0) return ["No workspace activity."];

  return top.map((workspace) => {
    const label = truncate(workspace.workspace, 18).padEnd(18);
    const bar = progressBar(workspace.spanMs, max, 24);
    const span = formatDuration(workspace.spanMs).padStart(8);
    const tokens = formatCompactTokens(workspace.tokens).padStart(8);
    return `${label} ${bar} ${span}  ${tokens}`;
  });
}

function dailyTrend(report: CodexReport): string[] {
  const days = report.totals.days;
  if (days.length === 0) return ["No activity recorded."];

  const peak = days.slice().sort((a, b) => b.tokens - a.tokens)[0];
  const sparkline = days.map((day) => sparkBlock(day.tokens, peak?.tokens ?? 1)).join("");
  const start = days[0]?.date.slice(5) ?? "--";
  const end = days[days.length - 1]?.date.slice(5) ?? "--";

  return [
    `${start} ${sparkline} ${end}`,
    peak ? `Peak ${peak.date.slice(5)}  ${formatCompactTokens(peak.tokens)}  ${peak.sessions} sessions` : "",
  ].filter(Boolean);
}

function toolBars(report: CodexReport): string[] {
  const top = report.totals.tools.slice(0, 4);
  const max = Math.max(...top.map((tool) => tool.count), 1);

  if (top.length === 0) return ["No tool calls recorded."];

  return top.map((tool) => {
    const label = truncate(tool.tool, 16).padEnd(16);
    return `${label} ${progressBar(tool.count, max, 20)} ${String(tool.count).padStart(4)}`;
  });
}

function dailyBarChart(report: CodexReport): string[] {
  const days = report.totals.days;
  if (days.length === 0) return ["No activity recorded."];

  const max = Math.max(...days.map((day) => day.tokens), 1);
  return days.map((day) => {
    const label = day.date.slice(5);
    return `${label} ${progressBar(day.tokens, max, 28)} ${formatCompactTokens(day.tokens).padStart(8)}`;
  });
}

function modelTokenBars(report: CodexReport): string[] {
  const models = report.totals.models;
  if (models.length === 0) return ["No model usage recorded."];

  const max = Math.max(...models.map((model) => model.tokens), 1);
  return models.map((model) => {
    const label = truncate(model.model, 22).padEnd(22);
    return `${label} ${progressBar(model.tokens, max, 24)} ${formatCompactTokens(model.tokens).padStart(8)}`;
  });
}

function tokenCurve(report: CodexReport): string[] {
  const days = report.totals.days;
  if (days.length === 0) return ["No activity recorded."];

  const max = Math.max(...days.map((day) => day.tokens), 1);
  const graph = new CliGraph({
    height: 8,
    width: Math.max(12, Math.min(42, days.length * 4)),
    center: { x: 0, y: 7 },
    marks: {
      hAxis: " ",
      vAxis: " ",
      center: " ",
      rightArrow: " ",
      topArrow: " ",
      point: "●",
      background: " ",
    },
  });

  days.forEach((day, index) => {
    const x = days.length === 1 ? 1 : Math.round((index / (days.length - 1)) * Math.max(1, days.length * 2));
    const y = Math.max(0, Math.round((day.tokens / max) * 6));
    graph.addPoint(x, y, "●");
  });

  return graph
    .toString()
    .split("\n")
    .map((line) => dim(line.replace(/\s+$/g, "")))
    .filter((line) => line.trim().length > 0);
}

function progressBar(value: number, max: number, width: number): string {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const filled = Math.max(value > 0 ? 1 : 0, Math.round(ratio * width));
  return `${chalk.green("█".repeat(filled))}${dim("░".repeat(width - filled))}`;
}

function sparkBlock(value: number, max: number): string {
  if (value <= 0 || max <= 0) return " ";
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const index = Math.max(0, Math.min(blocks.length - 1, Math.ceil((value / max) * blocks.length) - 1));
  return blocks[index] ?? "▁";
}

function title(value: string): string {
  return chalk.bold.cyan(value);
}

function section(value: string): string {
  return chalk.bold(value);
}

function label(value: string): string {
  return chalk.cyan(value);
}

function money(value: string): string {
  return chalk.green(value);
}

function dim(value: string): string {
  return chalk.dim(value);
}

function sparkleLine(report: CodexReport): string {
  if (report.totals.sessions === 0) return "Quiet day. No Codex trails yet.";

  const busiest = report.totals.workspaces[0]?.workspace ?? "Codex";
  const hours = report.totals.spanMs / 3_600_000;
  if (hours >= 8) return `Focus streak: ${busiest} carried the day.`;
  if (report.totals.sessions >= 5) return `Many small missions. ${busiest} led the board.`;
  return `Light flight log. ${busiest} was the main stop.`;
}
