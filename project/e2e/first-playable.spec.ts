import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createInitialProfile,
  startPeriod,
  updateBudgetPlan,
  confirmBudgetPlan,
  depositToSavings,
  selectSavingsGoal,
} from "../packages/shared/src/economy";

const qa = "docs/qa";
test.beforeAll(() => {
  mkdirSync(qa, { recursive: true });
});

async function checkImages(page: Page) {
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (img) =>
              (img as HTMLImageElement).complete &&
              (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
}
async function checkLayout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await checkImages(page);
  if (await page.locator(".welcome-pet").count()) {
    const image = await page.locator(".welcome-pet .pet-image").boundingBox();
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(image!.y + image!.height).toBeLessThanOrEqual(heading!.y);
  }
}

test("first launch → real pet → scooter → Home → reload, with no backend", async ({
  page,
}, info) => {
  const external: string[] = [];
  const api: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:4173") {
      external.push(url.href);
      return route.abort();
    }
    if (url.pathname.startsWith("/api")) {
      api.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Привет! Я Финни" }),
  ).toBeVisible();
  await checkLayout(page);
  await page.screenshot({
    path: `${qa}/onboarding-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  for (const title of ["Нужно", "Хочу", "Коплю"]) {
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await checkLayout(page);
  await page.screenshot({
    path: `${qa}/concepts-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Выбрать Финни" }).click();
  await page
    .getByRole("button", { name: "Котик", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Цвет: Рыжий" }).click();
  await page.getByLabel("Как назовём питомца?").fill("Финни");
  await checkLayout(page);
  await page.screenshot({
    path: `${qa}/pet-creation-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page).toHaveURL(/goal\/select/);
  await page.getByRole("button", { name: /Самокат/ }).click();
  await checkLayout(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${qa}/goal-selection-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "К нашей мечте" }).click();
  await expect(page).toHaveURL(/home/);
  await expect(
    page.getByRole("heading", { name: "Финни", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".home-pet")).toHaveAttribute(
    "src",
    /pet-cat-ginger-baby-idle/,
  );
  await expect(page.getByTestId("wallet-balance")).toHaveText("0");
  await expect(page.getByTestId("savings-balance")).toHaveCount(0);
  await expect(page.getByTestId("goal-balance")).toHaveText("0 / 200");
  await expect(
    page.getByRole("link", { name: /Моя цель: Самокат/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Начать день/ })).toBeVisible();
  await checkLayout(page);
  const navigation = await page.getByRole("navigation").boundingBox();
  expect(navigation!.y + navigation!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  );
  await page.screenshot({
    path: `${qa}/home-${info.project.name}.png`,
    fullPage: true,
  });
  const snapshot = await page.evaluate(() =>
    localStorage.getItem("finni.game-profile"),
  );
  await page.reload();
  await expect(page).toHaveURL(/home/);
  await expect(
    page.getByRole("heading", { name: "Привет! Я Финни" }),
  ).toHaveCount(0);
  await expect(page.locator(".home-pet")).toHaveAttribute(
    "src",
    /pet-cat-ginger-baby-idle/,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("finni.game-profile")),
  ).toBe(snapshot);
  for (const name of ["Задания", "Магазин", "Копилка", "Цели"]) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.getByRole("link", { name: "Назад", exact: true }).click();
    await expect(page).toHaveURL(/home/);
  }
  expect(external).toEqual([]);
  expect(api).toEqual([]);
  expect(errors).toEqual([]);
});

test("dragon, invalid names, interrupted goal selection and predictable Back", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Привет! Я Финни" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.getByRole("button", { name: "Выбрать Финни" }).click();
  await page
    .getByRole("button", { name: "Дракончик", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Цвет: Бирюзовый" }).click();
  for (const value of ["", "   ", "Ф".repeat(17)]) {
    await page.getByLabel("Как назовём питомца?").fill(value);
    await page.getByRole("button", { name: "Готово" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("finni.game-profile")),
    ).toBeNull();
  }
  await page.getByLabel("Как назовём питомца?").fill("  Финни  ");
  await page.getByRole("button", { name: "Готово" }).click();
  await page.reload();
  await expect(page).toHaveURL(/goal\/select/);
  await page.getByRole("button", { name: /Космическое путешествие/ }).click();
  await page.getByRole("button", { name: "К нашей мечте" }).click();
  await expect(page.locator(".home-pet")).toHaveAttribute(
    "src",
    /pet-dragon-turquoise-baby-idle/,
  );
  await expect(page.getByTestId("goal-balance")).toHaveText("0 / 700");
  await checkLayout(page);
  const goalTitleLayout = await page
    .locator(".home-goal-chip")
    .evaluate((title) => ({
      width: title.clientWidth,
      contentWidth: title.scrollWidth,
      height: title.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(title).lineHeight),
    }));
  expect(goalTitleLayout.contentWidth).toBeLessThanOrEqual(
    goalTitleLayout.width,
  );
  expect(goalTitleLayout.height).toBeGreaterThanOrEqual(48);
  await page.screenshot({
    path: `${qa}/home-dragon-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Настройки" }).click();
  await page.getByRole("switch", { name: /Звук/ }).check();
  await page.getByRole("switch", { name: /Анимации/ }).uncheck();
  await page.getByRole("button", { name: "Повторить обучение" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Повторить обучение" })
    .click();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.getByRole("button", { name: "Вернуться к Финни" }).click();
  await expect(page.locator(".home-pet")).toHaveAttribute("src", /pet-dragon/);
  await page.reload();
  expect(
    await page.evaluate(() => document.documentElement.dataset.animations),
  ).toBe("false");
  await checkLayout(page);
});

test("Home renders persisted balances and current period instead of sample values", async ({
  page,
}) => {
  const now = "2026-09-15T00:00:00.000Z";
  let profile = createInitialProfile({
    id: "e2e",
    petId: "e2e-pet",
    petName: "Финни",
    playerNickname: "Гость",
    appearance: { species: "cat", colorVariant: "ginger" },
    now,
  });
  profile = startPeriod(profile, {
    periodId: "period-1",
    income: 100,
    transactionId: "income-1",
    startedAt: now,
  });
  profile = confirmBudgetPlan(
    updateBudgetPlan(
      profile,
      { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
      now,
    ),
    now,
  );
  profile = depositToSavings(profile, 30, {
    transactionId: "deposit-1",
    createdAt: now,
  });
  profile = selectSavingsGoal(profile, "scooter", now);
  await page.addInitScript(
    (profile) =>
      localStorage.setItem("finni.game-profile", JSON.stringify(profile)),
    profile,
  );
  await page.goto("/");
  await expect(page).toHaveURL(/home/);
  await expect(page.getByTestId("wallet-balance")).toHaveText("70");
  await expect(page.getByTestId("savings-balance")).toHaveCount(0);
  await expect(page.getByTestId("goal-balance")).toHaveText("30 / 200");
  await expect(
    page.getByRole("progressbar", { name: "Прогресс цели" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /План на день/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("wallet-balance")).toHaveText("70");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".home-pet")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
