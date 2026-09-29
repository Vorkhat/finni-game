import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createInitialProfile,
  selectSavingsGoal,
} from "../packages/shared/src";

const qa = "docs/qa/stage4";
const faults = new Map<Page, string[]>();
const now = "2026-09-15T00:00:00.000Z";

test.beforeAll(() => mkdirSync(qa, { recursive: true }));
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

async function imagesReady(page: Page) {
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
}

async function shot(page: Page, name: string) {
  await imagesReady(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `${qa}/${name}.png`, fullPage: true });
}

async function allocate(page: Page, values: readonly number[]) {
  for (const [index, label] of ["Нужно", "Хочу", "Коплю"].entries())
    for (let amount = 0; amount < values[index]!; amount += 5)
      await page
        .getByRole("button", { name: `${label}: увеличить`, exact: true })
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

async function completeTask(page: Page, day: number) {
  const ids = [
    "assemble-budget",
    "needs-first",
    "save-for-scooter",
    "fit-the-budget",
    "plan-changed",
  ];
  await page.goto(`/tasks/${ids[day - 1]}`);
  if (day === 1) await allocate(page, [40, 30, 30]);
  if (day === 2)
    await page.getByRole("button", { name: /Сначала обед/ }).click();
  if (day === 3)
    await page
      .getByRole("button", { name: "Отложить 30", exact: true })
      .click();
  if (day === 4) {
    await page.getByRole("button", { name: "Обед", exact: true }).click();
    await page.getByRole("button", { name: "Уход", exact: true }).click();
  }
  if (day === 5)
    await page.getByRole("button", { name: /Сначала уход/ }).click();
  await page.getByRole("button", { name: /Забрать награду/ }).click();
  await expect(
    page.getByRole("heading", { name: "Задание выполнено!" }),
  ).toBeVisible();
}

async function deposit(page: Page, amount: 30 | 40) {
  await page.goto("/savings");
  await page
    .getByRole("button", { name: "Отложить монетки", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+20", exact: true })
    .click({ clickCount: amount === 40 ? 2 : 1 });
  if (amount === 30)
    await page.getByRole("button", { name: "+10", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Отложить", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Ещё ближе к мечте!");
}

async function unlockAdult(page: Page) {
  await page
    .getByRole("button", { name: "Удерживайте 3 секунды" })
    .press("Space", { delay: 3200 });
  await expect(page).toHaveURL(/adult\/dashboard/);
}

function normalProfile() {
  return selectSavingsGoal(
    createInitialProfile({
      id: "normal-profile",
      petId: "normal-pet",
      petName: "Искорка",
      playerNickname: "Гость",
      appearance: {
        species: "dragon",
        colorVariant: "turquoise",
        accessoryVariant: "gold-medallion",
      },
      now,
    }),
    "pet_house",
    now,
  );
}

test("Appendix A: fresh profile → five decisions → evolutions → persistence → Adult Section", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Привет! Я Финни/ }),
  ).toBeVisible();
  if (info.project.name === "390") await shot(page, "demo-entry-390");
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await expect(page.getByText("Нужно", { exact: true })).toBeVisible();
  await expect(page.getByText("Хочу", { exact: true })).toBeVisible();
  await expect(page.getByText("Коплю", { exact: true })).toBeVisible();
  expect(
    await page
      .locator(
        'input[type="email"], input[type="tel"], input[name*="birthday" i]',
      )
      .count(),
  ).toBe(0);
  await page.getByRole("button", { name: /Выбрать Финни/ }).click();
  await page.getByLabel("Выбор персонажа").getByRole("button").first().click();
  await page.getByLabel("Как назовём питомца?").fill("Финни");
  await page.getByRole("button", { name: /Готово/ }).click();
  await page.getByRole("button", { name: /Самокат/ }).click();
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await expect(page.getByTestId("wallet-balance")).toHaveText("0");
  if (info.project.name === "390") await shot(page, "appendix-home-390");

  for (let day = 1; day <= 5; day++) {
    await page.goto("/day/start");
    await page
      .getByRole("button", { name: "Составить план", exact: true })
      .click();
    await allocate(
      page,
      day === 1 ? [40, 30, 30] : day === 4 ? [55, 0, 40] : [30, 15, 40],
    );
    if (day === 1 && info.project.name === "390")
      await shot(page, "appendix-budget-390");
    await page.getByRole("button", { name: "Готово", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Начать день", exact: true })
      .click();

    if (day >= 2 && day <= 4) {
      await page.goto("/budget");
      await page.locator(".event-card").click();
      const label =
        day === 2
          ? "Принять монетки"
          : day === 3
            ? "Пройти мимо"
            : "Купить за 25 монет";
      await page
        .getByRole("dialog")
        .getByRole("button", { name: label, exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Готово", exact: true })
        .click();
    }

    await completeTask(page, day);
    await page.goto("/shop");
    if (day === 1 && info.project.name === "390")
      await shot(page, "appendix-shop-390");
    await buy(page, "Обед");
    await page.getByRole("button", { name: "Здорово!" }).click();
    if (day !== 4) {
      await buy(page, day === 1 ? "Мяч" : "Шарик");
      await page.getByRole("button", { name: "Здорово!" }).click();
    }
    if (day === 1) {
      const before = await page.evaluate(() =>
        localStorage.getItem("finni.game-profile"),
      );
      await buy(page, "Игра");
      await expect(page.getByRole("dialog")).toContainText("Не хватает");
      expect(
        await page.evaluate(() => localStorage.getItem("finni.game-profile")),
      ).toBe(before);
      if (info.project.name === "390")
        await shot(page, "appendix-insufficient-390");
      await page
        .getByRole("button", { name: "Не сейчас", exact: true })
        .click();
    }

    await deposit(page, day === 1 ? 30 : 40);
    if (day === 1 && info.project.name === "390")
      await shot(page, "appendix-savings-390");
    await page.getByRole("button", { name: "Готово", exact: true }).click();
    await page.goto("/home");
    await page.goto("/budget");
    await page.getByRole("link", { name: /Завершить день/ }).click();
    await page
      .getByRole("button", { name: "Посмотреть итоги", exact: true })
      .click();
    await expect(page.locator(".result-comparisons")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Как Финни?" }),
    ).toBeVisible();
    if (day === 1 && info.project.name === "390")
      await shot(page, "appendix-result-390");

    const saved = await page.evaluate(() =>
      localStorage.getItem("finni.game-profile"),
    );
    await page.reload();
    expect(
      await page.evaluate(() => localStorage.getItem("finni.game-profile")),
    ).toBe(saved);
    if (day === 3 || day === 5) {
      await page
        .getByRole("link", { name: "Следующий день", exact: true })
        .click();
      await expect(page.locator(".evolution-new")).toBeVisible();
      if (day === 3 && info.project.name === "390")
        await shot(page, "appendix-evolution-390");
      await page.getByRole("button", { name: "Продолжить вместе" }).click();
    }
  }

  await expect(page.locator(".home-pet")).toHaveAttribute(
    "src",
    /finni-pro-idle/,
  );
  await shot(page, `final-home-${info.project.name}`);
  await page.getByRole("link", { name: "Настройки" }).click();
  await page.getByRole("link", { name: "Для взрослых" }).click();
  if (info.project.name === "390") await shot(page, "adult-gate-390");
  await unlockAdult(page);
  await expect(
    page.getByRole("heading", { name: "Как идёт знакомство с деньгами" }),
  ).toBeVisible();
  await expect(
    page.getByText("Только игровая валюта", { exact: false }),
  ).toBeVisible();
  if (info.project.name === "390") {
    await shot(page, "adult-dashboard-390");
    await page
      .getByRole("heading", { name: "Чему учит Финни" })
      .scrollIntoViewIfNeeded();
    await shot(page, "adult-learning-390");
  }
  await page.getByRole("button", { name: "Сбросить прогресс" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  if (info.project.name === "390") await shot(page, "reset-confirm-390");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Отмена" })
    .click();
  await page.getByRole("button", { name: "Удалить профиль" }).click();
  if (info.project.name === "390") await shot(page, "delete-confirm-390");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Отмена" })
    .click();
});

test("Demo Mode preserves, resets and restores the exact normal profile", async ({
  page,
}, info) => {
  const normal = normalProfile();
  await page.addInitScript(
    (profile) =>
      localStorage.setItem("finni.game-profile", JSON.stringify(profile)),
    normal,
  );
  await page.goto("/settings");
  const before = await page.evaluate(() =>
    localStorage.getItem("finni.game-profile"),
  );
  await page.getByRole("button", { name: "Демо-режим" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Запустить демо" })
    .click();
  await page.getByRole("button", { name: /Самокат/ }).click();
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await expect(page.getByLabel("Включён демо-режим")).toBeVisible();
  if (info.project.name === "390") await shot(page, "demo-guidance-390");
  await page.goto("/day/start");
  await page
    .getByRole("button", { name: "Составить план", exact: true })
    .click();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Начать демо заново" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Начать заново" })
    .click();
  const resetDemo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.demo-profile")!),
  );
  expect(resetDemo).toMatchObject({
    id: "demo-profile",
    walletBalance: 0,
    savingsBalance: 0,
    selectedGoalId: null,
    demoMode: true,
  });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Выйти из демо" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Выйти из демо" })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("finni.game-profile")),
  ).toBe(before);
  expect(
    await page.evaluate(() => localStorage.getItem("finni.profile-mode")),
  ).toBeNull();
  await expect(
    page.getByText("Искорка", { exact: true }).first(),
  ).toBeVisible();
});

test("Adult reset creates a new initial game without deleting the profile", async ({
  page,
}) => {
  await page.addInitScript(
    (profile) =>
      localStorage.setItem("finni.game-profile", JSON.stringify(profile)),
    normalProfile(),
  );
  await page.goto("/adult");
  await unlockAdult(page);
  await page.getByRole("button", { name: "Сбросить прогресс" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Сбросить", exact: true })
    .click();
  await expect(page).toHaveURL(/goal\/select/);
  const profile = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(profile).toMatchObject({
    walletBalance: 0,
    savingsBalance: 0,
    selectedGoalId: null,
    periodHistory: [],
  });
});

test("Adult delete removes all profiles and stays on onboarding after reload", async ({
  page,
}) => {
  await page.addInitScript((profile) => {
    localStorage.setItem("finni.game-profile", JSON.stringify(profile));
    localStorage.setItem(
      "finni.demo-profile",
      JSON.stringify({ ...profile, id: "demo", demoMode: true }),
    );
  }, normalProfile());
  await page.goto("/adult");
  await unlockAdult(page);
  await page.getByRole("button", { name: "Удалить профиль" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить профиль" })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  expect(
    await page.evaluate(() => localStorage.getItem("finni.game-profile")),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("finni.demo-profile")),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("finni.home-events.v1:"),
      ),
    ),
  ).toEqual([]);
  await page.reload();
  await expect(page).toHaveURL(/onboarding/);
});

test("corrupt save recovery and direct-route guards are safe", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("finni.game-profile", "{broken"),
  );
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: "Не удалось открыть сохранённую игру" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Начать новую игру" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить сохранение" })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await page.evaluate(
    (profile) =>
      localStorage.setItem("finni.game-profile", JSON.stringify(profile)),
    normalProfile(),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Повторить обучение" }).click();
  await expect(page.getByRole("button", { name: "Закрыть" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/day/result");
  await expect(page).toHaveURL(/home/);
  await page.goto("/day/evolution");
  await expect(page).toHaveURL(/home/);
  await page.goto("/adult/dashboard");
  await expect(page).toHaveURL(/adult$/);
});
