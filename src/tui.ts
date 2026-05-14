import { BoxRenderable, TextRenderable, createCliRenderer, type KeyEvent } from "@opentui/core";
import { buildMonthReport, buildReport, type CodexReport } from "./report";
import { renderTuiText } from "./render";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type TuiPeriod = {
  kind: "day" | "month";
  value: string;
};

export async function runTui(options: { day?: string; month?: string; codexHome?: string } = {}): Promise<void> {
  let period: TuiPeriod = options.month
    ? { kind: "month", value: options.month }
    : { kind: "day", value: options.day ?? "yesterday" };
  let report = buildTuiReport(period, options.codexHome);
  period = periodFromReport(report);

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    clearOnShutdown: true,
  });

  const panel = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    padding: 1,
    border: true,
    borderColor: "#4ade80",
    backgroundColor: "#111111",
  });
  const text = new TextRenderable(renderer, {
    content: renderTuiText(report),
    fg: "#f4f4f5",
  });

  panel.add(text);
  renderer.root.add(panel);

  function refresh(nextPeriod: TuiPeriod): void {
    report = buildTuiReport(nextPeriod, options.codexHome);
    period = periodFromReport(report);
    text.content = renderTuiText(report);
    renderer.requestRender();
  }

  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    const nextPeriod = periodForKey(key, period);
    if (nextPeriod === "quit") {
      key.preventDefault();
      renderer.destroy();
      return;
    }

    if (!nextPeriod) return;

    key.preventDefault();
    refresh(nextPeriod);
  });
}

function buildTuiReport(period: TuiPeriod, codexHome?: string): CodexReport {
  return period.kind === "month"
    ? buildMonthReport({ month: period.value, codexHome })
    : buildReport({ day: period.value, codexHome });
}

function periodFromReport(report: CodexReport): TuiPeriod {
  return {
    kind: report.day.kind,
    value: report.day.label,
  };
}

function periodForKey(key: KeyEvent, period: TuiPeriod): TuiPeriod | "quit" | null {
  const name = key.name.toLowerCase();

  if (name === "q") return "quit";
  if (name === "y") return { kind: "day", value: yesterdayIstDate() };
  if (name === "t" || name === "d") return { kind: "day", value: todayIstDate() };
  if (name === "m") return { kind: "month", value: currentIstMonth() };
  if (name === "left" || name === "h") return shiftPeriod(period, -1);
  if (name === "right" || name === "l") return shiftPeriod(period, 1);

  return null;
}

function shiftPeriod(period: TuiPeriod, amount: number): TuiPeriod {
  return period.kind === "month"
    ? { kind: "month", value: addMonths(period.value, amount) }
    : { kind: "day", value: addDays(period.value, amount) };
}

function todayIstDate(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function yesterdayIstDate(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS - DAY_MS).toISOString().slice(0, 10);
}

function currentIstMonth(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

function addDays(label: string, amount: number): string {
  const startMs = Date.parse(`${label}T00:00:00+05:30`);
  return new Date(startMs + amount * DAY_MS + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function addMonths(label: string, amount: number): string {
  const [yearText, monthText] = label.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + amount, 1));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
