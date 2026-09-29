import { describe, expect, it } from "vitest";
import {
  createInitialProfile,
  startPeriod,
  updateBudgetPlan,
  confirmBudgetPlan,
  depositToSavings,
  PetNameSchema,
} from "@finni/shared";
import { GameService } from "./game-service";
import { MemoryStorageAdapter } from "./storage";
import { bootDestination } from "./boot-route";

const now = "2026-09-15T00:00:00.000Z";
const command = {
  id: "local-profile",
  petId: "cat-1",
  petName: "Финни",
  playerNickname: "Гость",
  now,
  appearance: {
    species: "cat",
    colorVariant: "ginger",
    accessoryVariant: "green-scarf",
  },
};

describe("first playable persistence", () => {
  it("boots into onboarding without a profile and resumes goal selection after creation", async () => {
    const storage = new MemoryStorageAdapter();
    const game = new GameService(storage);
    expect(bootDestination(await game.loadGame())).toBe("/onboarding");
    const created = await game.createProfile(command);
    expect(await storage.loadProfile()).toEqual(created);
    expect(bootDestination(created)).toBe("/goal/select");
    const chosen = await game.selectGoal("scooter", now);
    expect(bootDestination(chosen)).toBe("/home");
    const reloaded = await new GameService(storage).loadGame();
    expect(reloaded?.pet).toEqual(chosen.pet);
    expect(reloaded?.selectedGoalId).toBe("scooter");
    expect(reloaded).toEqual(chosen);
  });
  it("restores wallet, savings, progress and an existing current period exactly", async () => {
    const storage = new MemoryStorageAdapter();
    let profile = startPeriod(createInitialProfile(command), {
      periodId: "day-1",
      income: 100,
      startedAt: now,
      transactionId: "income",
    });
    profile = confirmBudgetPlan(
      updateBudgetPlan(
        profile,
        { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
        now,
      ),
      now,
    );
    profile = depositToSavings(profile, 30, {
      transactionId: "deposit",
      createdAt: now,
    });
    await storage.saveProfile(profile);
    const game = new GameService(storage);
    const loaded = await game.loadGame();
    expect(loaded).toEqual(profile);
    expect(loaded?.walletBalance).toBe(70);
    expect(loaded?.savingsBalance).toBe(30);
  });
  it.each(["", " ", "a", "Ф".repeat(17)])(
    "rejects an invalid pet name: %j",
    async (name) => {
      const storage = new MemoryStorageAdapter();
      const game = new GameService(storage);
      expect(PetNameSchema.safeParse(name).success).toBe(false);
      await expect(
        game.createProfile({ ...command, petName: name }),
      ).rejects.toMatchObject({ code: "INVALID_PET_NAME" });
      expect(await storage.hasProfile()).toBe(false);
    },
  );
  it("trims the pet name and does not publish a failed save", async () => {
    expect(
      createInitialProfile({ ...command, petName: "  Финни  " }).pet.name,
    ).toBe("Финни");
    const storage = new MemoryStorageAdapter();
    storage.saveProfile = async () => {
      throw new Error("QuotaExceededError");
    };
    const game = new GameService(storage);
    await expect(game.createProfile(command)).rejects.toThrow();
    expect(game.getState()).toBeNull();
  });
  it("rejects a goal missing from the content catalogue", async () => {
    const game = new GameService(new MemoryStorageAdapter());
    await game.createProfile(command);
    await expect(game.selectGoal("absent", now)).rejects.toMatchObject({
      code: "GOAL_NOT_SELECTED",
    });
    expect(game.getState()?.selectedGoalId).toBeNull();
  });
});
