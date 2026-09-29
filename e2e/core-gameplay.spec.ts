import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createInitialProfile,
  selectSavingsGoal,
  startPeriod,
  updateBudgetPlan,
  confirmBudgetPlan,
} from "../packages/shared/src/economy";
import type { GameProfile } from "../packages/shared/src/schemas";

const qa = "docs/qa/stage2";
const now = "2026-09-15T00:00:00.000Z";
test.beforeAll(() => mkdirSync(qa, { recursive: true }));
const faults = new Map<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  faults.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin !== "http://127.0.0.1:4173" ||
      url.pathname.startsWith("/api")
    ) {
      errors.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
});
test.afterEach(async ({ page }) => expect(faults.get(page)).toEqual([]));

async function seed(page: Page, active = false) {
  let profile = selectSavingsGoal(
    createInitialProfile({
      id: "stage2",
      petId: "cat",
      petName: "Финни",
      playerNickname: "Гость",
      appearance: { species: "cat", colorVariant: "ginger" },
      now,
    }),
    "scooter",
    now,
  );
  if (active)
    profile = confirmBudgetPlan(
      updateBudgetPlan(
        startPeriod(profile, {
          income: 100,
          periodId: "day",
          transactionId: "income",
          startedAt: now,
        }),
        { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
        now,
      ),
      now,
    );
  await page.addInitScript((profile) => {
    if (location.origin !== "http://127.0.0.1:4173") return;
    if (!localStorage.getItem("finni.game-profile"))
      localStorage.setItem("finni.game-profile", JSON.stringify(profile));
  }, profile);
}
async function state(page: Page): Promise<GameProfile> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
}
async function reloadUnchanged(page: Page) {
  const before = await state(page);
  await page.reload();
  await expect(
    page
      .getByRole("link", { name: "Назад", exact: true })
      .or(page.locator(".home-pet")),
  ).toBeVisible();
  expect(await state(page)).toEqual(before);
}
async function shot(page: Page, name: string, info: TestInfo) {
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (await page.getByRole("dialog").count()) {
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
  }
  await page.screenshot({
    path: `${qa}/${name}-${info.project.name}.png`,
    fullPage: true,
  });
}
async function allocate(page: Page) {
  for (const [label, count] of [
    ["Нужно", 8],
    ["Хочу", 6],
    ["Коплю", 6],
  ] as const) {
    for (let i = 0; i < count; i++)
      await page
        .getByRole("button", { name: `${label}: увеличить`, exact: true })
        .click();
  }
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name, exact: true })
    .click();
}
async function buy(page: Page, title: string) {
  await page
    .getByRole("button", { name: `Купить: ${title}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Купить", exact: true })
    .click();
}

test("active day: income → budget → purchases → shortage → interactive reward → savings → reload", async ({
  page,
}, info) => {
  await seed(page);
  await page.goto("/home");
  await page.getByRole("button", { name: /Начать день/ }).click();
  await expect(
    page.getByRole("heading", { name: "Новый день!" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Составить план", exact: true })
    .click();
  expect((await state(page)).walletBalance).toBe(100);
  await allocate(page);
  await page.getByRole("button", { name: "Хочу: увеличить" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Все монетки уже распределены",
  );
  await reloadUnchanged(page);
  await expect(page.getByLabel("Коплю: сумма", { exact: true })).toHaveText(
    "30",
  );
  await shot(page, "budget", info);
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Начать день", exact: true })
    .click();
  await expect(page).toHaveURL(/home/);
  expect((await state(page)).savingsBalance).toBe(0);
  expect((await state(page)).currentPeriod?.budgetActual.savedActual).toBe(0);
  await reloadUnchanged(page);
  await nav(page, "Магазин");
  await shot(page, "shop", info);
  await buy(page, "Обед");
  await expect(page.getByRole("dialog")).toContainText("Покупка у Финни!");
  expect((await state(page)).walletBalance).toBe(70);
  expect((await state(page)).pet.state.satiety).toBe(100);
  await shot(page, "purchase-success", info);
  await page.getByRole("button", { name: "Здорово!" }).click();
  await reloadUnchanged(page);
  await buy(page, "Мяч");
  await page.getByRole("button", { name: "Здорово!" }).click();
  expect(await state(page)).toMatchObject({
    walletBalance: 35,
    pet: { state: { mood: 90 } },
  });
  const beforeShortage = await state(page);
  await buy(page, "Игра");
  await expect(page.getByRole("dialog")).toContainText(/Не хватает\s*25/);
  expect(await state(page)).toEqual(beforeShortage);
  await shot(page, "insufficient-funds", info);
  await page.getByRole("link", { name: "К заданиям", exact: true }).click();
  await shot(page, "tasks", info);
  await page.getByRole("link", { name: /Собери бюджет/ }).click();
  await allocate(page);
  await shot(page, "task-active", info);
  await page.getByRole("button", { name: /Забрать награду/ }).click();
  await expect(
    page.getByRole("heading", { name: "Задание выполнено!" }),
  ).toBeVisible();
  expect((await state(page)).walletBalance).toBe(45);
  await shot(page, "task-result", info);
  await reloadUnchanged(page);
  await page.getByRole("link", { name: "К Финни", exact: true }).click();
  await nav(page, "Копилка");
  await shot(page, "savings", info);
  await page.getByRole("button", { name: "Отложить монетки" }).click();
  await page.getByRole("button", { name: "+20", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Отложить", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Ещё ближе к мечте!");
  await shot(page, "deposit-success", info);
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await reloadUnchanged(page);
  expect(await state(page)).toMatchObject({
    walletBalance: 25,
    savingsBalance: 20,
  });
  await nav(page, "Дом");
  await expect(
    page.getByRole("region", { name: "План и факт сегодня" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /План на день/ }).click();
  await expect(
    page.getByRole("region", { name: "План и факт сегодня" }),
  ).toContainText("40 / 30");
  await expect(
    page.getByRole("region", { name: "План и факт сегодня" }),
  ).toContainText("30 / 35");
  await expect(page.getByTestId("goal-balance")).toHaveText("20 / 200");
  await shot(page, "home-active", info);
  const summaryBox = await page
    .getByRole("region", { name: "План и факт сегодня" })
    .boundingBox();
  expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await shot(page, "home-active-summary", info);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  const final = await state(page);
  await reloadUnchanged(page);
  expect(final.transactions).toHaveLength(5);
  expect(
    final.transactions.filter((entry) => entry.type === "PERIOD_INCOME"),
  ).toHaveLength(1);
  await page.goto("/budget");
  await page.getByRole("link", { name: /Завершить день/ }).click();
  await expect(
    page.getByRole("heading", { name: "Закончить день?" }),
  ).toBeVisible();
  expect(await state(page)).toEqual(final);
});

test("withdrawal has preview/cancel, capped amount, and confirmation exactly once", async ({
  page,
}) => {
  await seed(page, true);
  await page.goto("/savings");
  await page.getByRole("button", { name: "Отложить монетки" }).click();
  await page.getByRole("button", { name: "+30", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Отложить", exact: true }).dblclick();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  expect((await state(page)).savingsBalance).toBe(30);
  const before = await state(page);
  await page.getByRole("button", { name: "Забрать из копилки" }).click();
  await page.getByRole("button", { name: "+20", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("После: 10");
  expect(await state(page)).toEqual(before);
  await page.getByRole("button", { name: "Оставить в копилке" }).click();
  expect(await state(page)).toEqual(before);
  await page.getByRole("button", { name: "Забрать из копилки" }).click();
  await page.getByRole("button", { name: "+20", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Забрать", exact: true }).dblclick();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await reloadUnchanged(page);
  expect(await state(page)).toMatchObject({
    walletBalance: 90,
    savingsBalance: 10,
  });
  expect((await state(page)).transactions).toHaveLength(3);
  await nav(page, "Дом");
  await page.goBack();
  await expect(page).toHaveURL(/savings/);
  expect((await state(page)).transactions).toHaveLength(3);
});

for (const [id, type] of [
  ["assemble-budget", "allocate_budget"],
  ["needs-first", "prioritize"],
  ["save-for-scooter", "savings_choice"],
  ["fit-the-budget", "shopping_cart"],
  ["plan-changed", "unexpected_expense"],
  ["dream-or-now", "goal_vs_want"],
]) {
  test(`renderer ${type}: interaction, consequence, recovery, completion and one reward`, async ({
    page,
  }, info) => {
    await seed(page, true);
    await page.goto(`/tasks/${id}`);
    await expect(page.locator(`[data-task-type="${type}"]`)).toBeVisible();
    if (type === "allocate_budget") await allocate(page);
    if (type === "prioritize") {
      await page.getByRole("button", { name: /Сначала игрушка/ }).click();
      await expect(page.getByRole("status")).toContainText("Останется 10");
      await expect(
        page.getByRole("button", { name: /Забрать награду/ }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Изменить порядок" }).click();
      await page.getByRole("button", { name: /Сначала обед/ }).click();
    }
    if (type === "savings_choice")
      await page
        .getByRole("button", { name: "Отложить 50", exact: true })
        .click();
    if (type === "shopping_cart") {
      for (const name of ["Обед", "Уход", "Игрушка"])
        await page.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("status")).toContainText(
        "Не хватает монет: 20",
      );
      await page.getByRole("button", { name: "Игрушка", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Корзина стоит 45");
    }
    if (type === "unexpected_expense") {
      await page.getByRole("button", { name: /Купить мяч/ }).click();
      await expect(page.getByRole("status")).toContainText("Останется 15");
      await page.getByRole("button", { name: "Попробовать ещё" }).click();
      await page.getByRole("button", { name: /Сначала уход/ }).click();
    }
    if (type === "goal_vs_want") {
      await page.getByRole("button", { name: /Купить игру/ }).click();
      await expect(page.getByRole("status")).toContainText("В кошельке 0");
      await page.getByRole("button", { name: "Отложить часть: 30" }).click();
    }
    await expect(page.locator(".task-feedback")).toBeVisible();
    expect(await state(page)).toMatchObject({
      walletBalance: 100,
      savingsBalance: 0,
    });
    await shot(page, `task-${type}`, info);
    const feedbackBefore = await page.locator(".task-feedback").innerText();
    await reloadUnchanged(page);
    await expect(page.locator(".task-feedback")).toHaveText(feedbackBefore, {
      useInnerText: true,
    });
    expect(
      (await state(page)).transactions.filter((t) => t.type === "TASK_REWARD"),
    ).toHaveLength(0);
    const targets = await page
      .locator(".task-renderer button")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return { w: rect.width, h: rect.height };
        }),
      );
    expect(targets.every((target) => target.w >= 48 && target.h >= 48)).toBe(
      true,
    );
    await page.getByRole("button", { name: /Забрать награду/ }).dblclick();
    await expect(
      page.getByRole("heading", { name: "Задание выполнено!" }),
    ).toBeVisible();
    expect(await state(page)).toMatchObject({
      walletBalance: 110,
      savingsBalance: 0,
    });
    await reloadUnchanged(page);
    await expect(
      page.getByRole("button", { name: /Забрать награду/ }),
    ).toHaveCount(0);
    expect(
      (await state(page)).transactions.filter(
        (entry) => entry.type === "TASK_REWARD",
      ),
    ).toHaveLength(1);
  });
}
