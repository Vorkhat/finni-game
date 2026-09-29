import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  goals,
  purchases,
  tasks,
  events,
  interfaceContent,
  situations,
} from "@finni/content";
import {
  assetRegistry,
  backgroundAssets,
  getPetAsset,
  petAssets,
  petOptions,
  situationAsset,
} from "./registry";
import { isUnlocked } from "../application/situations";

describe("production asset registry", () => {
  const root = resolve(import.meta.dirname, "../../public");
  it("falls back to the previous stage without changing identity when a stage is unavailable", () => {
    const stages = petAssets.cat!.ginger!;
    const original = stages.FINNI_PRO;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      stages.FINNI_PRO = {};
      expect(
        getPetAsset({
          species: "cat",
          colorVariant: "ginger",
          stage: "FINNI_PRO",
          emotion: "happy",
        }),
      ).toBe(stages.EXPLORER.idle);
      expect(warning).toHaveBeenCalled();
    } finally {
      stages.FINNI_PRO = original;
      warning.mockRestore();
    }
  });
  it("resolves every content assetId to a real local file", () => {
    const content = [
      ...goals,
      ...purchases,
      ...tasks,
      ...events,
      ...interfaceContent.concepts,
      ...interfaceContent.status,
      ...interfaceContent.navigation,
      ...Object.values(interfaceContent.sections),
    ];
    for (const item of content) {
      const path = assetRegistry[item.assetId];
      expect(path, item.assetId).toBeTruthy();
      expect(existsSync(resolve(root, "." + path)), path).toBe(true);
    }
    for (const path of [
      ...Object.values(assetRegistry),
      ...Object.values(backgroundAssets),
    ])
      expect(existsSync(resolve(root, "." + path)), path).toBe(true);
  });
  it("supports every supplied stage and emotion, with only same-identity idle fallback", () => {
    for (const pet of petOptions)
      for (const stage of ["BABY", "EXPLORER", "FINNI_PRO"] as const) {
        for (const path of Object.values(
          petAssets[pet.species]![pet.colorVariant]![stage],
        ))
          expect(existsSync(resolve(root, "." + path)), path).toBe(true);
        expect(getPetAsset({ ...pet, stage, emotion: "not-drawn" })).toBe(
          getPetAsset({ ...pet, stage, emotion: "idle" }),
        );
      }
    expect(
      getPetAsset({
        species: "fox",
        colorVariant: "ginger",
        stage: "BABY",
        emotion: "idle",
      }),
    ).toBeNull();
    expect(
      getPetAsset({
        species: "cat",
        colorVariant: "turquoise",
        stage: "BABY",
        emotion: "idle",
      }),
    ).toBeNull();
  });
});

describe("life situations", () => {
  const root = resolve(import.meta.dirname, "../../public");
  it("resolves every hero and option image to a real local file", () => {
    for (const situation of situations)
      for (const key of [situation.hero, ...situation.icons]) {
        const path = situationAsset(key);
        expect(existsSync(resolve(root, "." + path)), path).toBe(true);
      }
  });
  it("unlocks sequentially within the reached day", () => {
    expect(isUnlocked(0, [], 1)).toBe(true);
    expect(isUnlocked(1, [], 5)).toBe(false);
    expect(isUnlocked(1, [situations[0]!.id], 5)).toBe(true);
    expect(isUnlocked(2, [situations[0]!.id], 5)).toBe(false);
    // Day 2 situation stays locked while the player is still on day 1.
    expect(isUnlocked(6, situations.slice(0, 6).map((s) => s.id), 1)).toBe(
      false,
    );
  });
});
