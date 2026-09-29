import { describe, expect, it } from "vitest";
import { purchases, tasks } from "@finni/content";
import { GameService } from "./game-service";
import { MemoryStorageAdapter } from "./storage";
import { DomainErrorCodeSchema } from "@finni/shared";
import { domainMessages } from "./error-messages";

const now = "2026-09-15T00:00:00.000Z";
const profileCommand = {
  id: "p",
  petId: "cat",
  petName: "Финни",
  playerNickname: "Гость",
  appearance: { species: "cat", colorVariant: "ginger" },
  now,
};
describe("Stage 2 application persistence", () => {
  it("saves and reloads after every operation of a real active day", async () => {
    const storage = new MemoryStorageAdapter();
    let game = new GameService(storage);
    const reload = async () => {
      const expected = game.getState();
      expect(await storage.loadProfile()).toEqual(expected);
      game = new GameService(storage);
      expect(await game.loadGame()).toEqual(expected);
    };
    await game.createProfile(profileCommand);
    await reload();
    await game.selectGoal("scooter", now);
    await reload();
    await game.startPeriod({
      periodId: "day",
      income: 100,
      transactionId: "income",
      startedAt: now,
    });
    await reload();
    await game.setPlan(
      { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
      now,
    );
    await reload();
    await game.confirmPlan(now);
    await reload();
    expect(game.getState()?.savingsBalance).toBe(0);
    await game.purchase(
      purchases.find((item) => item.id === "lunch")!,
      "lunch",
      now,
    );
    await reload();
    await game.purchase(
      purchases.find((item) => item.id === "ball")!,
      "ball",
      now,
    );
    await reload();
    const before = game.getState();
    await expect(
      game.purchase(
        purchases.find((item) => item.id === "game")!,
        "unaffordable",
        now,
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(game.getState()).toEqual(before);
    await reload();
    await game.completeTask(
      tasks.find((item) => item.type === "savings_choice")!,
      { actionId: "save-30" },
      "task",
      now,
    );
    await reload();
    await game.deposit(20, "deposit", now);
    await reload();
    const saved = game.getState();
    expect(game.previewWithdrawal(5)).toMatchObject({
      savingsAfter: 15,
      walletAfter: 30,
    });
    expect(game.getState()).toEqual(saved);
    await reload();
    await game.withdraw(5, "withdraw", now, true);
    await reload();
    expect(game.getState()).toMatchObject({
      walletBalance: 30,
      savingsBalance: 15,
    });
    expect(game.getState()?.transactions).toHaveLength(6);
  });
  it("rejects an overlapping financial operation before computing stale state", async () => {
    const storage = new MemoryStorageAdapter();
    const game = new GameService(storage);
    await game.createProfile(profileCommand);
    const original = storage.saveProfile.bind(storage);
    let release!: () => void;
    storage.saveProfile = async (profile) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await original(profile);
    };
    const first = game.startPeriod({
      periodId: "day",
      income: 100,
      transactionId: "income",
      startedAt: now,
    });
    await expect(
      game.startPeriod({
        periodId: "again",
        income: 100,
        transactionId: "again",
        startedAt: now,
      }),
    ).rejects.toMatchObject({ code: "ACTION_IN_PROGRESS" });
    expect(game.getState()?.walletBalance).toBe(0);
    release();
    await first;
    expect(game.getState()?.walletBalance).toBe(100);
    expect((await storage.loadProfile())?.transactions).toHaveLength(1);
  });
  it("does not publish a failed purchase save and permits a safe retry", async () => {
    const storage = new MemoryStorageAdapter();
    const game = new GameService(storage);
    await game.createProfile(profileCommand);
    await game.startPeriod({
      periodId: "day",
      income: 100,
      transactionId: "income",
      startedAt: now,
    });
    await game.setPlan(
      { plannedMandatory: 0, plannedOptional: 0, plannedSavings: 0 },
      now,
    );
    await game.confirmPlan(now);
    const before = game.getState();
    const save = storage.saveProfile.bind(storage);
    storage.saveProfile = async () => {
      throw new Error("quota");
    };
    await expect(game.purchase(purchases[0]!, "purchase", now)).rejects.toThrow(
      "quota",
    );
    expect(game.getState()).toEqual(before);
    expect(await storage.loadProfile()).toEqual(before);
    storage.saveProfile = save;
    await game.purchase(purchases[0]!, "purchase", now);
    expect(game.getState()?.walletBalance).toBe(80);
  });
  it("maps every domain code to a child-facing explanation", () => {
    for (const code of DomainErrorCodeSchema.options) {
      expect(domainMessages[code].length).toBeGreaterThan(15);
      expect(domainMessages[code]).not.toContain(code);
    }
  });
});
