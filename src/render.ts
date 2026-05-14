import { truncate, type CodexReport, type ReportMode } from "./report";
import { formatDuration, formatIstDateTime, formatIstTime } from "./time";

export function renderTextReport(report: CodexReport, mode: ReportMode): string {
  const lines: string[] = [];
  lines.push(`Codex stats for ${report.day.title} (Asia/Kolkata)`);
  lines.push("");
  lines.push(`Sessions: ${report.totals.sessions}`);
  lines.push(`Total span: ${formatDuration(report.totals.spanMs)}`);
  lines.push(`Total tokens: ${formatTokens(report.totals.tokens)}`);

  if (report.totals.workspaces.length > 0) {
    lines.push("");
    lines.push("Top workspaces:");
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
      lines.push("Daily activity:");
      for (const day of report.totals.days) {
        lines.push(
          `- ${day.date}: ${day.sessions} session(s), ${formatDuration(day.spanMs)}, ${formatTokens(day.tokens)}`,
        );
      }
    }

    lines.push("");
    lines.push("Sessions:");
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
      lines.push("Tools:");
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

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

export function formatTokens(value: number): string {
  return `${formatNumber(value)} (${formatCompactTokens(value)})`;
}

function formatCompactTokens(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${trimScale(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trimScale(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimScale(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

function trimScale(value: number): string {
  return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2).replace(/\.?0+$/, "");
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

function progressBar(value: number, max: number, width: number): string {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const filled = Math.max(value > 0 ? 1 : 0, Math.round(ratio * width));
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function sparkBlock(value: number, max: number): string {
  if (value <= 0 || max <= 0) return " ";
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const index = Math.max(0, Math.min(blocks.length - 1, Math.ceil((value / max) * blocks.length) - 1));
  return blocks[index] ?? "▁";
}

function sparkleLine(report: CodexReport): string {
  if (report.totals.sessions === 0) return "Quiet day. No Codex trails yet.";

  const busiest = report.totals.workspaces[0]?.workspace ?? "Codex";
  const hours = report.totals.spanMs / 3_600_000;
  if (hours >= 8) return `Focus streak: ${busiest} carried the day.`;
  if (report.totals.sessions >= 5) return `Many small missions. ${busiest} led the board.`;
  return `Light flight log. ${busiest} was the main stop.`;
}
