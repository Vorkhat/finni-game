import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createDemoProfile,
  startPeriod,
  updateBudgetPlan,
  confirmBudgetPlan,
  closePeriod,
} from "../packages/shared/src";
import { programTasks, situations } from "../packages/content";
import { programTestAnswers } from "../packages/content/program-test-answers";

test("all imported tasks and situations are playable, illustrated and reward once", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const now = new Date().toISOString();
  let profile = createDemoProfile();
  for (let day = 1; day <= 10; day++) {
    profile = confirmBudgetPlan(
      updateBudgetPlan(
        startPeriod(profile, {
          periodId: `program-ui-${day}`,
          transactionId: `income-${day}`,
          income: 100,
          startedAt: now,
        }),
        { plannedMandatory: 35, plannedOptional: 15, plannedSavings: 50 },
        now,
      ),
      now,
    );
    if (day < 10) profile = closePeriod(profile, now);
  }
  profile.demoMode = false;
  profile.selectedGoalId = "scooter";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/assets/") && response.status() >= 400)
      errors.push(response.url());
  });
  await page.addInitScript((value) => {
    if (!localStorage.getItem("finni.game-profile"))
      localStorage.setItem("finni.game-profile", JSON.stringify(value));
  }, profile);
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Задания дня 10", exact: true })).toBeVisible();
  await expect(page.locator(".task-list").first().locator(".task-list-card")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Открыть 6 ситуаций дня/ })).toBeVisible();
  expect(await page.locator(".task-list").first().locator("img").first().evaluate(img => img.getBoundingClientRect().width)).toBe(64);
  mkdirSync("docs/qa/program", { recursive: true });
  await page.screenshot({ path: `docs/qa/program/${info.project.name}-tasks.png` });
  for (const task of programTasks) {
    const answer = programTestAnswers[task.id]!;
    await page.goto(`/tasks/${task.id}`);
    await expect(
      page.getByRole("heading", { name: task.title, exact: true }),
    ).toBeVisible();
    if (task.id === "T01") {
      await page
        .getByRole("button", { name: "Игрушка · 30", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Не совсем. Попробуй ещё раз!" }),
      ).toBeVisible();
      await expect(page.locator(".task-feedback")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Попробовать ещё раз", exact: true })
        .click();
    }
    if (answer.choice) {
      const choice = [
        ...(task.board.choices ?? []),
        ...(task.board.rows ?? []),
      ].find((c) => c.id === answer.choice)!;
      const label =
        task.type === "find_extra" ? `2. ${choice.label}` : choice.label;
      await page.getByRole("button", { name: label, exact: true }).click();
      if (task.type === "buy_then_save")
        await page
          .getByRole("button", { name: /В копилку оставшиеся/ })
          .click();
    } else if (answer.selected) {
      for (const id of answer.selected) {
        const item = task.board.items!.find((i) => i.id === id)!;
        await page
          .locator(".cart-item")
          .filter({ hasText: item.label })
          .click();
      }
    } else if (answer.mapping) {
      for (const [id, zone] of Object.entries(answer.mapping)) {
        const tokenIndex = (task.board.tokens ?? task.board.items)!.findIndex(
          (t) => t.id === id,
        );
        await page.locator(".program-token").nth(tokenIndex).click();
        await page
          .locator(".program-zone")
          .filter({
            has: page.locator("strong", { hasText: new RegExp(`^${zone}$`) }),
          })
          .click();
      }
    } else if (answer.order) {
      for (const id of answer.order)
        await page
          .getByRole("button", {
            name: task.board.items!.find((i) => i.id === id)!.label,
            exact: true,
          })
          .click();
    }
    if (!["select", "find_extra", "buy_then_save"].includes(task.type)) {
      if (["T02", "T20"].includes(task.id)) {
        mkdirSync("docs/qa/program", { recursive: true });
        await page.screenshot({
          path: `docs/qa/program/${info.project.name}-${task.id}.png`,
          fullPage: true,
        });
      }
      await page
        .getByRole("button", { name: "Проверить ответ", exact: true })
        .click();
    }
    await expect(
      page.getByRole("dialog", { name: "Верно! Финни радуется!" }),
    ).toBeVisible();
    const reward = page.getByRole("button", {
      name: "Забрать награду · +10 монет",
      exact: true,
    });
    await expect(reward).toHaveCount(1);
    await reward.click();
    await expect(
      page.getByRole("heading", { name: "Задание выполнено!", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Награда уже получена.", { exact: true }),
    ).toBeVisible();
  }
  for (const situation of situations) {
    await page.goto(`/situations/${situation.id}`);
    await expect(
      page.getByRole("heading", { name: situation.title, exact: true }),
    ).toBeVisible();
    await page.locator(".situation-option").nth(situation.correct).click();
    await expect(
      page.getByRole("dialog", { name: "Верно! Финни радуется!" }),
    ).toBeVisible();
    if (Number(situation.id.slice(1)) % 6 === 0) await page.getByRole("button", {name:"Забрать награду · +10 монет",exact:true}).click();
  }
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(saved.walletBalance).toBe(profile.walletBalance + 300);
  expect(saved.completedSituationIds).toHaveLength(60);
  expect(saved.completedTasks).toHaveLength(20);
  expect(errors).toEqual([]);
});
