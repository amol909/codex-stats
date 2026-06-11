import { expect, test } from "bun:test";
import { resolveDayWindow } from "../src/time";

test("today resolves to the current calendar day in Asia/Kolkata", () => {
  const window = resolveDayWindow("today", new Date("2026-06-10T20:00:00.000Z"));

  expect(window.label).toBe("2026-06-11");
  expect(window.title).toBe("2026-06-11");
});
