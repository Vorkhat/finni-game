import { describe, expect, it } from "vitest";
import {
  createDemoProfile,
  awardSituationLearning,
  calculatePetStage,
  migrateProfile,
} from "@finni/shared";
import { situations } from "@finni/content";
import { GameService } from "./game-service";
import {
  LocalStorageAdapter,
  MemoryStorageAdapter,
  NORMAL_PROFILE_KEY,
  DEMO_PROFILE_KEY,
} from "./storage";
const now = "2026-09-19T00:00:00.000Z";

describe("final QA: situation persistence and progression", () => {
  it("uses an explicit clock when creating and resetting demo data", async () => {
    const service = new GameService(new MemoryStorageAdapter(), () => new Date(now));
    const initial = await service.createDemo();
    expect(initial.needsUpdatedAt).toBe(now);
    expect((await service.resetDemo()).needsUpdatedAt).toBe(now);
  });
  it("rejects writes and deletion from a stale game instance", async () => {
    const storage = new MemoryStorageAdapter();
    const first = new GameService(storage);
    await first.createDemo();
    const stale = new GameService(storage);
    await stale.loadGame();

    const saved = await first.completeSituation("S01", situations[0]!.correct, now);
    await expect(stale.completeSituation("S01", situations[0]!.correct, now))
      .rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
    await expect(stale.deleteGame())
      .rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
    expect(await storage.loadProfile()).toEqual(saved);
  });
  it("commits a solved ID and progress together and rejects wrong/locked answers", async () => {
    const storage = new MemoryStorageAdapter();
    const service = new GameService(storage);
    await service.createDemo();
    await expect(
      service.completeSituation("S01", (situations[0]!.correct + 1) % 3, now),
    ).rejects.toThrow("INVALID_TASK_ACTION");
    await expect(
      service.completeSituation("S07", situations[6]!.correct, now),
    ).rejects.toThrow("INVALID_TASK_ACTION");
    const saved = await service.completeSituation(
      "S01",
      situations[0]!.correct,
      now,
    );
    expect(saved.completedSituationIds).toEqual(["S01"]);
    expect(saved.pet.progress.learning).toBe(8);
    expect(
      await service.completeSituation("S01", situations[0]!.correct, now),
    ).toEqual(saved);
    const reloaded = new GameService(storage);
    expect(await reloaded.loadGame()).toEqual(saved);
    expect((await reloaded.resetDemo()).completedSituationIds).toEqual([]);
  });
  it("storage failure never consumes a reward or publishes unsaved progress", async () => {
    class Failing extends MemoryStorageAdapter {
      fail = false;
      override async saveProfile(
        profile: Parameters<MemoryStorageAdapter["saveProfile"]>[0],
      ) {
        if (this.fail) throw new Error("quota");
        await super.saveProfile(profile);
      }
    }
    const storage = new Failing();
    const service = new GameService(storage);
    const initial = await service.createDemo();
    storage.fail = true;
    await expect(
      service.completeSituation("S01", situations[0]!.correct, now),
    ).rejects.toThrow("quota");
    expect(service.getState()).toEqual(initial);
    expect(await storage.loadProfile()).toEqual(initial);
    storage.fail = false;
    expect(
      (await service.completeSituation("S01", situations[0]!.correct, now)).pet
        .progress.learning,
    ).toBe(8);
  });
  it("normal and demo completion/reset/delete are independent", async () => {
    const values = new Map<string, string>();
    const kv = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: (k: string) => {
        values.delete(k);
      },
    };
    const normal = new GameService(
      new LocalStorageAdapter(kv, NORMAL_PROFILE_KEY),
    );
    const demo = new GameService(new LocalStorageAdapter(kv, DEMO_PROFILE_KEY));
    const normalAdapter = new LocalStorageAdapter(kv, NORMAL_PROFILE_KEY);
    await normalAdapter.saveProfile({
      ...createDemoProfile(),
      id: "normal",
      demoMode: false,
    });
    await normal.loadGame();
    const saved = await normal.completeSituation(
      "S01",
      situations[0]!.correct,
      now,
    );
    expect((await demo.createDemo()).completedSituationIds).toEqual([]);
    await demo.completeSituation("S01", situations[0]!.correct, now);
    await demo.resetDemo();
    await demo.deleteGame();
    expect(await normalAdapter.loadProfile()).toEqual(saved);
  });
  it("persists an evolution from a situation and never skips a stage", () => {
    const p = createDemoProfile();
    p.pet.progress = {
      mandatoryCare: 745,
      planDiscipline: 0,
      savings: 0,
      learning: 0,
      completedPeriods: 4,
    };
    const grown = awardSituationLearning(p, "S01", now);
    expect(
      migrateProfile(JSON.parse(JSON.stringify(grown))).pendingEvolution,
    ).toEqual({ from: "BABY", to: "EXPLORER" });
    expect(
      calculatePetStage(
        { ...p.pet.progress, mandatoryCare: 2000, completedPeriods: 8 },
        "BABY",
      ),
    ).toBe("EXPLORER");
  });
});

it("rejects structurally valid but impossible saves before mounting gameplay", () => {
  const p = createDemoProfile();
  p.pet.species = "dragon";
  expect(() => migrateProfile(p)).toThrow("INVALID_PROFILE");
});

it("defers another stage until the pending situation evolution is acknowledged", () => {
  const p = createDemoProfile();
  p.pet.stage = "EXPLORER";
  p.pendingEvolution = { from: "BABY", to: "EXPLORER" };
  p.pet.progress = {
    mandatoryCare: 1400,
    planDiscipline: 0,
    savings: 0,
    learning: 0,
    completedPeriods: 8,
  };
  const next = awardSituationLearning(p, "02", now);
  expect(next.pet.stage).toBe("EXPLORER");
  expect(next.pendingEvolution).toEqual(p.pendingEvolution);
  expect(
    awardSituationLearning({ ...next, pendingEvolution: null }, "03", now).pet
      .stage,
  ).toBe("FINNI_PRO");
});
