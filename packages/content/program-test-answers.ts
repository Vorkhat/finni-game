import type { ProgramAnswer } from "@finni/shared";
// Deliberately independent of solution data: content edits must retain playable answers.
export const programTestAnswers: Record<string, ProgramAnswer> = {
  T01: { choice: "food" }, T02: { mapping: { meal: "Нужно", toy: "Хочу", goal: "Коплю" } },
  T03: { selected: ["notebook", "soap"] }, T04: { mapping: { a: "Забота", b: "Приятное", c: "Мечта" } },
  T05: { mapping: { change: "Копилка" } }, T06: { choice: "save10" },
  T07: { choice: "other", transferred: true }, T08: { selected: ["care", "meal", "ice"] },
  T09: { choice: "local" }, T10: { mapping: { a: "Завтра", b: "Сегодня" } },
  T11: { mapping: { a: "Запас", b: "Мечта" } }, T12: { choice: "care", transferred: true },
  T13: { choice: "soap2" }, T14: { mapping: { a: "Завтра", b: "Сегодня" } },
  T15: { choice: "soap" }, T16: { order: ["check", "decide", "confirm"] },
  T17: { mapping: { savings: "Поездка" } }, T18: { choice: "keep" },
  T19: { choice: "save20" }, T20: { mapping: { a: "Забота", b: "Приятное", c: "Мечта", d: "Запас" } },
};
