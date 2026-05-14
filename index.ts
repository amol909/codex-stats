#!/usr/bin/env bun
import { Command } from "commander";
import { buildMonthReport, buildReport, type ReportMode } from "./src/report";
import { renderTextReport } from "./src/render";
import { runTui } from "./src/tui";

const program = new Command();

program
  .name("codex-stats")
  .description("Brief local Codex session stats from ~/.codex")
  .version("0.1.0");

program
  .command("report")
  .argument("[day]", "yesterday or YYYY-MM-DD", "yesterday")
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
  .command("tui")
  .argument("[day]", "yesterday or YYYY-MM-DD", "yesterday")
  .option("--month <month>", "show a monthly dashboard for this-month or YYYY-MM")
  .option("--codex-home <path>", "Codex home directory")
  .description("Open a terminal UI dashboard")
  .action(async (day: string, options: { month?: string; codexHome?: string }) => {
    await runTui({ day, month: options.month, codexHome: options.codexHome });
  });

const commands = new Set(["report", "month", "tui", "help"]);
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
