import { describe, expect, it } from "vitest";
import { events, feedback, glossary, goals, purchases, tasks } from "./index";
import {
  InteractiveLearningTaskDefinitionSchema,
  completeTask,
  createDemoProfile,
  applyGameEvent,
} from "@finni/shared";

describe("validated data-driven content", () => {
  it("loads every content collection through shared schemas", () => {
    expect(purchases).toHaveLength(10);
    expect(goals).toHaveLength(3);
    expect(tasks).toHaveLength(6);
    expect(new Set(tasks.map((task) => task.topic))).toEqual(
      new Set(["BUDGET_PLANNING", "SAVINGS", "PAYMENTS_AND_PURCHASES"]),
    );
    expect(events).toHaveLength(6);
    expect(feedback.length).toBeGreaterThan(0);
    expect(glossary.length).toBeGreaterThan(0);
  });
  it("has unique IDs, the specified prices and six different decision mechanics", () => {
    for (const list of [purchases, goals, tasks, events])
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    expect(purchases.map((item) => item.price)).toEqual([
      20, 30, 15, 10, 35, 30, 45, 20, 60, 15,
    ]);
    expect(goals.map((goal) => [goal.id, goal.cost])).toEqual([
      ["scooter", 200],
      ["pet_house", 300],
      ["space_trip", 500],
    ]);
    expect(new Set(tasks.map((task) => task.type)).size).toBe(6);
    expect(events.map((event) => event.id)).toEqual([
      "event_discount",
      "event_required_expense",
      "event_bonus",
      "event_impulse",
      "event_skip",
      "event_goal",
    ]);
  });
  it("rejects an incomplete decision and dangling feedback references", () => {
    expect(
      InteractiveLearningTaskDefinitionSchema.safeParse({
        ...tasks[0],
        successConditions: [],
      }).success,
    ).toBe(false);
    expect(
      InteractiveLearningTaskDefinitionSchema.safeParse({
        ...tasks[0],
        feedback: [],
      }).success,
    ).toBe(false);
  });
  it("does not accidentally treat interactive content as a legacy quiz or a charge", () => {
    expect(() =>
      completeTask(createDemoProfile(), tasks[0]!, {
        answer: "",
        transactionId: "x",
        completedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow("INVALID_TASK_ACTION");
    expect(() =>
      applyGameEvent(createDemoProfile(), events[0]!, {
        transactionId: "x",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow("INVALID_EVENT_ACTION");
  });
});
