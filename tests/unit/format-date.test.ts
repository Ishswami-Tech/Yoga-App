import { describe, expect, test } from "bun:test";
import { prettyDate } from "@/components/yoga/student/format";

describe("prettyDate", () => {
  test("formats a plain calendar date", () => {
    expect(prettyDate("2025-09-22")).toBe("Mon, 22 Sep 2025");
  });
  test("formats an API timestamp as the IST calendar date (not the raw ISO string)", () => {
    expect(prettyDate("2026-11-09T05:40:51.293Z")).toBe("Mon, 9 Nov 2026");
    // 20:00Z is already the next day in IST (+5:30).
    expect(prettyDate("2026-11-09T20:00:00.000Z")).toBe("Tue, 10 Nov 2026");
  });
  test("handles empty values and passes unknown text through", () => {
    expect(prettyDate(null)).toBe("—");
    expect(prettyDate(undefined)).toBe("—");
    expect(prettyDate("soon")).toBe("soon");
  });
});
