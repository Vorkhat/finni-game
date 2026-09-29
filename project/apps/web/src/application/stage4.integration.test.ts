import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "./storage";
import {
  DEMO_PROFILE_KEY,
  LocalStorageAdapter,
  NORMAL_PROFILE_KEY,
} from "./storage";
import { GameService } from "./game-service";

class FakeLocalStorage implements KeyValueStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const now = "2026-09-15T00:00:00.000Z";

describe("stage 4 profile lifecycle", () => {
  it("plays and resets demo without changing the normal save", async () => {
    const storage = new FakeLocalStorage();
    const normal = new GameService(new LocalStorageAdapter(storage, NORMAL_PROFILE_KEY));
    await normal.createProfile({
      id: "normal",
      petId: "normal-pet",
      petName: "Искорка",
      playerNickname: "Гость",
      appearance: { species: "dragon", colorVariant: "turquoise" },
      now,
    });
    await normal.selectGoal("pet_house", now);
    await normal.startPeriod({
      periodId: "normal-day",
      income: 100,
      startedAt: now,
      transactionId: "normal-income",
    });
    const normalSnapshot = normal.getState();

    const demo = new GameService(new LocalStorageAdapter(storage, DEMO_PROFILE_KEY));
    await demo.createDemo();
    await demo.selectGoal("scooter", now);
    await demo.startPeriod({
      periodId: "demo-day",
      income: 100,
      startedAt: now,
      transactionId: "demo-income",
    });
    expect(demo.getState()?.walletBalance).toBe(100);
    await demo.resetDemo();
    expect(demo.getState()).toEqual(await new GameService(new LocalStorageAdapter(storage, DEMO_PROFILE_KEY)).loadGame());
    expect(await new GameService(new LocalStorageAdapter(storage, NORMAL_PROFILE_KEY)).loadGame()).toEqual(normalSnapshot);
  });

  it("reset keeps the chosen pet but clears gameplay, while delete removes the profile", async () => {
    const storage = new FakeLocalStorage();
    const service = new GameService(new LocalStorageAdapter(storage, NORMAL_PROFILE_KEY));
    await service.createProfile({
      id: "normal",
      petId: "pet",
      petName: "Финни",
      playerNickname: "Гость",
      appearance: { species: "cat", colorVariant: "ginger" },
      now,
    });
    await service.selectGoal("scooter", now);
    const reset = await service.resetGame({
      id: "reset",
      petId: "reset-pet",
      petName: "Финни",
      playerNickname: "Гость",
      appearance: { species: "cat", colorVariant: "ginger" },
      now,
    });
    expect(reset.selectedGoalId).toBeNull();
    expect(reset.periodHistory).toEqual([]);
    expect(reset.demoMode).toBe(false);
    await service.deleteGame();
    expect(await service.loadGame()).toBeNull();
  });
});
