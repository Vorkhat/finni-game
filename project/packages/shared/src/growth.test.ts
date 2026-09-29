import { expect, it } from "vitest";
import { calculatePetStage } from "./economy";
const progress = (completedPeriods: number, score = 0) => ({completedPeriods, mandatoryCare: score, planDiscipline: score, savings: score, learning: score});
it("grows at completed days four and eight regardless of points", () => {
  for (const score of [0, 10000]) {
    expect(calculatePetStage(progress(3, score), "BABY")).toBe("BABY");
    expect(calculatePetStage(progress(4, score), "BABY")).toBe("EXPLORER");
    expect(calculatePetStage(progress(7, score), "EXPLORER")).toBe("EXPLORER");
    expect(calculatePetStage(progress(8, score), "EXPLORER")).toBe("FINNI_PRO");
  }
});
it("keeps older pets from legacy saves and never skips an unseen stage", () => {
  expect(calculatePetStage(progress(3), "EXPLORER")).toBe("EXPLORER");
  expect(calculatePetStage(progress(5), "FINNI_PRO")).toBe("FINNI_PRO");
  expect(calculatePetStage(progress(10), "BABY")).toBe("EXPLORER");
});
