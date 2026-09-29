import { describe, expect, it } from "vitest";
import { focusIsInsideDialog } from "./heading-focus";

const host = (insideDialog: boolean) => ({
  closest: (selector: string) =>
    insideDialog && selector.includes("[role='dialog']") ? {} : null,
});

describe("focusIsInsideDialog", () => {
  it("does not suppress heading focus for a plain navigation link", () => {
    expect(focusIsInsideDialog(host(false))).toBe(false);
  });

  it("suppresses heading focus while a dialog owns focus", () => {
    expect(focusIsInsideDialog(host(true))).toBe(true);
  });

  it("treats a missing active element as outside dialogs", () => {
    expect(focusIsInsideDialog(null)).toBe(false);
  });
});
