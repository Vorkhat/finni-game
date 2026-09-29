import { describe, expect, it } from "vitest";
import {
  DomainError,
  awardSituationLearning,
  calculateGoalProgress,
  calculateGoalRemaining,
  closePeriod,
  completeTask,
  confirmBudgetPlan,
  createBudgetPlan,
  createDemoProfile,
  createInitialProfile,
  depositToSavings,
  executePurchase,
  goalEta,
  migrateProfile,
  previewSavingsWithdrawal,
  startPeriod,
  updateBudgetPlan,
  withdrawFromSavings,
} from "./economy";
import {
  GameProfileSchema,
  type GameProfile,
  type LearningTaskDefinition,
  type PurchaseDefinition,
} from "./schemas";

const at = (minute: number) =>
  `2026-01-01T00:${String(minute).padStart(2, "0")}:00.000Z`;
const newProfile = () =>
  createInitialProfile({
    id: "p1",
    playerNickname: "Лис",
    petId: "pet1",
    petName: "Финни",
    appearance: { species: "fox", colorVariant: "orange" },
    now: at(0),
  });
const activeProfile = () =>
  confirmBudgetPlan(
    updateBudgetPlan(
      startPeriod(newProfile(), {
        periodId: "period-1",
        income: 100,
        startedAt: at(1),
        transactionId: "income-1",
      }),
      { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 20 },
      at(2),
    ),
    at(3),
  );
const mandatory: PurchaseDefinition = {
  id: "food",
  title: "Еда",
  price: 40,
  kind: "mandatory",
  effect: { satiety: 4 },
};
const optional: PurchaseDefinition = {
  id: "ball",
  title: "Мяч",
  price: 30,
  kind: "optional",
  effect: { mood: 3 },
};
const task: LearningTaskDefinition = {
  id: "task-1",
  topic: "BUDGET_PLANNING",
  text: "2+2?",
  answer: 4,
  explain: "Четыре",
  reward: 10,
};
const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw new Error("Expected DomainError");
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
  }
};

describe("situation growth", () => {
  it("adds learning progress and can advance the stage", () => {
    const profile = { ...newProfile() };
    profile.pet = {
      ...profile.pet,
      progress: {
        ...profile.pet.progress,
        mandatoryCare: 745,
        completedPeriods: 4,
      },
    };
    const grown = awardSituationLearning(profile, "01", at(4));
    expect(grown.pet.progress.learning).toBe(profile.pet.progress.learning + 8);
    expect(grown.pet.stage).toBe("EXPLORER");
    expect(grown.pendingEvolution).toEqual({ from: "BABY", to: "EXPLORER" });
    expect(awardSituationLearning(grown, "01", at(5))).toEqual(grown);
  });
});

describe("profile and schema", () => {
  it("creates valid initial values and supports JSON round-trip", () => {
    const profile = newProfile();
    expect(profile.walletBalance).toBe(0);
    expect(profile.savingsBalance).toBe(0);
    expect(profile.pet.stage).toBe("BABY");
    expect(
      GameProfileSchema.parse(JSON.parse(JSON.stringify(profile))),
    ).toEqual(profile);
  });

  it("migrates a versionless profile and rejects invalid data", () => {
    const { schemaVersion: _, ...legacy } = newProfile();
    expect(migrateProfile(legacy).schemaVersion).toBe(2);
    expectCode(() => migrateProfile({ broken: true }), "INVALID_PROFILE");
    expectCode(() => migrateProfile({ ...newProfile(), schemaVersion: 3 }), "UNSUPPORTED_PROFILE_VERSION");
    const active = activeProfile();
    expectCode(() => migrateProfile({ ...active, walletBalance: 99999 }), "INVALID_PROFILE");
    expectCode(() => migrateProfile({ ...active, currentPeriod: {
      ...active.currentPeriod!, budgetPlan: { ...active.currentPeriod!.budgetPlan!, plannedSavings: 100000 },
    } }), "INVALID_PROFILE");
  });

  it("creates and resets the same deterministic demo profile", () => {
    expect(createDemoProfile()).toEqual(createDemoProfile());
    expect(createDemoProfile().demoMode).toBe(true);
  });
});

