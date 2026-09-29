import { describe, expect, it } from "vitest";
import {
  calculatePeriodScore,
  calculatePlanVsActual,
  closePeriod,
  confirmBudgetPlan,
  createDemoProfile,
  createBudgetPlan,
  depositToSavings,
  executePurchase,
  startPeriod,
  updateBudgetPlan,
  withdrawFromSavings,
} from "@finni/shared";
import {
  purchases,
  periodNeeds,
  feedback,
  periodContent,
  tasks,
  events,
} from "./index";
const now = "2026-09-15T00:00:00.000Z";
function active(needs = false) {
  return confirmBudgetPlan(
    updateBudgetPlan(
      startPeriod(createDemoProfile(), {
        periodId: "one",
        transactionId: "income",
        income: 100,
        startedAt: now,
        mandatoryNeeds: needs ? periodNeeds(4) : [],
      }),
      { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
      now,
    ),
    now,
  );
}
const actual = (mandatory = 40, optional = 30, savings = 30) => ({
  spentMandatory: mandatory,
  spentOptional: optional,
  savedActual: savings,
  earnedExtra: 0,
  remainingBalance: 0,
});
function score(mandatory = 40, optional = 30, savings = 30, learning = true) {
  return calculatePeriodScore({
    ...active().currentPeriod!,
    budgetActual: actual(mandatory, optional, savings),
    taskResults: learning
      ? [
          {
            taskId: "task",
            topic: "SAVINGS",
            successful: true,
            reward: 10,
            completedAt: now,
          },
        ]
      : [],
  });
}
describe("period comparison and behavior signals", () => {
  it("compares 40/30/30 against 30/40/20 in coins", () => {
    const value = calculatePlanVsActual(
      createBudgetPlan(100, {
        plannedMandatory: 40,
        plannedOptional: 30,
        plannedSavings: 30,
      }),
      actual(30, 40, 20),
    );
    expect(value.mandatory).toEqual({
      planned: 40,
      actual: 30,
      difference: -10,
    });
    expect(value.optional).toEqual({ planned: 30, actual: 40, difference: 10 });
    expect(value.savings).toEqual({ planned: 30, actual: 20, difference: -10 });
  });
  it("exact match supports all four signals", () => {
    expect(score().planVsActual.adherence).toBe(1);
    expect(Object.values(score().progressSignals)).toEqual([
      100, 100, 100, 100,
    ]);
  });
  it("no real savings removes only the savings signal and affects discipline", () => {
    expect(score(40, 30, 0).progressSignals).toMatchObject({
      savingsScore: 0,
      mandatoryCareScore: 100,
      learningScore: 100,
    });
    expect(score(40, 30, 0).progressSignals.planDisciplineScore).toBeLessThan(
      score().progressSignals.planDisciplineScore,
    );
  });
  it("optional overspend lowers discipline without erasing care or learning", () => {
    expect(score(40, 40).progressSignals.planDisciplineScore).toBeLessThan(
      score().progressSignals.planDisciplineScore,
    );
    expect(score(40, 40).progressSignals.mandatoryCareScore).toBe(100);
  });
  it("partial mandatory purchases earn partial care", () => {
    expect(score(20).mandatoryNeedsMet).toBe(false);
    expect(score(20).progressSignals.mandatoryCareScore).toBe(50);
  });
  it("learning depends on completed tasks", () => {
    expect(score(40, 30, 30, false).progressSignals).toEqual({
      ...score().progressSignals,
      learningScore: 0,
    });
  });
  it("actual daily needs require feeding, while care remains optional", () => {
    const p = active(true);
    const food = executePurchase(
      p,
      purchases.find((p) => p.id === "lunch")!,
      { transactionId: "food", createdAt: now },
    );
    expect(
      calculatePeriodScore(food.currentPeriod!).progressSignals
        .mandatoryCareScore,
    ).toBe(100);
    const cared = executePurchase(
      food,
      purchases.find((p) => p.id === "care")!,
      { transactionId: "care", createdAt: now },
    );
    expect(calculatePeriodScore(cared.currentPeriod!).mandatoryNeedsMet).toBe(
      true,
    );
  });
  it("empty plans cannot farm savings or care or discipline progress", () => {
    let p = startPeriod(createDemoProfile(), {
      periodId: "empty",
      transactionId: "income",
      income: 100,
      startedAt: now,
      mandatoryNeeds: periodNeeds(1),
    });
    p = confirmBudgetPlan(
      updateBudgetPlan(
        p,
        { plannedMandatory: 0, plannedOptional: 0, plannedSavings: 0 },
        now,
      ),
      now,
    );
    const result = closePeriod(p, now).periodHistory[0]!.periodResult!;
    expect(Object.values(result.progressSignals)).toEqual([0, 0, 0, 0]);
    expect(result.feedbackCodes).toContain("SAVINGS_ZERO");
  });
  it.each([0, 20, 30])("selects bounded feedback for savings=%i", (amount) => {
    const p = amount
      ? depositToSavings(active(), amount, {
          transactionId: "deposit",
          createdAt: now,
        })
      : active();
    const result = closePeriod(p, now).periodHistory[0]!.periodResult!;
    expect(result.feedbackCodes).toHaveLength(3);
    expect(result.feedbackCodes[1]).toBe(
      amount === 0
        ? "SAVINGS_ZERO"
        : amount === 20
          ? "SAVINGS_CAN_GROW"
          : "SAVINGS_ON_PLAN",
    );
    for (const code of result.feedbackCodes)
      expect(feedback.some((f) => f.code === code)).toBe(true);
  });
  it("withdrawn deposits do not count as savings habit", () => {
    const saved = depositToSavings(active(), 30, {
      transactionId: "deposit",
      createdAt: now,
    });
    const p = withdrawFromSavings(saved, 30, {
      transactionId: "withdraw",
      createdAt: now,
      confirmed: true,
    });
    expect(
      closePeriod(p, now).periodHistory[0]!.periodResult!.progressSignals
        .savingsScore,
    ).toBe(0);
  });
  it("clamped pet changes describe actual changes", () => {
    const p = active();
    p.pet.state = { satiety: 100, mood: 100, care: 100 };
    const result = closePeriod(p, now).periodHistory[0]!.periodResult!;
    expect(result.snapshot!.petState.satiety - 100).toBe(
      result.petStateChange.satiety,
    );
  });
  it("period content references real tasks, events and purchases", () => {
    expect(
      periodContent.taskIds.every((id) => tasks.some((t) => t.id === id)),
    ).toBe(true);
    expect(
      Object.values(periodContent.events).every((id) =>
        events.some((e) => e.id === id),
      ),
    ).toBe(true);
    expect(
      periodNeeds(4)
        .flatMap((n) => n.purchaseIds)
        .every((id) => purchases.some((p) => p.id === id)),
    ).toBe(true);
  });
});
