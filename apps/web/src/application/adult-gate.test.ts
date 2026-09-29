import { describe, expect, it, vi } from "vitest";
import { enterAdultGate, startsAdultHold } from "./adult-gate";

describe("enterAdultGate", () => {
  it("revokes adult access on gate entry so the hold has to be repeated", () => {
    const lockAdult = vi.fn();
    enterAdultGate({ lockAdult });
    expect(lockAdult).toHaveBeenCalledTimes(1);
  });
});

describe("startsAdultHold", () => {
  it("starts the 3s hold on the first Space or Enter press", () => {
    expect(startsAdultHold({ key: " ", repeat: false })).toBe(true);
    expect(startsAdultHold({ key: "Enter", repeat: false })).toBe(true);
  });

  it("ignores auto-repeat so preventDefault is not called on every repeat", () => {
    expect(startsAdultHold({ key: " ", repeat: true })).toBe(false);
    expect(startsAdultHold({ key: "Enter", repeat: true })).toBe(false);
  });

  it("ignores unrelated keys", () => {
    expect(startsAdultHold({ key: "a", repeat: false })).toBe(false);
  });
});
