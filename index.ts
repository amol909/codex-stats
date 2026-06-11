#!/usr/bin/env bun
import { Command } from "commander";
import { buildMonthReport, buildReport, type ReportMode } from "./src/report";
import { renderChartReport, renderCommandsHelp, renderCostReport, renderModelsReport, renderTextReport } from "./src/render";
import { runTui } from "./src/tui";

const program = new Command();

program
  .name("codex-stats")
  .description("Brief local Codex session stats from ~/.codex")
  .version("0.1.0");

program
  .command("commands")
  .description("Show common codex-stats commands")
  .action(() => {
    console.log(renderCommandsHelp());
  });

program
  .command("day")
  .argument("[day]", "today, yesterday, or YYYY-MM-DD", "yesterday")
  .option("-m, --mode <mode>", "minimal or verbose", "minimal")
  .option("--codex-home <path>", "Codex home directory")
  .description("Print a daily Codex stats report")
  .action((day: string, options: { mode: string; codexHome?: string }) => {
    const mode = parseMode(options.mode);
    const report = buildReport({ day, codexHome: options.codexHome });
    console.log(renderTextReport(report, mode));
  });

program
  .command("today")
  .option("-m, --mode <mode>", "minimal or verbose", "minimal")
  .option("--codex-home <path>", "Codex home directory")
  .description("Print today's Codex stats report")
  .action((options: { mode: string; codexHome?: string }) => {
    const mode = parseMode(options.mode);
    const report = buildReport({ day: "today", codexHome: options.codexHome });
    console.log(renderTextReport(report, mode));
  });

program
  .command("yesterday")
  .option("-m, --mode <mode>", "minimal or verbose", "minimal")
  .option("--codex-home <path>", "Codex home directory")
  .description("Print yesterday's Codex stats report")
  .action((options: { mode: string; codexHome?: string }) => {
    const mode = parseMode(options.mode);
    const report = buildReport({ day: "yesterday", codexHome: options.codexHome });
    console.log(renderTextReport(report, mode));
  });

program
  .command("report")
  .argument("[day]", "today, yesterday, or YYYY-MM-DD", "yesterday")
  .option("-m, --mode <mode>", "minimal or verbose", "minimal")
  .option("--codex-home <path>", "Codex home directory")
  .description("Print a concise Codex stats report")
  .action((day: string, options: { mode: string; codexHome?: string }) => {
    const mode = parseMode(options.mode);
    const report = buildReport({ day, codexHome: options.codexHome });
    console.log(renderTextReport(report, mode));
  });

program
  .command("month")
  .argument("[month]", "this-month or YYYY-MM", "this-month")
  .option("-m, --mode <mode>", "minimal or verbose", "minimal")
  .option("--codex-home <path>", "Codex home directory")
  .description("Print a concise monthly Codex stats report")
  .action((month: string, options: { mode: string; codexHome?: string }) => {
    const mode = parseMode(options.mode);
    const report = buildMonthReport({ month, codexHome: options.codexHome });
    console.log(renderTextReport(report, mode));
  });

program
  .command("models")
  .argument("[period]", "day or month", "day")
  .argument("[value]", "today, yesterday, YYYY-MM-DD, this-month, or YYYY-MM")
  .option("--codex-home <path>", "Codex home directory")
  .description("Print Codex usage grouped by model")
  .action((period: string, value: string | undefined, options: { codexHome?: string }) => {
    const report = buildPeriodReport(period, value, options.codexHome);
    console.log(renderModelsReport(report));
  });

program
  .command("cost")
  .argument("[period]", "day or month", "day")
  .argument("[value]", "today, yesterday, YYYY-MM-DD, this-month, or YYYY-MM")
  .option("--codex-home <path>", "Codex home directory")
  .description("Estimate Codex API cost from local token usage")
  .action((period: string, value: string | undefined, options: { codexHome?: string }) => {
    const report = buildPeriodReport(period, value, options.codexHome);
    console.log(renderCostReport(report));
  });

program
  .command("chart")
  .argument("[period]", "day or month", "month")
  .argument("[value]", "today, yesterday, YYYY-MM-DD, this-month, or YYYY-MM")
  .option("--codex-home <path>", "Codex home directory")
  .description("Print terminal charts for Codex usage trends")
  .action((period: string, value: string | undefined, options: { codexHome?: string }) => {
    const report = buildPeriodReport(period, value, options.codexHome);
    console.log(renderChartReport(report));
  });

program
  .command("tui")
  .argument("[day]", "yesterday or YYYY-MM-DD", "yesterday")
  .option("--month <month>", "show a monthly dashboard for this-month or YYYY-MM")
  .option("--codex-home <path>", "Codex home directory")
  .description("Open a terminal UI dashboard")
  .action(async (day: string, options: { month?: string; codexHome?: string }) => {
    await runTui({ day, month: options.month, codexHome: options.codexHome });
  });

const commands = new Set([
  "commands",
  "day",
  "today",
  "yesterday",
  "report",
  "month",
  "models",
  "cost",
  "chart",
  "tui",
  "help",
]);
const firstArg = process.argv[2];
if (!firstArg) {
  process.argv.push("report", "yesterday");
} else if (!firstArg.startsWith("-") && !commands.has(firstArg)) {
  process.argv.splice(2, 0, "report");
}

program.parse();

function parseMode(value: string): ReportMode {
  if (value === "minimal" || value === "verbose") return value;
  throw new Error(`Unknown mode "${value}". Expected "minimal" or "verbose".`);
}

function buildPeriodReport(period: string, value: string | undefined, codexHome?: string) {
  if (period === "month") {
    return buildMonthReport({ month: value ?? "this-month", codexHome });
  }
  if (period === "day") {
    return buildReport({ day: value ?? "yesterday", codexHome });
  }
  if (/^\d{4}-\d{2}$/.test(period) || period === "this-month") {
    return buildMonthReport({ month: period, codexHome });
  }
  return buildReport({ day: period, codexHome });
}
