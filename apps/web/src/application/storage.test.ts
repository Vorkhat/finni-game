import { describe, expect, it } from "vitest";
import { createDemoProfile } from "@finni/shared";
import {
  DEMO_PROFILE_KEY,
  LocalStorageAdapter,
  MemoryStorageAdapter,
  NORMAL_PROFILE_KEY,
  PROFILE_MODE_KEY,
  profileKey,
  readProfileMode,
  writeProfileMode,
  type KeyValueStorage,
} from "./storage";

class FakeLocalStorage implements KeyValueStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe.each([
  ["memory", () => new MemoryStorageAdapter()],
  ["localStorage", () => new LocalStorageAdapter(new FakeLocalStorage())],
])("%s storage adapter", (_name, createAdapter) => {
  it("saves, reloads, resets and deletes a profile", async () => {
    const adapter = createAdapter();
    const profile = createDemoProfile();
    expect(await adapter.hasProfile()).toBe(false);
    await adapter.saveProfile(profile);
    expect(await adapter.loadProfile()).toEqual(profile);
    await adapter.resetProfile(profile);
    expect(await adapter.hasProfile()).toBe(true);
    await adapter.deleteProfile();
    expect(await adapter.loadProfile()).toBeNull();
  });
});

describe("profile namespaces", () => {
  it("keeps normal and demo profiles independent and persists only demo mode", async () => {
    const storage = new FakeLocalStorage();
    const normal = new LocalStorageAdapter(storage, NORMAL_PROFILE_KEY);
    const demo = new LocalStorageAdapter(storage, DEMO_PROFILE_KEY);
    const normalProfile = {
      ...createDemoProfile(),
      id: "normal",
      demoMode: false,
      walletBalance: 73,
      savingsBalance: 27,
      // migrateProfile requires balances to be backed by credited income.
      transactions: [
        {
          id: "fixture:topup",
          type: "PERIOD_INCOME" as const,
          amount: 100,
          source: "fixture:topup",
          category: "INCOME" as const,
          periodId: "fixture",
          createdAt: "2026-01-01T00:00:00.000Z",
          metadata: {},
        },
      ],
    };
    await normal.saveProfile(normalProfile);
    await demo.saveProfile(createDemoProfile());
    await demo.resetProfile(createDemoProfile());
    expect(await normal.loadProfile()).toEqual(normalProfile);
    expect((await demo.loadProfile())?.demoMode).toBe(true);
    expect(profileKey("normal")).toBe(NORMAL_PROFILE_KEY);
    expect(profileKey("demo")).toBe(DEMO_PROFILE_KEY);
    expect(readProfileMode(storage)).toBe("normal");
    writeProfileMode(storage, "demo");
    expect(storage.getItem(PROFILE_MODE_KEY)).toBe("demo");
    expect(readProfileMode(storage)).toBe("demo");
    writeProfileMode(storage, "normal");
    expect(storage.getItem(PROFILE_MODE_KEY)).toBeNull();
  });
});

it("migrates the legacy situation cache only into its existing normal profile, without re-awarding growth", async () => {
  const storage = new FakeLocalStorage();
  const profile = { ...createDemoProfile(), demoMode: false };
  const { completedSituationIds: _, ...legacy } = profile;
  storage.setItem(NORMAL_PROFILE_KEY, JSON.stringify(legacy));
  storage.setItem(
    DEMO_PROFILE_KEY,
    JSON.stringify({ ...legacy, demoMode: true }),
  );
  storage.setItem(
    "finni.situations",
    JSON.stringify(["01", "01", "02", "unknown"]),
  );
  const normal = new LocalStorageAdapter(storage, NORMAL_PROFILE_KEY);
  const restored = await normal.loadProfile();
  expect(restored?.completedSituationIds).toEqual(["01", "02"]);
  expect(restored?.pet.progress.learning).toBe(0);
  expect(
    (await new LocalStorageAdapter(storage, DEMO_PROFILE_KEY).loadProfile())
      ?.completedSituationIds,
  ).toEqual([]);
  await normal.resetProfile(profile);
  expect((await normal.loadProfile())?.completedSituationIds).toEqual([]);
  await normal.deleteProfile();
  expect(storage.getItem("finni.situations")).toBeNull();
});
