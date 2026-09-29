import { completeProgramDay } from "./program-test-helper";
import { describe, expect, it } from "vitest";
import {
  dayProgress,
  closePeriod,
  createInitialProfile,
  migrateProfile,
  type GameProfile,
  type TaskSubmission,
} from "@finni/shared";
import {
  dailyStories,
  goals,
  periodNeeds,
  purchases,
  tasks,
} from "@finni/content";
import { GameService } from "./game-service";
import { MemoryStorageAdapter } from "./storage";
async function buyCare(
  game: GameService,
  action: "feed" | "play" | "care",
  now: string,
) {
  if (dayProgress(game.getState()!, now)[action]) return;
  const id =
    action === "feed" ? "breakfast" : action === "play" ? "balloon" : "care";
  await game.purchase(
    purchases.find((p) => p.id === id)!,
    "care-" + action + "-" + game.getState()!.currentPeriod!.id,
    now,
  );
}
const now = "2026-09-15T00:00:00.000Z";
const end = "2026-09-15T04:00:00.000Z";
const answers: TaskSubmission[] = [
  {
    actionId: "allocate",
    allocations: { mandatory: 40, optional: 30, savings: 30 },
  },
  { actionId: "lunch-first" },
  { actionId: "save-30" },
  { actionId: "edit-cart", selectedItemIds: ["lunch", "care"] },
  { actionId: "care-now" },
  { actionId: "save-50" },
];
async function setup(storage = new MemoryStorageAdapter()) {
  const service = new GameService(storage);
  await service.createProfile({
    id: "stage3",
    petId: "cat",
    petName: "Финни",
    playerNickname: "Гость",
    appearance: { species: "cat", colorVariant: "ginger" },
    now,
  });
  await service.selectGoal("scooter", now);
  return { service, storage };
}
async function start(service: GameService, i: number) {
  await service.startPeriod({
    periodId: `day${i}`,
    transactionId: `income${i}`,
    income: 100,
    startedAt: now,
    mandatoryNeeds: periodNeeds(i),
  });
  await service.setPlan(
    {
      plannedMandatory: i === 4 ? 55 : 30,
      plannedOptional: i === 4 ? 0 : 15,
      plannedSavings: 40,
    },
    now,
  );
  await service.confirmPlan(now);
}
async function doDailyWork(service: GameService) {
  await completeProgramDay(service, now);
  for (const action of ["feed", "play", "care"] as const)
    await buyCare(service, action, now);
}
async function play(service: GameService, i: number) {
  await start(service, i);
  await service.purchase(
    purchases.find((p) => p.id === "lunch")!,
    `food${i}`,
    now,
  );
  if (i !== 4)
    await service.purchase(
      purchases.find((p) => p.id === "balloon")!,
      `want${i}`,
      now,
    );
  if (i === 2)
    await service.decideEvent("event_bonus", "receive", "bonus", now);
  if (i === 3)
    await service.decideEvent("event_discount", "skip", "discount", now);
  if (i === 4)
    await service.decideEvent("event_required_expense", "care", "care", now);
  await doDailyWork(service);
  await service.deposit(40, `deposit${i}`, now);
  return service.finishPeriod(end);
}
describe("five offline periods through GameService", () => {
  it("grows after day four and preserves progress across reloads", async () => {
    const { storage, service: initial } = await setup();
    let service = initial;
    expect(service.getState()!.pet.stage).toBe("BABY");
    for (let i = 1; i <= 5; i++) {
      const closed = await play(service, i);
      expect(closed.pet.stage).toBe(
        i < 4 ? "BABY" : "EXPLORER",
      );
      expect(closed.periodHistory).toHaveLength(i);
      expect(closed.savingsBalance).toBe(i * 40);
      expect(closed.selectedGoalId).toBe("scooter");
      expect(
        closed.transactions.filter((t) => t.type === "PERIOD_INCOME"),
      ).toHaveLength(i);
      service = new GameService(storage);
      expect(await service.loadGame()).toEqual(closed);
      if (i === 4) {
        await service.seeEvolution(`day${i}`, now);
        const acknowledged = service.getState();
        service = new GameService(storage);
        expect(await service.loadGame()).toEqual(acknowledged);
        expect(service.getState()!.periodHistory.at(-1)!.evolutionSeen).toBe(
          true,
        );
      }
    }
    expect(service.getState()!.pet.progress).toEqual({
      mandatoryCare: 500,
      planDiscipline: 412,
      savings: 500,
      learning: 740,
      completedPeriods: 5,
    });
    expect(service.getState()!.walletBalance).toBe(150);
    const before = service.getState()!;
    await service.seeGoal("scooter", now);
    await service.selectGoal("pet_house", now);
    expect(service.getState()!.savingsBalance).toBe(0);
    expect(service.getState()!.walletBalance).toBe(before.walletBalance + 200 - goals[0]!.cost);
    expect(service.getState()!.achievedGoalIds).toEqual(["scooter"]);
  });
  it("rejects double close and duplicate income across reload and subsequent days", async () => {
    const { service, storage } = await setup();
    const closed = await play(service, 1);
    await expect(service.finishPeriod(end)).rejects.toMatchObject({
      code: "NO_ACTIVE_PERIOD",
    });
    const reloaded = new GameService(storage);
    await reloaded.loadGame();
    await expect(reloaded.finishPeriod(end)).rejects.toMatchObject({
      code: "NO_ACTIVE_PERIOD",
    });
    expect(reloaded.getState()).toEqual(closed);
    await expect(
      service.startPeriod({
        periodId: "day1",
        transactionId: "other",
        income: 100,
        startedAt: now,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_ACTION" });
    await expect(
      service.startPeriod({
        periodId: "day2",
        transactionId: "income1",
        income: 100,
        startedAt: now,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_ACTION" });
    await start(service, 2);
    await expect(
      service.startPeriod({
        periodId: "day3",
        transactionId: "income3",
        income: 100,
        startedAt: now,
      }),
    ).rejects.toMatchObject({ code: "NO_ACTIVE_PERIOD" });
    expect(service.getState()!.walletBalance).toBe(closed.walletBalance + 100);
  });
  it.each([4, 5])(
    "a weak period after %i good periods does not regress stage",
    async (count) => {
      const { service } = await setup();
      for (let i = 1; i <= count; i++) await play(service, i);
      const before = service.getState()!.pet.stage;
      await start(service, count + 1);
      await doDailyWork(service);
      const closed = await service.finishPeriod(end);
      expect(closed.pet.stage).toBe(before);
      expect(
        closed.periodHistory.at(-1)!.periodResult!.feedbackCodes,
      ).toContain("SAVINGS_ZERO");
    },
  );
  it("discount affects wallet, optional actual and PetState once, and permits skip without money", async () => {
    const { service } = await setup();
    await play(service, 1);
    await play(service, 2);
    await start(service, 3);
    const before = service.getState()!;
    await service.decideEvent("event_discount", "buy", "discount-buy", now);
    const after = service.getState()!;
    expect(after.walletBalance).toBe(before.walletBalance - 28);
    expect(after.currentPeriod!.budgetActual.spentOptional).toBe(28);
    expect(after.transactions.at(-1)).toMatchObject({
      type: "EVENT_EXPENSE",
      category: "OPTIONAL",
      amount: 28,
      metadata: { eventId: "event_discount" },
    });
    await expect(
      service.decideEvent("event_discount", "buy", "again", now),
    ).rejects.toMatchObject({ code: "DUPLICATE_ACTION" });
    expect(service.getState()).toEqual(after);
    await expect(
      service.decideEvent("event_bonus", "receive", "wrong-day", now),
    ).rejects.toMatchObject({ code: "INVALID_EVENT_ACTION" });
  });
  it("insufficient event funds leaves the whole profile untouched and allows skipping", async () => {
    const { service } = await setup();
    await play(service, 1);
    await play(service, 2);
    await start(service, 3);
    await service.deposit(service.getState()!.walletBalance, "all", now);
    const before = service.getState();
    await expect(
      service.decideEvent("event_discount", "buy", "short", now),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(service.getState()).toEqual(before);
    await service.decideEvent("event_discount", "skip", "skip", now);
    expect(service.getState()!.transactions).toEqual(before!.transactions);
    expect(service.getState()!.currentPeriod!.eventDecisions).toHaveLength(1);
  });
  it("failed close save publishes nothing; retry awards exactly once", async () => {
    class FailingStorage extends MemoryStorageAdapter {
      fail = false;
      override async saveProfile(p: GameProfile) {
        if (this.fail) throw new Error("disk full");
        await super.saveProfile(p);
      }
    }
    const storage = new FailingStorage();
    const { service } = await setup(storage);
    await start(service, 1);
    await doDailyWork(service);
    const before = service.getState();
    storage.fail = true;
    await expect(service.finishPeriod(end)).rejects.toThrow("disk full");
    expect(service.getState()).toEqual(before);
    expect(await storage.loadProfile()).toEqual(before);
    storage.fail = false;
    const closed = await service.finishPeriod(end);
    expect(closed.periodHistory).toHaveLength(1);
    expect(closed.pet.progress.completedPeriods).toBe(1);
  });
  it("history snapshots stay unchanged after later spending and goal changes", async () => {
    const { service } = await setup();
    await play(service, 1);
    const first = structuredClone(service.getState()!.periodHistory[0]);
    await play(service, 2);
    await service.selectGoal(goals[1]!.id, now);
    expect(service.getState()!.periodHistory[0]).toEqual(first);
    expect(first!.periodResult!.snapshot!.selectedGoalId).toBe("scooter");
    expect(first!.periodResult!.snapshot!.savingsBalance).toBe(40);
  });
  it("migrates real v1 shapes, preserving history and stage without replay or fabricated snapshots", async () => {
    const { service } = await setup();
    await play(service, 1);
    const raw = JSON.parse(JSON.stringify(service.getState()));
    raw.schemaVersion = 1;
    delete raw.achievedGoalIds;
    for (const p of raw.periodHistory) {
      delete p.mandatoryNeeds;
      delete p.eventDecisions;
      delete p.evolutionSeen;
      delete p.periodResult.snapshot;
    }
    const migrated = migrateProfile(raw);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.savingsBalance).toBe(40);
    expect(migrated.periodHistory[0]!.periodResult!.snapshot).toBeNull();
    expect(migrated.periodHistory[0]!.evolutionSeen).toBe(true);
    expect(migrated.pet).toEqual(raw.pet);
    expect(() => closePeriod(migrated, now)).toThrow("NO_ACTIVE_PERIOD");
    expect(() => migrateProfile({ ...raw, schemaVersion: 999 })).toThrow(
      "INVALID_PROFILE",
    );
    expect(
      createInitialProfile({
        id: "p",
        petId: "pet",
        petName: "Финни",
        playerNickname: "Гость",
        appearance: { species: "cat", colorVariant: "ginger" },
        now,
      }).pet.stage,
    ).toBe("BABY");
  });
});
