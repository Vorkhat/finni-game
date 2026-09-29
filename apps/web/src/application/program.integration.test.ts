import { expect, it } from "vitest";
import { GameProfileSchema } from "@finni/shared";
import { programTasks, programDailyTasks, dailySituations, situations, purchases } from "@finni/content";
import { programTestAnswers } from "../../../../packages/content/program-test-answers";
import { GameService } from "./game-service";
import { MemoryStorageAdapter } from "./storage";
const time = (day: number, hours = 0) => new Date(Date.UTC(2026, 8, 1) + ((day - 1) * .5 + hours) * 3600000).toISOString();

it("plays all ten days, requires both tasks, and grants exactly 20 task rewards and 10 bundle bonuses across reloads", async () => {
  const storage = new MemoryStorageAdapter();
  let game = new GameService(storage);
  await game.createProfile({ id: "programme", petId: "pet", petName: "Финни", playerNickname: "Игрок", appearance: {species: "dog", colorVariant: "dalmatian"}, now: time(1) });
  for (let day = 1; day <= 10; day++) {
    expect(game.getState()!.pet.stage).toBe(day <= 4 ? "BABY" : day <= 8 ? "EXPLORER" : "FINNI_PRO");
    await game.startPeriod({periodId: `day${day}`, transactionId: `income${day}`, income: 100, startedAt: time(day)});
    await game.setPlan({plannedMandatory: 35, plannedOptional: 15, plannedSavings: 50}, time(day));
    await game.confirmPlan(time(day));
    for (const id of ["breakfast", "balloon", "care"]) await game.purchase(purchases.find(p => p.id === id)!, `${day}:${id}`, time(day));
    const tasks = programDailyTasks(day);
    await expect(game.completeProgramTask(tasks[0]!.id, {}, "bad", time(day))).rejects.toThrow("TASK_NOT_SUCCESSFUL");
    if (day < 10) await expect(game.completeProgramTask(programDailyTasks(day + 1)[0]!.id, {}, "early", time(day))).rejects.toThrow("INVALID_TASK_ACTION");
    await game.completeProgramTask(tasks[0]!.id, programTestAnswers[tasks[0]!.id]!, `reward:${tasks[0]!.id}`, time(day));
    await expect(game.finishPeriod(time(day, .5))).rejects.toThrow("DAY_NOT_READY");
    await game.completeProgramTask(tasks[1]!.id, programTestAnswers[tasks[1]!.id]!, `reward:${tasks[1]!.id}`, time(day));
    const beforeSituations = game.getState()!.walletBalance;
    await expect(game.claimSituationReward(day, time(day))).rejects.toThrow("INVALID_TASK_ACTION");
    for (const id of dailySituations(day)) {
      const situation = situations.find(s => s.id === id)!;
      await game.completeSituation(id, situation.correct, time(day));
    }
    expect(game.getState()!.walletBalance).toBe(beforeSituations);
    await game.claimSituationReward(day, time(day));
    const paid = game.getState()!;
    game = new GameService(storage); await game.loadGame();
    await game.completeProgramTask(tasks[0]!.id, programTestAnswers[tasks[0]!.id]!, "duplicate", time(day));
    const last = situations.find(s => s.id === dailySituations(day).at(-1))!;
    await game.completeSituation(last.id, last.correct, time(day));
    await game.claimSituationReward(day, time(day));
    expect(game.getState()!.walletBalance).toBe(paid.walletBalance);
    expect(game.getState()!.transactions).toEqual(paid.transactions);
    await game.finishPeriod(time(day, .5));
    expect(GameProfileSchema.parse(game.getState()).periodHistory).toHaveLength(day);
    expect(game.getState()!.pet.stage).toBe(day < 4 ? "BABY" : day < 8 ? "EXPLORER" : "FINNI_PRO");
    if (day === 4 || day === 8) await game.seeEvolution(`day${day}`, time(day, .5));
  }
  const result = game.getState()!;
  expect(result.completedTasks).toHaveLength(programTasks.length);
  expect(result.completedSituationIds).toHaveLength(60);
  expect(result.transactions.filter(t => t.type === "TASK_REWARD")).toHaveLength(20);
  expect(result.transactions.filter(t => t.source.startsWith("program-10:"))).toHaveLength(10);
  expect(result.walletBalance).toBe(800);
});

it("does not publish a task reward when saving fails", async () => {
  class Failing extends MemoryStorageAdapter {
    fail = false;
    override async saveProfile(profile: Parameters<MemoryStorageAdapter["saveProfile"]>[0]) {
      if (this.fail) throw new Error("disk full");
      return super.saveProfile(profile);
    }
  }
  const storage = new Failing(), game = new GameService(storage);
  await game.createDemo(); await game.startPeriod({periodId: "day1", transactionId: "income1", income: 100, startedAt: time(1)}); await game.setPlan({plannedMandatory: 35, plannedOptional: 15, plannedSavings: 50}, time(1)); await game.confirmPlan(time(1)); const before = game.getState(); storage.fail = true;
  await expect(game.completeProgramTask("T01", {choice: "food"}, "reward", time(1))).rejects.toThrow("disk full");
  expect(game.getState()).toEqual(before); expect(await storage.loadProfile()).toEqual(before);
  storage.fail = false;
  await game.completeProgramTask("T01", {choice: "food"}, "reward", time(1));
  expect(game.getState()!.walletBalance).toBe(before!.walletBalance + 10);
});
