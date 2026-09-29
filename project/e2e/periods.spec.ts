import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  closePeriod,
  confirmBudgetPlan,
  createInitialProfile,
  depositToSavings,
  executePurchase,
  selectSavingsGoal,
  startPeriod,
  updateBudgetPlan,
  type GameProfile,
} from "../packages/shared/src";
import { dailyStories, periodNeeds, purchases } from "../packages/content";
const now = "2026-09-15T00:00:00.000Z";
const qa = "docs/qa/stage3";
const faults = new Map<Page, string[]>();
test.beforeAll(() => mkdirSync(qa, { recursive: true }));
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  faults.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
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
const initial = () =>
  selectSavingsGoal(
    createInitialProfile({
      id: "stage3",
      petId: "cat",
      petName: "Финни",
      playerNickname: "Гость",
      appearance: { species: "cat", colorVariant: "ginger" },
      now,
    }),
    "scooter",
    now,
  );
function prepare(p: GameProfile, i: number) {
  return confirmBudgetPlan(
    updateBudgetPlan(
      startPeriod(p, {
        income: 100,
        periodId: `day${i}`,
        transactionId: `income${i}`,
        startedAt: now,
        mandatoryNeeds: periodNeeds(i),
      }),
      { plannedMandatory: 30, plannedOptional: 15, plannedSavings: 40 },
      now,
    ),
    now,
  );
}
function actions(p: GameProfile, i: number) {
  p = executePurchase(
    p,
    purchases.find((p) => p.id === "lunch")!,
    { transactionId: `food${i}`, createdAt: now },
  );
  p = executePurchase(
    p,
    purchases.find((p) => p.id === "balloon")!,
    { transactionId: `want${i}`, createdAt: now },
  );
  return depositToSavings(p, 40, { transactionId: `save${i}`, createdAt: now });
}
async function seed(page: Page, profile: GameProfile) {
  await page.addInitScript((p) => {
    if (
      location.origin === "http://127.0.0.1:4173" &&
      !localStorage.getItem("finni.game-profile")
    )
      localStorage.setItem("finni.game-profile", JSON.stringify(p));
  }, profile);
}
async function state(page: Page): Promise<GameProfile> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
}
async function unchangedReload(page: Page) {
  const before = await state(page);
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  expect(await state(page)).toEqual(before);
}
async function shot(page: Page, name: string, info: TestInfo) {
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (i) =>
              (i as HTMLImageElement).complete &&
              (i as HTMLImageElement).naturalWidth > 0,
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
    path: `${qa}/${name}${info.title.startsWith("five sequential") ? "-" + info.title.split(": ")[1]!.split(",")[0] : ""}-${info.project.name}.png`,
    fullPage: true,
  });
}
async function allocate(page: Page, values: number[]) {
  for (const [i, label] of ["Нужно", "Хочу", "Коплю"].entries())
    for (let j = 0; j < values[i]! / 5; j++)
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
  await page.getByRole("button", { name: "Здорово!" }).click();
}
async function finish(page: Page) {
  await page.goto("/home");
  await page.goto("/budget");
  await page.getByRole("link", { name: /Завершить день/ }).click();
  await page.getByRole("button", { name: "Посмотреть итоги" }).click();
  await expect(
    page.getByRole("heading", { name: "Как прошёл день?" }),
  ).toBeVisible();
}

