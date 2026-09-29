import { dailySituations } from "@finni/content";
import { describe, expect, it } from "vitest";
import {
  confirmBudgetPlan,
  createInitialProfile,
  depositToSavings,
  executePurchase,
  selectSavingsGoal,
  startPeriod,
  updateBudgetPlan,
  type GameProfile,
} from "@finni/shared";
import { periodNeeds, purchases, programTasks as tasks } from "@finni/content";
import {
  careAction,
  dailyTask,
  dismissHome,
  emptyHomeMemory,
  homeCandidates,
  homeMemoryKey,
  observeHome,
  readHomeMemory,
  readyToFinish,
  statusTone,
} from "./home-events";
const now = "2026-09-16T00:00:00.000Z";
const initial = () =>
  selectSavingsGoal(
    createInitialProfile({
      id: "home-test",
      petId: "pet",
      petName: "Финни",
      playerNickname: "Гость",
      appearance: { species: "cat", colorVariant: "ginger" },
      now,
    }),
    "scooter",
    now,
  );
const active = () =>
  confirmBudgetPlan(
    updateBudgetPlan(
      startPeriod(initial(), {
        periodId: "day1",
        income: 100,
        transactionId: "income",
        startedAt: now,
        mandatoryNeeds: periodNeeds(1),
      }),
      { plannedMandatory: 40, plannedOptional: 20, plannedSavings: 40 },
      now,
    ),
    now,
  );
const completeDaily = (p: GameProfile) => ({
  ...p,
  completedTasks: tasks.filter(t => t.day === 1).map(t => ({taskId: t.id, periodId: "day1", successful: true, completedAt: now})), 
});

describe("Home presentation without economy changes", () => {
  it("sorts simultaneous critical states before a task, and dismisses only the displayed event", () => {
    const p = active();
    p.pet.state = { satiety: 18, care: 20, mood: 100 };
    const before = structuredClone(p);
    let m = observeHome(p, emptyHomeMemory());
    expect(homeCandidates(p, m)[0]?.id).toBe("low:satiety");
    m = dismissHome(m, "low:satiety");
    expect(homeCandidates(p, m)[0]?.id).toBe("low:care");
    expect(p).toEqual(before);
  });
  it("preserves acknowledgements through refresh and rearms only after recovery", () => {
    const p = active();
    p.pet.state.satiety = 18;
    let m = dismissHome(observeHome(p, emptyHomeMemory()), "low:satiety");
    m = observeHome(p, readHomeMemory(JSON.stringify(m)));
    expect(homeCandidates(p, m).some((e) => e.id === "low:satiety")).toBe(
      false,
    );
    p.pet.state.satiety = 70;
    m = observeHome(p, m);
    p.pet.state.satiety = 20;
    m = observeHome(p, m);
    expect(homeCandidates(p, m)[0]?.id).toBe("low:satiety");
  });
  it("does not replay historical money; keeps only the newest feedback and never restores old feedback", () => {
    let p = active();
    p = depositToSavings(p, 20, { transactionId: "old", createdAt: now });
    let m = observeHome(p, emptyHomeMemory());
    expect(m.pending).toEqual([]);
    p = depositToSavings(p, 40, { transactionId: "new", createdAt: now });
    m = observeHome(p, m);
    expect(m.pending.map((e) => e.type)).toEqual(["milestone"]);
    expect(observeHome(p, m).pending).toEqual(m.pending);
    for (const e of m.pending) m = dismissHome(m, e.id);
    expect(observeHome(p, readHomeMemory(JSON.stringify(m))).pending).toEqual(
      [],
    );
  });
  it("completed daily task disappears instead of promoting every remaining task", () => {
    const p = completeDaily(active());
    expect(dailyTask(p)).toBeUndefined();
    expect(
      homeCandidates(p, emptyHomeMemory()).some((e) => e.type === "task"),
    ).toBe(false);
  });
  it("recommends finish only after real needs and daily task; planning never qualifies", () => {
    expect(readyToFinish(initial())).toBe(false);
    expect(readyToFinish(active())).toBe(false);
    let p = completeDaily(active());
    expect(readyToFinish(p)).toBe(false);
    p = executePurchase(
      p,
      purchases.find((i) => i.id === "lunch")!,
      { transactionId: "lunch", createdAt: now },
    );
    expect(readyToFinish(p)).toBe(false);
    for (const id of ["balloon", "care"]) p = executePurchase(p, purchases.find(item => item.id === id)!, {transactionId: id, createdAt: now});
    expect(readyToFinish(p, "2026-09-16T00:29:59.000Z")).toBe(false);
    expect(readyToFinish(p, "2026-09-16T00:30:00.000Z")).toBe(false);
    p = {...p, completedSituationIds: dailySituations(1)};
    expect(readyToFinish(p, "2026-09-16T00:30:00.000Z")).toBe(true);
  });
  it("care tiles always open matching shop items regardless of funds, tasks or day", () => {
    const p = active();
    const check = () => {
      expect(careAction(p, "satiety").href).toBe(
        "/shop?activity=feed&need=satiety",
      );
      expect(careAction(p, "mood").href).toBe("/shop?activity=play&need=mood");
      expect(careAction(p, "care").href).toBe("/shop?activity=care&need=care");
    };
    check();
    p.walletBalance = 0;
    check();
    p.completedTasks = tasks.map((t) => ({
      taskId: t.id,
      successful: true,
      completedAt: now,
      periodId: "day1",
    }));
    check();
    p.savingsBalance = 100;
    check();
    p.currentPeriod = null;
    check();
  });
  it("handles no goal, achieved goal and all stories once", () => {
    const p = active();
    p.selectedGoalId = null;
    expect(homeCandidates(p, emptyHomeMemory())[0]?.id).toBe("choose-goal");
    p.selectedGoalId = "scooter";
    p.savingsBalance = 200;
    expect(homeCandidates(p, emptyHomeMemory())[0]?.type).toBe("achievement");
    p.achievedGoalIds = ["scooter"];
    p.completedTasks = tasks.map((t) => ({
      taskId: t.id,
      successful: true,
      completedAt: now,
      periodId: "day1",
    }));
    const m = dismissHome(emptyHomeMemory(), "all-tasks");
    expect(
      homeCandidates(p, m).some((e) =>
        ["achievement", "complete", "task"].includes(e.type),
      ),
    ).toBe(false);
  });
  it("isolates saves and demo, tolerates corrupt presentation storage", () => {
    const p = initial();
    expect(homeMemoryKey(p)).not.toBe(homeMemoryKey({ ...p, demoMode: true }));
    expect(readHomeMemory("broken")).toEqual(emptyHomeMemory());
    expect(readHomeMemory('{"seen":[42],"pending":[]}')).toEqual(
      emptyHomeMemory(),
    );
  });
  it.each([
    [0, "alert"],
    [20, "alert"],
    [21, "attention"],
    [50, "attention"],
    [51, "calm"],
    [100, "calm"],
  ])("renders boundary %s as %s", (value, tone) => {
    expect(statusTone(Number(value))).toBe(tone);
  });
});

it("discards cached UI events with missing assets instead of crashing the Home screen", () => {
  expect(
    readHomeMemory(
      JSON.stringify({
        seen: [],
        pending: [
          {
            id: "bad",
            type: "speech",
            title: "bad",
            message: "bad",
            priority: 1,
            dismissible: true,
            assetId: "missing-art",
          },
        ],
      }),
    ).pending,
  ).toEqual([]);
});
