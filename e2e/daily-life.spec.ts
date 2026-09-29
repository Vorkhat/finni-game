import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createInitialProfile,
  startPeriod,
  updateBudgetPlan,
  confirmBudgetPlan,
  completeTask,
  depositToSavings,
  selectSavingsGoal,
} from "../packages/shared/src";
import { programTasks, dailySituations } from "../packages/content";

const now = "2026-09-21T08:00:00.000Z";
test("offline day makes pet sad and both answer outcomes are visible", async ({
  page,
}, info) => {
  const p = profile(false);
  p.pet.appearance = { species: "dog", colorVariant: "dalmatian" };
  p.pet.species = "dog";
  await page.clock.install({ time: new Date("2026-09-22T08:00:00.000Z") });
  await page.addInitScript((value) => {
    if (!localStorage.getItem("finni.game-profile"))
      localStorage.setItem("finni.game-profile", JSON.stringify(value));
  }, p);
  await page.goto("/home");
  await expect(page.locator(".home-pet")).toHaveAttribute("src", /-sad\.webp$/);
  await expect(page.getByText("Очень голоден", { exact: true })).toBeVisible();
  await expect(page.getByText("Очень грустно", { exact: true })).toBeVisible();
  await expect(page.getByText("Нужен уход!", { exact: true })).toBeVisible();
  await page.goto("/situations/S01");
  await page
    .getByRole("button", { name: "Дешёвую игрушку", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Не совсем. Попробуй ещё раз!",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".reaction-pet")).toHaveAttribute(
    "src",
    /-sad\.webp$/,
  );
  mkdirSync("docs/qa/daily-life", { recursive: true });
  await page.screenshot({
    path: `docs/qa/daily-life/${info.project.name}-wrong-answer.png`,
  });
  await dialog
    .getByRole("button", { name: "Попробовать ещё раз", exact: true })
    .click();
  await page.getByRole("button", { name: "Обед", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Верно! Финни радуется!" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".reaction-pet")).toHaveAttribute(
    "src",
    /-happy\.webp$/,
  );
  await page.screenshot({
    path: `docs/qa/daily-life/${info.project.name}-right-answer.png`,
  });
  await dialog.getByRole("button", { name: "Здорово!", exact: true }).click();
  await page.goto("/tasks/T01");
  await page.getByRole("button", { name: "Игрушка · 30", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Не совсем. Попробуй ещё раз!" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Попробовать ещё раз", exact: true })
    .click();
  await page.getByRole("button", { name: "Обед · 20", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Верно! Финни радуется!" }),
  ).toBeVisible();

  await expect(page.locator(".task-feedback")).toHaveCount(0);
  const reward = page.getByRole("button", {
    name: "Забрать награду · +10 монет",
    exact: true,
  });
  await expect(reward).toHaveCount(1);
  await reward.click();
  await expect(
    page.getByRole("heading", { name: "Задание выполнено!", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(saved.walletBalance).toBe(110);
  await page.reload();
  const again = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(again.walletBalance).toBe(110);
});
test("needs show colored bars and words instead of visible numbers", async ({
  page,
}, info) => {
  const p = profile();
  p.pet.state = { satiety: 80, mood: 50, care: 20 };
  await page.clock.install({ time: new Date(now) });
  await page.addInitScript(
    (value) =>
      localStorage.setItem("finni.game-profile", JSON.stringify(value)),
    p,
  );
  await page.goto("/home");
  const status = page.getByRole("region", { name: "Состояние Финни" });
  await expect(status.getByRole("meter")).toHaveCount(3);
  await expect(status.getByText("Сыт", { exact: true })).toBeVisible();
  await expect(
    status.getByText("Пора поиграть", { exact: true }),
  ).toBeVisible();
  await expect(status.getByText("Нужен уход!", { exact: true })).toBeVisible();
  await expect(status).not.toContainText(/80|50|20/);
  mkdirSync("docs/qa/daily-life", { recursive: true });
  await page.screenshot({
    path: `docs/qa/daily-life/${info.project.name}-needs.png`,
  });
});
function profile(completed = true, income = 100) {
  let p = selectSavingsGoal(
    createInitialProfile({
      id: "daily-ui",
      petId: "pet",
      petName: "Финни",
      playerNickname: "Гость",
      appearance: { species: "cat", colorVariant: "ginger" },
      now,
    }),
    "scooter",
    now,
  );
  p = startPeriod(p, {
    periodId: "day1",
    income,
    transactionId: "income1",
    startedAt: now,
  });
  p = confirmBudgetPlan(
    updateBudgetPlan(
      p,
      { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
      now,
    ),
    now,
  );
  if (completed)
    for (const task of programTasks.filter((t) => t.day === 1))
      p = completeTask(
        p,
        {
          id: task.id,
          topic: "BUDGET_PLANNING",
          text: task.question,
          answer: true,
          explain: task.explanation,
          reward: 10,
        },
        { answer: true, transactionId: task.id, completedAt: now },
      );
  if (completed) p.completedSituationIds = dailySituations(1);
  return p;
}

test("thirty-minute day persists actions and unlocks after offline return", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(now) });
  await page.addInitScript((p) => {
    if (!localStorage.getItem("finni.game-profile"))
      localStorage.setItem("finni.game-profile", JSON.stringify(p));
  }, profile());
  await page.goto("/day/result");
  await expect(
    page.getByRole("button", { name: "Посмотреть итоги" }),
  ).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "подождать 30 мин" })).toBeVisible();
  for (const [name, product] of [
    ["Покормить Финни", "Завтрак"],
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/shop/);
    await page
      .getByRole("button", { name: "Купить: " + product, exact: true })
      .click();
    await page.getByRole("button", { name: "Не сейчас", exact: true }).click();
    await page.goto("/day/result");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "✓ Сегодня Финни поел", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("link", { name, exact: true }).click();
    await page
      .getByRole("button", { name: "Купить: " + product, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Купить", exact: true })
      .click();
    await expect(
      page.getByText("Покупка у Финни!", { exact: true }),
    ).toBeVisible();
    await page.goto("/day/result");
    await expect(
      page.getByRole("link", { name: "✓ Сегодня Финни поел", exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole("status").filter({hasText: "подождать 30 мин"}),
  ).toBeVisible();
  mkdirSync("docs/qa/daily-life", { recursive: true });
  await page.screenshot({
    path: `docs/qa/daily-life/${info.project.name}-waiting.png`,
    fullPage: true,
  });
  await page.clock.setSystemTime(new Date("2026-09-21T08:30:00.000Z"));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Посмотреть итоги" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Посмотреть итоги" }).click();
  await expect(
    page.getByRole("heading", { name: "Как прошёл день?" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("selecting the next dream spends the old one and starts a fresh piggy bank", async ({
  page,
}) => {
  const funded = depositToSavings(profile(true, 350), 250, {
    transactionId: "save-for-scooter",
    createdAt: now,
  });
  await page.clock.install({ time: new Date(now) });
  await page.addInitScript(
    (p) => localStorage.setItem("finni.game-profile", JSON.stringify(p)),
    funded,
  );
  await page.goto("/goal/select");
  await page.getByRole("button", { name: /Домик Финни/ }).click();
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(saved.selectedGoalId).toBe("pet_house");
  expect(saved.savingsBalance).toBe(0);
  expect(saved.walletBalance).toBe(170);
  expect(saved.achievedGoalIds).toContain("scooter");
});