describe("budget", () => {
  it("creates a valid plan with an unallocated remainder", () => {
    expect(
      createBudgetPlan(100, {
        plannedMandatory: 40,
        plannedOptional: 20,
        plannedSavings: 10,
      }).unallocated,
    ).toBe(30);
  });

  it("rejects over-allocation and negative values", () => {
    expectCode(
      () =>
        createBudgetPlan(100, {
          plannedMandatory: 70,
          plannedOptional: 20,
          plannedSavings: 20,
        }),
      "INVALID_BUDGET",
    );
    expectCode(
      () =>
        createBudgetPlan(100, {
          plannedMandatory: -1,
          plannedOptional: 0,
          plannedSavings: 0,
        }),
      "INVALID_BUDGET",
    );
  });

  it("allows editing before confirmation and locks afterwards", () => {
    const planning = startPeriod(newProfile(), {
      periodId: "period-1",
      income: 100,
      startedAt: at(1),
      transactionId: "income-1",
    });
    const edited = updateBudgetPlan(
      updateBudgetPlan(
        planning,
        { plannedMandatory: 30, plannedOptional: 20, plannedSavings: 10 },
        at(2),
      ),
      { plannedMandatory: 40, plannedOptional: 20, plannedSavings: 20 },
      at(3),
    );
    const confirmed = confirmBudgetPlan(edited, at(4));
    expect(confirmed.currentPeriod?.budgetPlan?.confirmed).toBe(true);
    expectCode(
      () =>
        updateBudgetPlan(
          confirmed,
          { plannedMandatory: 1, plannedOptional: 1, plannedSavings: 1 },
          at(5),
        ),
      "BUDGET_ALREADY_CONFIRMED",
    );
  });
});

describe("transactions, purchases and savings", () => {
  it("records mandatory and optional purchases in actuals", () => {
    let profile = executePurchase(activeProfile(), mandatory, {
      transactionId: "buy-1",
      createdAt: at(4),
    });
    profile = executePurchase(profile, optional, {
      transactionId: "buy-2",
      createdAt: at(5),
    });
    expect(profile.walletBalance).toBe(30);
    expect(profile.currentPeriod?.budgetActual).toMatchObject({
      spentMandatory: 40,
      spentOptional: 30,
    });
    expect(profile.transactions.at(-1)?.source).toBe("purchase:ball");
  });

  it("never spends savings automatically and rejects an expensive purchase", () => {
    let profile = depositToSavings(activeProfile(), 80, {
      transactionId: "save-1",
      createdAt: at(4),
    });
    expect(profile.savingsBalance).toBe(80);
    expectCode(
      () =>
        executePurchase(
          profile,
          { ...optional, price: 30 },
          { transactionId: "buy-x", createdAt: at(5) },
        ),
      "INSUFFICIENT_FUNDS",
    );
    expect(profile.savingsBalance).toBe(80);
  });

  it("deposits separately and enforces wallet limits", () => {
    const profile = depositToSavings(activeProfile(), 30, {
      transactionId: "save-1",
      createdAt: at(4),
    });
    expect(profile.walletBalance).toBe(70);
    expect(profile.savingsBalance).toBe(30);
    expect(profile.currentPeriod?.budgetActual.savedActual).toBe(30);
    expectCode(
      () =>
        depositToSavings(profile, 100, {
          transactionId: "save-x",
          createdAt: at(5),
        }),
      "INSUFFICIENT_FUNDS",
    );
  });

  it("previews and then confirms a withdrawal", () => {
    const saved = depositToSavings(activeProfile(), 30, {
      transactionId: "save-1",
      createdAt: at(4),
    });
    expect(previewSavingsWithdrawal(saved, 10)).toEqual({
      amount: 10,
      walletAfter: 80,
      savingsAfter: 20,
      goalProgressLost: 10,
    });
    expectCode(
      () =>
        withdrawFromSavings(saved, 10, {
          transactionId: "withdraw-x",
          createdAt: at(5),
          confirmed: false,
        }),
      "INVALID_WITHDRAWAL",
    );
    const withdrawn = withdrawFromSavings(saved, 10, {
      transactionId: "withdraw-1",
      createdAt: at(5),
      confirmed: true,
    });
    expect(withdrawn.savingsBalance).toBe(20);
    expectCode(
      () => previewSavingsWithdrawal(withdrawn, 30),
      "INVALID_WITHDRAWAL",
    );
  });

  it("calculates goal progress, remaining amount and ETA", () => {
    const profile = depositToSavings(activeProfile(), 30, {
      transactionId: "save-1",
      createdAt: at(4),
    });
    const goal = { id: "goal", title: "Самокат", cost: 100 };
    expect(calculateGoalProgress(profile, goal)).toBe(0.3);
    expect(calculateGoalRemaining(profile, goal)).toBe(70);
    expect(goalEta(100, 30, 20)).toBe(4);
  });
});