test("period result: confirmation, actual coins, explanations, snapshots, double close, reload and next income", async ({
  page,
}, info) => {
  let p = prepare(initial(), 1);
  p.currentPeriod!.budgetPlan = {
    ...p.currentPeriod!.budgetPlan!,
    plannedMandatory: 40,
    plannedOptional: 30,
    plannedSavings: 30,
    unallocated: 0,
  };
  p = executePurchase(
    p,
    purchases.find((p) => p.id === "lunch")!,
    { transactionId: "lunch", createdAt: now },
  );
  for (const id of ["ice1", "ice2"])
    p = executePurchase(
      p,
      purchases.find((p) => p.id === "icecream")!,
      { transactionId: id, createdAt: now },
    );
  p = depositToSavings(p, 20, { transactionId: "save", createdAt: now });
  await seed(page, p);
  await page.goto("/home");
  await page.goto("/budget");
  await page.getByRole("link", { name: /Завершить день/ }).click();
  await page.getByRole("link", { name: "Ещё не закончил" }).click();
  expect(await state(page)).toEqual(p);
  await page.goto("/budget");
  await page.getByRole("link", { name: /Завершить день/ }).click();
  await page.getByRole("button", { name: "Посмотреть итоги" }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Как прошёл день?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Хочу: факт 40 монет", exact: true }),
  ).toHaveAttribute("value", "40");
  await expect(
    page.getByRole("progressbar", {
      name: "Нужно: план 40 монет",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Что получилось и почему" }),
  ).toContainText("на желания ушло больше");
  await shot(page, "period-result", info);
  await page
    .getByRole("heading", { name: "Как Финни?" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("region", { name: "Баланс в конце дня" }),
  ).toContainText("10 монет");
  await expect(
    page.getByRole("region", { name: "Баланс в конце дня" }),
  ).toContainText("20 монет");
  await shot(page, "period-result-state", info);
  await unchangedReload(page);
  expect((await state(page)).periodHistory).toHaveLength(1);
  await page.getByRole("link", { name: "Следующий день", exact: true }).click();
  await page
    .getByRole("button", { name: "Составить план", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Как распорядимся монетками сегодня?" }),
  ).toBeVisible();
  expect((await state(page)).walletBalance).toBe(110);
  expect((await state(page)).savingsBalance).toBe(20);
  await unchangedReload(page);
  await page.goBack();
  expect(
    (await state(page)).transactions.filter((t) => t.type === "PERIOD_INCOME"),
  ).toHaveLength(2);
});

test("qualifying third period evolves, uses explorer art on Home, acknowledges once and respects reduced motion", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let p = initial();
  for (let i = 1; i <= 2; i++) p = closePeriod(actions(prepare(p, i), i), now);
  p = actions(prepare(p, 3), 3);
  expect(p.pet.stage).toBe("BABY");
  await seed(page, p);
  await finish(page);
  await page.getByRole("link", { name: "Следующий день", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Исследователь", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".evolution-new")).toHaveAttribute(
    "src",
    /explorer-happy/,
  );
  await shot(page, "evolution-explorer", info);
  expect(
    await page
      .locator(".evolution-new")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  await page.getByRole("button", { name: "Продолжить вместе" }).click();
  await expect(page.locator(".home-pet")).toHaveAttribute(
    "src",
    /explorer-idle/,
  );
  await unchangedReload(page);
  await page.goto("/day/evolution");
  await expect(page).toHaveURL(/home/);
  await expect(page.locator(".home-pet")).toHaveAttribute(
    "src",
    /explorer-idle/,
  );
  expect((await state(page)).pet.progress.completedPeriods).toBe(3);
});

for (const [species, label, color] of [
  ["cat", "Котик", "Белый"],
  ["dragon", "Дракончик", "Фиолетовый"],
  ["dog", "Собачка", "Хаски"],
])
  test(`five sequential periods: ${species}, first run, real actions, both evolutions`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    await page.goto("/");
    await page.getByRole("button", { name: "Начать", exact: true }).click();
    await page.getByRole("button", { name: "Выбрать Финни" }).click();
    await page.getByRole("button", { name: new RegExp(label!) }).click();
    await page
      .getByRole("button", { name: `Цвет: ${color}`, exact: true })
      .click();
    await page.getByLabel("Как назовём питомца?").fill("Финни");
    await page.getByRole("button", { name: /Готово/ }).click();
    await page.getByRole("button", { name: /К нашей мечте/ }).click();
    await unchangedReload(page);
    await page.goto("/day/start");
    for (let day = 1; day <= 5; day++) {
      await page
        .getByRole("button", { name: "Составить план", exact: true })
        .click();
      await allocate(page, day === 4 ? [55, 0, 40] : [30, 15, 40]);
      await page.getByRole("button", { name: "Готово", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Начать день", exact: true })
        .click();
      await expect(page).toHaveURL(/home/);
      if (day >= 2 && day <= 4) {
        await page.goto("/budget");
        await page.locator(".event-card").click();
        if (day === 2) await shot(page, "event", info);
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
        await unchangedReload(page);
      }
      await page.goto("/shop");
      await buy(page, "Обед");
      if (day !== 4) await buy(page, "Шарик");
      for (const id of dailyStories(day)) {
        await page.goto("/tasks");
        await page.locator(`a[href="/tasks/${id}"]`).click();
        if (id === "assemble-budget") await allocate(page, [40, 30, 30]);
        if (id === "needs-first")
          await page.getByRole("button", { name: /Сначала обед/ }).click();
        if (id === "save-for-scooter")
          await page
            .getByRole("button", { name: "Отложить 30", exact: true })
            .click();
        if (id === "fit-the-budget") {
          await page.getByRole("button", { name: "Обед", exact: true }).click();
          await page.getByRole("button", { name: "Уход", exact: true }).click();
        }
        if (id === "plan-changed")
          await page.getByRole("button", { name: /Сначала уход/ }).click();
        if (id === "dream-or-now")
          await page
            .getByRole("button", { name: "Отложить часть: 30", exact: true })
            .click();
        await page.getByRole("button", { name: /Забрать награду/ }).dblclick();
        await expect(
          page.getByRole("heading", { name: "Задание выполнено!" }),
        ).toBeVisible();
        await unchangedReload(page);
      }
      await page.goto("/savings");
      await page
        .getByRole("button", { name: "Отложить монетки", exact: true })
        .click();
      await page.getByRole("button", { name: "+20", exact: true }).click();
      await page.getByRole("button", { name: "+20", exact: true }).click();
      await page
        .getByRole("button", { name: "Продолжить", exact: true })
        .click();
      await page.getByRole("button", { name: "Отложить", exact: true }).click();
      if (day === 5) {
        await expect(
          page.getByRole("heading", { name: "Мечта сбылась! 🎉" }),
        ).toBeVisible();
        await shot(page, "goal-achieved", info);
        await page
          .getByRole("button", { name: "Продолжить копить", exact: true })
          .click();
      }
      await page.getByRole("button", { name: "Готово", exact: true }).click();
      await finish(page);
      await unchangedReload(page);
      const closed = await state(page);
      expect(closed.periodHistory).toHaveLength(day);
      expect(closed.savingsBalance).toBe(day * 40);
      expect(closed.pet.progress.completedPeriods).toBe(day);
      expect(closed.pet.stage).toBe(
        day < 3 ? "BABY" : day < 5 ? "EXPLORER" : "FINNI_PRO",
      );
      expect(
        closed.periodHistory.every(
          (p) =>
            p.budgetPlan?.confirmed &&
            p.periodResult?.snapshot &&
            p.budgetActual.savedActual === 40,
        ),
      ).toBe(true);
      if (day === 3 || day === 5) {
        await page
          .getByRole("link", { name: "Следующий день", exact: true })
          .click();
        await expect(page.locator(".evolution-new")).toHaveAttribute(
          "src",
          new RegExp(
            `${day === 3 ? "explorer" : "finni-pro"}-${species === "dragon" ? "idle" : "happy"}`,
          ),
        );
        // Wait for the finite CSS transition to reach its final pose.
        await expect
          .poll(() =>
            page
              .locator(".evolution-new")
              .evaluate((el) => getComputedStyle(el).opacity),
          )
          .toBe("1");
        if (day === 5) await shot(page, "evolution-pro", info);
        await page.getByRole("button", { name: "Продолжить вместе" }).click();
        await unchangedReload(page);
        if (day < 5) await page.goto("/day/start");
      } else if (day < 5)
        await page
          .getByRole("link", { name: "Следующий день", exact: true })
          .click();
    }
    await page.goto("/progress");
    await shot(page, "progress", info);
    await page
      .getByRole("heading", { name: "История дней", exact: true })
      .scrollIntoViewIfNeeded();
    await shot(page, "history", info);
    await expect(page.locator(".history-card")).toHaveCount(5);
    const profile = await state(page);
    expect(profile.pet.progress.learning).toBe(500);
    expect(profile.pet.appearance.species).toBe(species);
    expect(profile.pet.stage).toBe("FINNI_PRO");
    expect(profile.completedTasks).toHaveLength(6);
    await page.goto("/home");
    await expect(page.locator(".home-pet")).toHaveAttribute(
      "src",
      new RegExp(`pet-${species}-.*-finni-pro-`),
    );
    await page.screenshot({
      path: `docs/qa/final/cycle-${species}-${info.project.name}.png`,
    });
    await page.goto("/progress");
    expect(
      profile.transactions.filter((t) => t.type === "PERIOD_INCOME"),
    ).toHaveLength(5);
    await page.locator(".history-card").filter({ hasText: "День 1" }).click();
    await expect(
      page.getByRole("region", { name: "Баланс в конце дня" }),
    ).toContainText("40 монет");
    await unchangedReload(page);
    expect((await state(page)).periodHistory).toEqual(profile.periodHistory);
  });

test("weak empty period is closable and recovery keeps the next day available", async ({
  page,
}) => {
  let p = prepare(initial(), 1);
  p.currentPeriod!.budgetPlan = {
    ...p.currentPeriod!.budgetPlan!,
    plannedMandatory: 0,
    plannedOptional: 0,
    plannedSavings: 0,
    unallocated: 100,
  };
  await seed(page, p);
  await finish(page);
  await expect(
    page.getByRole("region", { name: "Что получилось и почему" }),
  ).toContainText("можно попробовать");
  expect((await state(page)).pet.stage).toBe("BABY");
  expect((await state(page)).walletBalance).toBe(100);
  await page.getByRole("link", { name: "Следующий день", exact: true }).click();
  await page
    .getByRole("button", { name: "Составить план", exact: true })
    .click();
  expect((await state(page)).walletBalance).toBe(200);
});

test("goal achievement keeps savings and offers remaining goals with persisted confirmation", async ({
  page,
}) => {
  let p = initial();
  // Reach the goal by real deposits; no direct savings/progress mutation.
  for (let i = 1; i <= 2; i++) {
    p = prepare(p, i);
    p = depositToSavings(p, 100, {
      transactionId: `save-all${i}`,
      createdAt: now,
    });
    p = closePeriod(p, now);
  }
  await seed(page, p);
  await page.goto("/progress");
  await page
    .getByRole("button", { name: "Выбрать новую мечту", exact: true })
    .click();
  await expect(page).toHaveURL(/goal\/select/);
  await expect(page.locator(".goal-choice")).toHaveCount(2);
  await page.getByRole("button", { name: /Домик Финни/ }).click();
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await unchangedReload(page);
  expect(await state(page)).toMatchObject({
    savingsBalance: 200,
    selectedGoalId: "pet_house",
    achievedGoalIds: ["scooter"],
  });
  await expect(page.getByTestId("goal-balance")).toHaveText("200 / 400");
});
