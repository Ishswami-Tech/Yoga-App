import { describe, expect, test } from "bun:test";
import { pickBestClass } from "../../src/lib/services/class-pick";
import { istDateTime } from "../../src/lib/services/scheduling";

const D = "2031-03-10";
const am = { id: "am", date: D, startTime: "06:00", endTime: "07:00" };
const pm = { id: "pm", date: D, startTime: "18:00", endTime: "19:00" };

describe("pickBestClass", () => {
  test("empty", () => expect(pickBestClass([], new Date())).toBeNull());
  test("live class wins", () => expect(pickBestClass([pm, am], istDateTime(D, "06:30"))?.id).toBe("am"));
  test("next upcoming when none live", () => expect(pickBestClass([pm, am], istDateTime(D, "08:00"))?.id).toBe("pm"));
  test("earliest upcoming before first", () => expect(pickBestClass([pm, am], istDateTime(D, "04:00"))?.id).toBe("am"));
  test("last of day when all over", () => expect(pickBestClass([am, pm], istDateTime(D, "21:00"))?.id).toBe("pm"));
});