describe("tasks, periods and pet progress", () => {
  it("does not credit the wallet through a negative purchase price", () => {
    expect(() => executePurchase(activeProfile(), { ...mandatory, price: -10 }, {
      transactionId: "bad-price", createdAt: at(4),
    })).toThrow();
  });
  it("rewards a task with an attributable transaction and prevents duplicates", () => {
    const completed = completeTask(activeProfile(), task, {
      answer: 4,
      transactionId: "reward-1",
      completedAt: at(4),
    });
    expect(completed.walletBalance).toBe(110);
    expect(completed.transactions.at(-1)).toMatchObject({
      type: "TASK_REWARD",
      source: "task:task-1",
      amount: 10,
    });
    expectCode(
      () =>
        completeTask(completed, task, {
          answer: 4,
          transactionId: "reward-2",
          completedAt: at(5),
        }),
      "TASK_ALREADY_COMPLETED",
    );
    const laterPeriod = { ...completed, currentPeriod: {
      ...completed.currentPeriod!, id: "period-2", taskResults: [],
    } };
    expectCode(() => completeTask(laterPeriod, task, {
      answer: 4, transactionId: "reward-3", completedAt: at(6),
    }), "TASK_ALREADY_COMPLETED");
  });

  it("derives Actual from transactions, closes a period, and opens the next", () => {
    let profile = executePurchase(activeProfile(), mandatory, {
      transactionId: "buy-1",
      createdAt: at(4),
    });
    profile = depositToSavings(profile, 10, {
      transactionId: "save-1",
      createdAt: at(5),
    });
    profile = closePeriod(profile, at(6));
    const result = profile.periodHistory[0]!.periodResult!;
    expect(result.planVsActual.savings).toMatchObject({
      planned: 20,
      actual: 10,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(profile.currentPeriod).toBeNull();
    expect(
      startPeriod(profile, {
        periodId: "period-2",
        income: 100,
        startedAt: at(7),
        transactionId: "income-2",
      }).currentPeriod?.index,
    ).toBe(2);
  });

  it("changes reversible state but never regresses an earned stage", () => {
    const progressed: GameProfile = {
      ...activeProfile(),
      pet: {
        ...activeProfile().pet,
        stage: "EXPLORER",
        progress: {
          mandatoryCare: 400,
          planDiscipline: 400,
          savings: 400,
          learning: 400,
          completedPeriods: 4,
        },
      },
    };
    const closed = closePeriod(progressed, at(9));
    expect(closed.pet.state.satiety).toBeLessThanOrEqual(100);
    expect(["EXPLORER", "FINNI_PRO"]).toContain(closed.pet.stage);
  });
});
