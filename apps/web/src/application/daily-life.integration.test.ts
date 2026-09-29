import { completeProgramDay } from "./program-test-helper";
import { describe, expect, it } from "vitest";
import {
  DAY_DURATION_MS,
  advancePetNeeds,
  dayProgress,
  GameProfileSchema,
} from "@finni/shared";
import { dailyStories, tasks, purchases } from "@finni/content";
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
const at = (minutes: number) =>
  new Date(Date.UTC(2026, 8, 21) + minutes * 60000).toISOString();
async function setup() {
  const storage = new MemoryStorageAdapter();
  const game = new GameService(storage);
  await game.createProfile({
    id: "daily",
    petId: "pet",
    petName: "Финни",
    playerNickname: "Игрок",
    appearance: { species: "cat", colorVariant: "ginger" },
    now: at(0),
  });
  await game.selectGoal("scooter", at(0));
  await game.startPeriod({
    periodId: "day1",
    transactionId: "income1",
    income: 100,
    startedAt: at(0),
  });
  await game.setPlan(
    { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
    at(0),
  );
  await game.confirmPlan(at(0));
  return { game, storage };
}
async function task(game: GameService) { await completeProgramDay(game, at(1)); }
async function care(game: GameService) {
  for (const action of ["feed", "play", "care"] as const)
    await buyCare(game, action, at(2));
}

describe("thirty-minute daily life", () => {
  it("blocks skipping the day, including direct service calls", async () => {
    const { game } = await setup();
    await expect(game.finishPeriod(at(0))).rejects.toMatchObject({
      code: "DAY_NOT_READY",
    });
    await expect(game.finishPeriod(at(240))).rejects.toMatchObject({
      code: "DAY_NOT_READY",
    });
    expect(game.getState()!.walletBalance).toBe(100);
    expect(game.getState()!.periodHistory).toHaveLength(0);
  });
  it("requires feeding and learning but not extra play or care purchases, persists through reload, and unlocks exactly at thirty minutes", async () => {
    const { game, storage } = await setup();
    await task(game);
    await buyCare(game, "feed", at(2));

    const reload = new GameService(storage);
    await reload.loadGame();
    await expect(reload.finishPeriod(at(29.999))).rejects.toMatchObject({
      code: "DAY_NOT_READY",
    });
    const result = await reload.finishPeriod(at(30));
    expect(result.periodHistory).toHaveLength(1);
    expect(result.currentPeriod).toBeNull();
    await expect(reload.finishPeriod(at(241))).rejects.toMatchObject({
      code: "NO_ACTIVE_PERIOD",
    });
    expect(DAY_DURATION_MS).toBe(1800000);
  });
  it("does not replace learning with elapsed time or care", async () => {
    const { game } = await setup();
    await care(game);
    await expect(game.finishPeriod(at(240))).rejects.toMatchObject({
      code: "DAY_NOT_READY",
    });
  });
  it("counts food, play and care purchases separately", async () => {
    const { game } = await setup();
    for (const id of ["breakfast", "ball", "care"])
      await game.purchase(
        purchases.find((p) => p.id === id)!,
        id,
        at(2),
      );
    expect(dayProgress(game.getState()!, at(240))).toMatchObject({
      feed: true,
      play: true,
      care: true,
      task: false,
    });
  });
  it("continues offline decay after four hours and makes every need low after a day", async () => {
    const { game } = await setup();
    const initial = game.getState()!;
    const fourHours = advancePetNeeds(initial, at(240));
    const later = advancePetNeeds(fourHours, at(1440));
    expect(later.pet.state).toEqual({ satiety: 20, mood: 20, care: 20 });
    expect(advancePetNeeds(later, at(1440))).toBe(later);
    expect(advancePetNeeds(later, at(-10))).toBe(later);
    expect(GameProfileSchema.parse(later).needsUpdatedAt).toBe(at(1440));
    const week = advancePetNeeds(later, at(10080));
    expect(week.pet.state).toEqual(later.pet.state);
  });
  it("decays between days and preserves fractional intervals and legacy accounting", async () => {
    const { game } = await setup();
    const original = game.getState()!;
    const betweenDays = { ...original, currentPeriod: null };
    expect(advancePetNeeds(betweenDays, at(1440)).pet.state).toEqual({
      satiety: 20,
      mood: 20,
      care: 20,
    });
    const partial = advancePetNeeds(original, at(45));
    expect(partial.needsUpdatedAt).toBe(at(30));
    expect(advancePetNeeds(partial, at(59))).toBe(partial);
    const legacy = {
      ...original,
      needsUpdatedAt: undefined,
      currentPeriod: { ...original.currentPeriod!, needsDecaySteps: 8 },
    };
    expect(advancePetNeeds(legacy, at(240))).toBe(legacy);
    expect(advancePetNeeds(legacy, at(270)).pet.state.satiety).toBe(
      original.pet.state.satiety - 4,
    );
  });
  it("ignores legacy manual checks and rejects failed purchases", async () => {
    const { game, storage } = await setup();
    await storage.saveProfile({
      ...game.getState()!,
      currentPeriod: {
        ...game.getState()!.currentPeriod!,
        dailyCare: ["feed", "play", "care"],
      },
    });
    await game.loadGame();
    expect(dayProgress(game.getState()!, at(240))).toMatchObject({
      feed: false,
      play: false,
      care: false,
    });
    await game.deposit(100, "all", at(1));
    await expect(buyCare(game, "feed", at(2))).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
    expect(dayProgress(game.getState()!, at(240)).feed).toBe(false);
  });
  it("offers exactly one story beyond day five and permits next-day practice", () => {
    for (let day = 1; day <= 30; day++) {
      expect(dailyStories(day)).toHaveLength(1);
      expect(tasks.some((t) => t.id === dailyStories(day)[0])).toBe(true);
    }
  });
});

describe("new dream settlement", () => {
  it.each([200, 250])(
    "spends the completed goal, returns excess and starts at zero (%s coins)",
    async (balance) => {
      const { game, storage } = await setup();
      const seeded = game.getState()!;
      await storage.saveProfile({
        ...seeded,
        savingsBalance: balance,
        // migrateProfile enforces that balances never exceed credited income,
        // so back the seeded savings with a real income transaction.
        transactions: [
          ...seeded.transactions,
          {
            id: `fixture:topup:${balance}`,
            type: "PERIOD_INCOME",
            amount: balance,
            source: "fixture:topup",
            category: "INCOME",
            periodId: seeded.currentPeriod!.id,
            createdAt: at(0),
            metadata: {},
          },
        ],
      });
      await game.loadGame();
      await game.seeGoal("scooter", at(1));
      const next = await game.selectGoal("pet_house", at(2));
      expect(next.savingsBalance).toBe(0);
      expect(next.walletBalance).toBe(100 + balance - 200);
      expect(next.achievedGoalIds).toContain("scooter");
      expect(
        next.transactions.filter((t) => t.type === "GOAL_PURCHASE"),
      ).toHaveLength(1);
      await game.selectGoal("pet_house", at(3));
      expect(game.getState()).toEqual(next);
      const reload = new GameService(storage);
      expect((await reload.loadGame())!.savingsBalance).toBe(0);
    },
  );
  it("returns unfinished savings without inventing an achievement", async () => {
    const { game } = await setup();
    await game.deposit(40, "save", at(1));
    const next = await game.selectGoal("pet_house", at(2));
    expect(next.savingsBalance).toBe(0);
    expect(next.walletBalance).toBe(100);
    expect(next.achievedGoalIds).not.toContain("scooter");
  });
});
