import { describe, expect, it } from "vitest";
import { normalizeStatus, parseDueDate } from "./signals";

describe("parseDueDate", () => {
  it("parses ISO dates", () => {
    const result = parseDueDate("2026-08-14");
    expect(result.kind).toBe("iso");
    expect(result.date?.toISOString().slice(0, 10)).toBe("2026-08-14");
  });

  it("parses DD/MM/YYYY dates", () => {
    const result = parseDueDate("15/09/2026");
    expect(result.kind).toBe("dmy");
    expect(result.date?.toISOString().slice(0, 10)).toBe("2026-09-15");
  });

  it("flags 'monthly' as recurring, not a fixed date", () => {
    const result = parseDueDate("monthly");
    expect(result.kind).toBe("recurring");
    expect(result.date).toBeNull();
  });

  it("flags natural-language dates as unparseable", () => {
    const result = parseDueDate("June 2");
    expect(result.kind).toBe("unparseable");
    expect(result.date).toBeNull();
  });

  it("flags null due dates as unparseable", () => {
    const result = parseDueDate(null);
    expect(result.kind).toBe("unparseable");
    expect(result.date).toBeNull();
  });

  it("rejects invalid calendar dates instead of rolling them over", () => {
    const result = parseDueDate("2026-02-30");
    expect(result.kind).toBe("unparseable");
  });
});

describe("normalizeStatus", () => {
  it("maps recognized OK spellings to 'ok'", () => {
    expect(normalizeStatus("On Track")).toBe("ok");
    expect(normalizeStatus("on-track")).toBe("ok");
    expect(normalizeStatus("Green")).toBe("ok");
  });

  it("maps recognized risk spellings to 'risk'", () => {
    expect(normalizeStatus("At Risk")).toBe("risk");
    expect(normalizeStatus("Red")).toBe("risk");
  });

  it("maps '??' to 'unclear'", () => {
    expect(normalizeStatus("??")).toBe("unclear");
  });

  it("maps null to 'unclear'", () => {
    expect(normalizeStatus(null)).toBe("unclear");
  });

  it("maps unrecognized text to 'unclear' rather than guessing", () => {
    expect(normalizeStatus("Yellow-ish, kind of")).toBe("unclear");
  });
});
