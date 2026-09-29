import { describe, expect, it } from "vitest";
import { GameProfileSchema, type GameProfile } from "@finni/shared";
import {
  purchases,
  dailySituations,
  situations,
  programDailyTasks,
} from "@finni/content";
import { programTestAnswers } from "../../../../packages/content/program-test-answers";
import { GameService } from "./game-service";
import { MemoryStorageAdapter } from "./storage";
import { completeProgramDay } from "./program-test-helper";
const at = (minutes: number) =>
  new Date(Date.UTC(2026, 8, 25) + minutes * 60000).toISOString();
const command = (id = "first") => ({
  id,
  petId: id,
  petName: "Искорка",
  playerNickname: "Гость",
  appearance: { species: "dragon", colorVariant: "turquoise" },
  now: at(0),
});
async function setup() {
  const storage = new MemoryStorageAdapter(),
    game = new GameService(storage);
  await game.createProfile(command());
  await game.selectGoal("scooter", at(0));
  return { game, storage };
}
async function begin(game: GameService, day: number) {
  const now = at((day - 1) * 30);
  await game.startPeriod({
    periodId: `day${day}`,
    transactionId: `income${day}`,
    income: 100,
    startedAt: now,
  });
  await game.setPlan(
    { plannedMandatory: 35, plannedOptional: 15, plannedSavings: 50 },
    now,
  );
  await game.confirmPlan(now);
}
async function buy(game: GameService, id: string, minute = 0) {
  await game.purchase(
    purchases.find((p) => p.id === id)!,
    `${id}:${game.getState()!.currentPeriod!.index}`,
    at(minute),
  );
}
async function tenDays() {
  const result = await setup();
  for (let day = 1; day <= 10; day++) {
    await begin(result.game, day);
    await buy(result.game, "breakfast", (day - 1) * 30);
    await buy(result.game, "care", (day - 1) * 30);
    await completeProgramDay(result.game, at((day - 1) * 30));
    await result.game.finishPeriod(at(day * 30));
    if (day === 4 || day === 8)
      await result.game.seeEvolution(`day${day}`, at(day * 30));
  }
  return result;
}
describe("daily requirements and care between days", () => {
  it("requires all six situations and blocks red at the boundary, but not missing play/care purchases", async () => {
    const { game, storage } = await setup();
    await begin(game, 1);
    await buy(game, "breakfast");
    for (const task of programDailyTasks(1))
      await game.completeProgramTask(
        task.id,
        programTestAnswers[task.id]!,
        task.id,
        at(0),
      );
    for (const id of dailySituations(1).slice(0, 5))
      await game.completeSituation(
        id,
        situations.find((s) => s.id === id)!.correct,
        at(0),
      );
    await expect(game.finishPeriod(at(30))).rejects.toThrow("DAY_NOT_READY");
    const last = situations.find((s) => s.id === dailySituations(1)[5])!;
    await game.completeSituation(last.id, last.correct, at(0));
    const profile = game.getState()!;
    await storage.saveProfile({
      ...profile,
      pet: { ...profile.pet, state: { ...profile.pet.state, mood: 23 } },
    });
    await game.loadGame();
    // 23 becomes exactly red (20) when the half-hour expires.
    await expect(game.finishPeriod(at(30))).rejects.toThrow("DAY_NOT_READY");
    await buy(game, "balloon", 30);
    const closed = await game.finishPeriod(at(30));
    expect(closed.periodHistory).toHaveLength(1);
    expect(
      closed.transactions.some((t) => t.metadata.purchaseId === "care"),
    ).toBe(false);
  });
  it("blocks a new day after offline decay, offers actual care with no income or history rewrite", async () => {
    const { game, storage } = await setup();
    await begin(game, 1);
    await buy(game, "breakfast");
    await completeProgramDay(game, at(0));
    const closed = await game.finishPeriod(at(30));
    const history = structuredClone(closed.periodHistory);
    await storage.saveProfile({
      ...closed,
      walletBalance: 5,
      savingsBalance: 40,
    });
    await game.loadGame();
    const start = {
      periodId: "day2",
      transactionId: "income2",
      income: 100,
      startedAt: at(1470),
    };
    await expect(game.startPeriod(start)).rejects.toThrow("PET_NEEDS_CARE");
    await game.careBetweenDays("satiety", "recovery-food", at(1470));
    expect(game.getState()!.walletBalance).toBe(0);
    expect(game.getState()!.savingsBalance).toBe(25);
    await game.careBetweenDays("care", "recovery-clean", at(1470)); // also lifts mood
    expect(Object.values(game.getState()!.pet.state).every((v) => v > 20)).toBe(
      true,
    );
    const before = game.getState();
    await game.careBetweenDays("care", "recovery-clean", at(1470));
    expect(game.getState()).toEqual(before);
    expect(game.getState()!.periodHistory).toEqual(history);
    const reload = new GameService(storage);
    await reload.loadGame();
    await reload.startPeriod(start);
    expect(reload.getState()!.walletBalance).toBe(100);
    await expect(reload.startPeriod(start)).rejects.toThrow();
    expect(
      reload.getState()!.transactions.filter((t) => t.type === "PERIOD_INCOME"),
    ).toHaveLength(2);
  });
  it("allows emergency care only between days and only when a need is red", async () => {
    const { game, storage } = await setup();
    await game.refreshNeeds(at(1440));
    for (const need of ["satiety", "mood", "care"] as const)
      await game.careBetweenDays(need, need, at(1440));
    const p = game.getState()!;
    expect(p.walletBalance).toBe(0);
    expect(p.savingsBalance).toBe(0);
    expect(Object.values(p.pet.state).every((v) => v > 20)).toBe(true);
    await game.careBetweenDays("satiety", "again", at(1440));
    expect(game.getState()).toEqual(p);
    expect(GameProfileSchema.parse(await storage.loadProfile())).toEqual(p);
    await game.startPeriod({
      periodId: "d",
      transactionId: "i",
      income: 100,
      startedAt: at(1440),
    });
    await expect(game.careBetweenDays("mood", "bad", at(1440))).rejects.toThrow(
      "INVALID_TASK_ACTION",
    );
  });
});
describe("finale and personal dreams", () => {
  it("continues beyond day ten without new lessons, with one income and normal time/feeding checks", async () => {
    const { game } = await tenDays();
    await expect(begin(game, 11)).rejects.toThrow("FINALE_PENDING");
    await game.continueTogether(at(300));
    await begin(game, 11);
    await expect(game.finishPeriod(at(330))).rejects.toThrow("DAY_NOT_READY");
    await buy(game, "breakfast", 300);
    await expect(game.finishPeriod(at(329.99))).rejects.toThrow(
      "DAY_NOT_READY",
    );
    const p = await game.finishPeriod(at(330));
    expect(p.periodHistory).toHaveLength(11);
    expect(p.completedTasks).toHaveLength(20);
    expect(p.completedSituationIds).toHaveLength(60);
    expect(p.pet.stage).toBe("FINNI_PRO");
  });
  it("validates custom dreams, persists them, and settles each funded dream once", async () => {
    const { game, storage } = await tenDays();
    await game.continueTogether(at(300));
    await begin(game, 11);
    await expect(
      game.createCustomGoal(" ", 20, "custom:invalid", at(300)),
    ).rejects.toThrow("INVALID_CUSTOM_GOAL");
    await expect(
      game.createCustomGoal("Подарок", -1, "custom:invalid", at(300)),
    ).rejects.toThrow("INVALID_CUSTOM_GOAL");
    await game.deposit(250, "deposit-old", at(300));
    const before = game.getState()!;
    await game.createCustomGoal(
      " Мой секретный подарок ",
      50,
      "custom:first",
      at(300),
    );
    expect(game.getState()!.walletBalance).toBe(before.walletBalance + 50);
    expect(game.getState()!.savingsBalance).toBe(0);
    await game.deposit(60, "deposit-custom", at(300));
    await game.seeGoal("custom:first", at(300));
    await game.createCustomGoal(
      "Следующая мечта",
      100,
      "custom:second",
      at(300),
    );
    const saved = game.getState()!;
    expect(saved.achievedGoalIds).toContain("custom:first");
    expect(saved.savingsBalance).toBe(0);
    expect(
      saved.transactions
        .filter((t) => t.type === "GOAL_PURCHASE")
        .map((t) => t.amount),
    ).toEqual([200, 50]);
    await game.createCustomGoal(
      "Следующая мечта",
      100,
      "custom:second",
      at(300),
    );
    expect(game.getState()).toEqual(saved);
    const reload = new GameService(storage);
    expect(await reload.loadGame()).toEqual(GameProfileSchema.parse(saved));
    expect(saved.customGoals[0]!.title).toBe("Мой секретный подарок");
  });
  it("archives the old friend atomically, with no loss if saving fails", async () => {
    const { game } = await tenDays();
    class Failing extends MemoryStorageAdapter {
      fail = false;
      override async saveProfile(p: GameProfile) {
        if (this.fail) throw new Error("disk full");
        return super.saveProfile(p);
      }
    }
    const storage = new Failing();
    await storage.saveProfile(game.getState()!);
    const service = new GameService(storage);
    const old = await service.loadGame();
    storage.fail = true;
    await expect(service.startNewAdventure(command("new"))).rejects.toThrow(
      "disk full",
    );
    expect(service.getState()).toEqual(old);
    storage.fail = false;
    const next = await service.startNewAdventure(command("new"));
    expect(next.pet.stage).toBe("BABY");
    expect(next.periodHistory).toHaveLength(0);
    expect(next.walletBalance).toBe(0);
    expect(next.petAlbum).toHaveLength(1);
    expect(next.petAlbum[0]!.pet).toEqual(old!.pet);
    expect(next.petAlbum[0]!.daysCompleted).toBe(10);
    expect(await new GameService(storage).loadGame()).toEqual(
      GameProfileSchema.parse(next),
    );
  });
});
