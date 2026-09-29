import { describe, expect, it } from "vitest";
import { tasks, purchases, goals } from "./index";
import {
  startPeriod,
  createInitialProfile,
  updateBudgetPlan,
  confirmBudgetPlan,
  executePurchase,
  depositToSavings,
  previewSavingsWithdrawal,
  withdrawFromSavings,
  completeTask,
  evaluateTask,
  activeDayPreview,
  previewSavingsDeposit,
  adjustBudgetAllocation,
} from "@finni/shared";
import type { TaskSubmission } from "@finni/shared";

const now = "2026-09-15T00:00:00.000Z";
const command = (transactionId: string) => ({ transactionId, createdAt: now });
const initial = () =>
  createInitialProfile({
    id: "test",
    petId: "cat",
    petName: "Финни",
    playerNickname: "Гость",
    appearance: { species: "cat", colorVariant: "ginger" },
    now,
  });
const start = () =>
  startPeriod(initial(), {
    income: 100,
    periodId: "day",
    transactionId: "income",
    startedAt: now,
  });
const active = () =>
  confirmBudgetPlan(
    updateBudgetPlan(
      start(),
      { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
      now,
    ),
    now,
  );
const answers: Record<string, TaskSubmission> = {
  "assemble-budget": {
    actionId: "allocate",
    allocations: { mandatory: 40, optional: 30, savings: 30 },
  },
  "needs-first": { actionId: "lunch-first" },
  "save-for-scooter": { actionId: "save-30" },
  "fit-the-budget": {
    actionId: "edit-cart",
    selectedItemIds: ["lunch", "care", "icecream"],
  },
  "plan-changed": { actionId: "care-now" },
  "dream-or-now": { actionId: "save-50" },
};
describe("Stage 2 domain invariants", () => {
  it("income is attributable and cannot be received twice", () => {
    const profile = start();
    expect(profile.transactions).toHaveLength(1);
    expect(profile.transactions[0]).toMatchObject({
      type: "PERIOD_INCOME",
      amount: 100,
      source: "period_income",
      periodId: "day",
    });
    expect(() =>
      startPeriod(profile, {
        income: 100,
        periodId: "again",
        transactionId: "income2",
        startedAt: now,
      }),
    ).toThrow("A period is already open");
    expect(profile.walletBalance).toBe(100);
  });
  it("confirmed plan remains immutable and no planned saving is deposited", () => {
    const profile = active();
    expect(profile.savingsBalance).toBe(0);
    expect(profile.currentPeriod?.budgetActual.savedActual).toBe(0);
    expect(() =>
      updateBudgetPlan(
        profile,
        { plannedMandatory: 10, plannedOptional: 10, plannedSavings: 10 },
        now,
      ),
    ).toThrow("BUDGET_ALREADY_CONFIRMED");
    expect(() => confirmBudgetPlan(profile, now)).toThrow(
      "BUDGET_ALREADY_CONFIRMED",
    );
    expect(() =>
      adjustBudgetAllocation(
        100,
        profile.currentPeriod!.budgetPlan!,
        "plannedOptional",
        5,
      ),
    ).toThrow("INVALID_BUDGET");
  });
  it("purchase categories and pet meters are real; rejected purchase is a no-op", () => {
    let profile = executePurchase(
      active(),
      purchases.find((item) => item.id === "lunch")!,
      command("lunch"),
    );
    profile = executePurchase(
      profile,
      purchases.find((item) => item.id === "ball")!,
      command("ball"),
    );
    expect(profile.walletBalance).toBe(35);
    expect(profile.pet.state).toEqual({ satiety: 100, mood: 90, care: 70 });
    expect(activeDayPreview(profile)).toMatchObject({
      mandatory: { planned: 40, actual: 30 },
      optional: { planned: 30, actual: 35 },
      savings: { planned: 30, actual: 0 },
    });
    const before = JSON.stringify(profile);
    expect(() =>
      executePurchase(
        profile,
        purchases.find((item) => item.id === "game")!,
        command("expensive"),
      ),
    ).toThrow("INSUFFICIENT_FUNDS");
    expect(JSON.stringify(profile)).toBe(before);
    expect(
      profile.currentPeriod!.transactions.every(
        (item) => item.periodId === "day",
      ),
    ).toBe(true);
  });
  it("deposit and withdrawal preview are pure, confirmation moves money once", () => {
    const initial = active();
    expect(previewSavingsDeposit(initial, 30)).toMatchObject({
      savingsAfter: 30,
      walletAfter: 70,
    });
    expect(initial.savingsBalance).toBe(0);
    const saved = depositToSavings(initial, 30, command("deposit"));
    const snapshot = JSON.stringify(saved);
    expect(previewSavingsWithdrawal(saved, 10).savingsAfter).toBe(20);
    expect(JSON.stringify(saved)).toBe(snapshot);
    expect(() =>
      withdrawFromSavings(saved, 10, {
        ...command("withdraw"),
        confirmed: false,
      }),
    ).toThrow("INVALID_WITHDRAWAL");
    const withdrawn = withdrawFromSavings(saved, 10, {
      ...command("withdraw"),
      confirmed: true,
    });
    expect(withdrawn).toMatchObject({ walletBalance: 80, savingsBalance: 20 });
    expect(withdrawn.currentPeriod?.budgetActual.savedActual).toBe(20);
    expect(() => depositToSavings(withdrawn, 10, command("deposit"))).toThrow(
      "DUPLICATE_ACTION",
    );
    expect(() => previewSavingsDeposit(withdrawn, 81)).toThrow(
      "INSUFFICIENT_FUNDS",
    );
  });
  it.each(tasks)(
    "validates $type and rewards it once without touching real savings",
    (task) => {
      const before = active();
      const result = evaluateTask(task, answers[task.id]);
      expect(result.successful).toBe(true);
      expect(result.feedback.text.length).toBeGreaterThan(0);
      expect(result.feedback.consequence).not.toMatch(/\{\w+\}/);
      const done = completeTask(before, task, {
        answer: answers[task.id]!,
        transactionId: "reward",
        completedAt: now,
      });
      expect(done.walletBalance).toBe(100 + task.reward);
      expect(done.savingsBalance).toBe(0);
      expect(done.pet).toEqual(before.pet);
      expect(done.currentPeriod?.budgetActual).toMatchObject({
        savedActual: 0,
        spentMandatory: 0,
        spentOptional: 0,
        earnedExtra: task.reward,
      });
      expect(done.transactions.at(-1)).toMatchObject({
        type: "TASK_REWARD",
        source: `task:${task.id}`,
        amount: task.reward,
      });
      expect(done.learningProgress[task.topic].completedTasks).toBe(1);
      expect(() =>
        completeTask(done, task, {
          answer: answers[task.id]!,
          transactionId: "again",
          completedAt: now,
        }),
      ).toThrow("TASK_ALREADY_COMPLETED");
    },
  );
  it("shows toy-first consequence and permits correction without charging the profile", () => {
    const task = tasks.find((item) => item.type === "prioritize")!;
    expect(evaluateTask(task, { actionId: "toy-first" })).toMatchObject({
      wallet: 10,
      successful: false,
    });
    expect(() =>
      completeTask(active(), task, {
        answer: { actionId: "toy-first" },
        transactionId: "no",
        completedAt: now,
      }),
    ).toThrow("TASK_NOT_SUCCESSFUL");
    expect(evaluateTask(task, { actionId: "lunch-first" })).toMatchObject({
      wallet: 20,
      successful: true,
    });
  });
  it("basket feedback is computed for every combination and cannot be forged", () => {
    const task = tasks.find((item) => item.type === "shopping_cart")!;
    expect(
      evaluateTask(task, {
        actionId: "edit-cart",
        selectedItemIds: ["lunch", "care"],
      }),
    ).toMatchObject({ wallet: 25, cartTotal: 45, successful: true });
    expect(
      evaluateTask(task, {
        actionId: "edit-cart",
        selectedItemIds: ["lunch", "care", "toy"],
      }),
    ).toMatchObject({ shortage: 20, successful: false });
    for (const selectedItemIds of [["lunch", "lunch"], ["invented"]])
      expect(() =>
        evaluateTask(task, { actionId: "edit-cart", selectedItemIds }),
      ).toThrow("INVALID_TASK_ACTION");
    expect(() =>
      evaluateTask(task, {
        actionId: "edit-cart",
        selectedItemIds: [],
        successful: true,
      }),
    ).toThrow("INVALID_TASK_ACTION");
    expect(goals).toHaveLength(3);
  });
});
