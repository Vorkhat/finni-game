import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateProgramTask, ProgramTaskSchema } from "@finni/shared";
import { programTasks, situations, programSchedule, programDailyTasks, dailySituations } from "./index";
import { programTestAnswers } from "./program-test-answers";
import { validateProgramRelations, ProgramSituationMetaSchema } from "./content-validation";
import rawProgramSituations from "./program-situations.json";

describe("imported ten-day programme", () => {
  it("rejects dangling and duplicated schedule references", () => {
    const situationsWithDays = ProgramSituationMetaSchema.array().parse(rawProgramSituations);
    const broken = programSchedule.map((day) => ({ ...day, tasks: [...day.tasks], situations: [...day.situations] }));
    broken[0]!.situations[0] = "S99";
    expect(() => validateProgramRelations(broken, programTasks, situationsWithDays)).toThrow(/Invalid situation reference/);
    broken[0]!.situations[0] = broken[0]!.situations[1]!;
    expect(() => validateProgramRelations(broken, programTasks, situationsWithDays)).toThrow(/Invalid situation reference|Duplicate scheduled situation/);
  });
  it("rejects invalid future task content before it reaches gameplay", () => {
    const select = programTasks.find((task) => task.id === "T01")!;
    const buyThenSave = programTasks.find((task) => task.id === "T07")!;
    expect(ProgramTaskSchema.safeParse({ ...select, title: " " }).success).toBe(false);
    expect(ProgramTaskSchema.safeParse({ ...select, solution: { accepted: ["NO_SUCH_CHOICE"] } }).success).toBe(false);
    expect(ProgramTaskSchema.safeParse({ ...buyThenSave, solution: {} }).success).toBe(false);
    expect(ProgramTaskSchema.safeParse({ ...buyThenSave, board: { ...buyThenSave.board, choices: [] } }).success).toBe(false);
  });
  it("has unique 20 tasks, 60 situations, two and six per day and all illustrations", () => {
    expect(programTasks).toHaveLength(20); expect(situations).toHaveLength(60);
    expect(new Set(programTasks.map(t => t.id)).size).toBe(20);
    expect(new Set(situations.map(t => t.id)).size).toBe(60);
    expect(programSchedule).toHaveLength(10);
    for (const day of programSchedule) {
      expect(programDailyTasks(day.day).map(t => t.id)).toEqual(day.tasks);
      expect(day.tasks).toHaveLength(2); expect(dailySituations(day.day)).toHaveLength(6);
    }
    for (const task of programTasks) {
      const keys = [task.hero, ...(task.board.items ?? []), ...(task.board.choices ?? []), ...(task.board.rows ?? [])].map(value => typeof value === "string" ? value : value.asset);
      for (const key of keys) expect(existsSync(resolve(import.meta.dirname, `../../apps/web/public/assets/finni/program/${key}.webp`)), key).toBe(true);
    }
  });
  it.each(programTasks)("$id accepts a real solution and rejects an empty answer", task => {
    expect(evaluateProgramTask(task, programTestAnswers[task.id]!)).toBe(true);
    expect(evaluateProgramTask(task, {})).toBe(false);
  });
  it("accepts all intended alternatives, but no duplicated tokens/items or partial purchases", () => {
    const check = (id: string, answer: Parameters<typeof evaluateProgramTask>[1]) => evaluateProgramTask(programTasks.find(t => t.id === id)!, answer);
    for (const choice of ["save5", "save10", "save20"]) expect(check("T06", {choice})).toBe(true);
    for (const choice of ["ice", "keep"]) expect(check("T18", {choice})).toBe(true);
    expect(check("T18", {choice: "toy"})).toBe(false);
    expect(check("T03", {selected: ["soap", "notebook", "soap"]})).toBe(false);
    expect(check("T07", {choice: "other"})).toBe(false);
    expect(check("T07", {choice: "near", transferred: true})).toBe(false);
    expect(check("T10", {mapping: {a: "Сегодня", b: "Завтра", extra: "Сегодня"}})).toBe(false);
    expect(check("T20", {mapping: {a: "Забота", b: "Запас", c: "Мечта", d: "Приятное"}})).toBe(true);
    expect(check("T16", {order: ["confirm", "check", "decide"]})).toBe(false);
  });
});
