import { test, expect, type Page } from "@playwright/test";
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
    selectedGoalId: "scooter",
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
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать копию сохранения" }).click();
  await download;
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

test("Appendix A: create a pet, begin day one, complete a lesson, and open Adult Section", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет! Я Финни/ })).toBeVisible();
  if (info.project.name === "390") await shot(page, "demo-entry-390");
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await expect(page.getByText("Нужно", { exact: true })).toBeVisible();
  await expect(page.getByText("Хочу", { exact: true })).toBeVisible();
  await expect(page.getByText("Коплю", { exact: true })).toBeVisible();
  expect(await page.locator('input[type="email"], input[type="tel"], input[name*="birthday" i]').count()).toBe(0);
  await page.getByRole("button", { name: /Выбрать Финни/ }).click();
  await page.getByLabel("Выбор персонажа").getByRole("button").first().click();
  await page.getByLabel("Как назовём питомца?").fill("Финни");
  await page.getByRole("button", { name: /Готово/ }).click();
  await page.getByRole("button", { name: /Самокат/ }).click();
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await expect(page.getByTestId("wallet-balance")).toHaveText("0");
  await expect(page.getByTestId("goal-balance")).toHaveText("0 / 200");
  if (info.project.name === "390") await shot(page, "appendix-home-390");
  await page.goto("/day/start");
  await page.getByRole("button", { name: "Составить план", exact: true }).click();
  await allocate(page, [40, 30, 30]);
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Начать день", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("finni.game-profile")!).currentPeriod?.status)).toBe("ACTIVE");
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Задания дня 1" })).toBeVisible();
  await expect(page.locator(".task-list").first().locator(".task-list-card")).toHaveCount(2);
  await page.goto("/tasks/T01");
  await page.getByRole("button", { name: "Обед · 20", exact: true }).click();
  await page.getByRole("button", { name: "Забрать награду · +10 монет", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Награда уже получена.", { exact: true })).toBeVisible();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("finni.game-profile")!));
  expect(profile.completedTasks).toHaveLength(1);
  expect(profile.walletBalance).toBe(110);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Для взрослых" }).click();
  await unlockAdult(page);
  await expect(page.getByRole("heading", { name: "Как идёт знакомство с деньгами" })).toBeVisible();
  await expect(page.getByText("Только игровая валюта", { exact: false })).toBeVisible();
});
