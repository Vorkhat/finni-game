import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  closePeriod,
  confirmBudgetPlan,
  createInitialProfile,
  executePurchase,
  selectSavingsGoal,
  startPeriod,
  updateBudgetPlan,
  type GameProfile,
} from "../packages/shared/src";
import {
  dailySituations,
  periodNeeds,
  programDailyTasks,
  purchases,
} from "../packages/content";
const now = "2026-09-16T00:00:00.000Z";
const qa = "docs/qa/home-redesign";
const initial = () =>
  selectSavingsGoal(
    createInitialProfile({
      id: "home-browser",
      petId: "cat",
      petName: "Финни",
      playerNickname: "Гость",
      appearance: { species: "cat", colorVariant: "ginger" },
      now,
    }),
    "scooter",
    now,
  );
const active = () =>
  confirmBudgetPlan(
    updateBudgetPlan(
      startPeriod(initial(), {
        periodId: "home-day",
        income: 100,
        transactionId: "income",
        startedAt: now,
        mandatoryNeeds: periodNeeds(1),
      }),
      { plannedMandatory: 40, plannedOptional: 20, plannedSavings: 40 },
      now,
    ),
    now,
  );
const readyDay = (income = 100, index = 1) => {
  let p = confirmBudgetPlan(
    updateBudgetPlan(
      startPeriod(initial(), {
        periodId: "home-day",
        income,
        transactionId: "income",
        startedAt: now,
        mandatoryNeeds: periodNeeds(1),
      }),
      {
        plannedMandatory: income - 60,
        plannedOptional: 20,
        plannedSavings: 40,
      },
      now,
    ),
    now,
  );
  p.currentPeriod!.index = index;
  for (const id of ["lunch", "ball", "care"])
    p = executePurchase(p, purchases.find((i) => i.id === id)!, {
      transactionId: `ready-${id}`,
      createdAt: now,
    });
  p.completedTasks = programDailyTasks(index).map((t) => ({
    taskId: t.id,
    successful: true,
    completedAt: now,
    periodId: p.currentPeriod!.id,
  }));
  p.completedSituationIds = dailySituations(index);
  p.pet.state = { satiety: 100, mood: 100, care: 100 };
  return p;
};
async function seed(page: Page, p: GameProfile) {
  await page.addInitScript((p) => {
    if (!localStorage.getItem("finni.game-profile"))
      localStorage.setItem(
        "finni.game-profile",
        JSON.stringify({ ...p, needsUpdatedAt: new Date().toISOString() }),
      );
  }, p);
  await page.goto("/home");
  await expect(page.locator(".home-pet")).toBeVisible();
}
async function dismissAll(page: Page) {
  for (let i = 0; i < 20; i++) {
    const close = page.getByRole("button", {
      name: "Закрыть сообщение",
      exact: true,
    });
    if (!(await close.count())) break;
    await close.click();
  }
  await expect(page.locator(".home-context-card")).toHaveCount(0);
}
async function sceneFits(page: Page) {
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
  const geometry = await page.evaluate(() => {
    const body = document.querySelector(".home-body")!;
    const nav = document
      .querySelector(".bottom-navigation")!
      .getBoundingClientRect();
    const room = document.querySelector(".pet-room")!.getBoundingClientRect();
    const stat = document
      .querySelector(".home-status")!
      .getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth > innerWidth,
      overflowY: document.documentElement.scrollHeight > innerHeight,
      bodyOverflow: body.scrollHeight > body.clientHeight + 1,
      navBottom: nav.bottom,
      navTop: nav.top,
      height: innerHeight,
      roomHeight: room.height,
      overlap: room.bottom > stat.top,
    };
  });
  expect(geometry.overflowX).toBe(false);
  expect(geometry.overflowY).toBe(false);
  expect(geometry.bodyOverflow).toBe(false);
  expect(geometry.navBottom).toBeLessThanOrEqual(geometry.height);
  expect(geometry.roomHeight).toBeGreaterThanOrEqual(140);
  expect(geometry.overlap).toBe(false);
  expect(await page.locator(".home-context-card").count()).toBeLessThanOrEqual(
    1,
  );
  expect(
    await page.locator(".home-context-card .button").count(),
  ).toBeLessThanOrEqual(1);
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(5);
}
const errors = new Map<Page, string[]>();
test.beforeEach(({ page }) => {
  mkdirSync(qa, { recursive: true });
  errors.set(page, []);
  page.on("pageerror", (e) => errors.get(page)!.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.get(page)!.push(m.text());
  });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

test("unfinished task stays available after opening and returning; explicit dismissal persists", async ({
  page,
}) => {
  await seed(page, active());
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-type",
    "task",
  );
  await page.getByRole("button", { name: /Начать ·/ }).click();
  await expect(page).toHaveURL(/tasks\/T\d+/);
  await page.getByRole("link", { name: "Назад", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Дом", exact: true })
    .click();
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-type",
    "task",
  );
  await page
    .getByRole("button", { name: "Закрыть сообщение", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("[data-event-type='task']")).toHaveCount(0);
});

test("room, current action and neutral Home fit all requested viewports", async ({
  page,
}) => {
  await seed(page, active());
  for (const [width, height] of [
    [360, 640],
    [375, 667],
    [390, 844],
    [393, 852],
    [430, 932],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await sceneFits(page);
    await page.screenshot({ path: `${qa}/action-${width}.png` });
  }
  await dismissAll(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("finni.game-profile"),
  );
  await page.reload();
  await expect(page.locator(".home-context-card")).toHaveCount(0);
  for (const [width, height] of [
    [360, 640],
    [375, 667],
    [390, 844],
    [393, 852],
    [430, 932],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await sceneFits(page);
    await page.screenshot({ path: `${qa}/neutral-${width}.png` });
  }
  expect(
    await page.evaluate(() => localStorage.getItem("finni.game-profile")),
  ).toBe(before);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-area-inset-top", "24px");
    document.documentElement.style.setProperty(
      "--safe-area-inset-bottom",
      "34px",
    );
  });
  await sceneFits(page);
  await page.screenshot({ path: `${qa}/safe-area-360.png` });
});

test("low state wins, care purchase removes alert, feedback survives reload", async ({
  page,
}) => {
  const p = active();
  p.pet.state.satiety = 18;
  p.pet.state.care = 20;
  await seed(page, p);
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-id",
    "low:satiety",
  );
  await page.getByRole("button", { name: "Покормить", exact: true }).click();
  await expect(page).toHaveURL(/shop\?activity=feed&need=satiety/);
  await expect(
    page.getByText("Поможет Финни", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Купить: Обед", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Купить", exact: true })
    .click();
  await page.getByRole("button", { name: "Здорово!" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Дом", exact: true })
    .click();
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-id",
    "low:care",
  );
  await expect(page.locator(".home-stat.attention")).toHaveCount(1);
  await expect(
    page.getByRole("meter", { name: "Сытость" }),
  ).toHaveAttribute("aria-valuenow", "48");
  await page.reload();
  await expect(page.locator("[data-event-id='low:satiety']")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith("finni.home-events"))
          .map((k) => localStorage.getItem(k))
          .join(""),
      ),
    )
    .toContain("Спасибо за заботу");
  await sceneFits(page);
});

test("single sheet owns story, manual finish and saved day result", async ({
  page,
}) => {
  const p = readyDay(100, 2);
  await seed(page, p);
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-type",
    "story",
  );
  await page.getByRole("button", { name: "Посмотреть", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.locator(".home-context-card")).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Закрыть/ })
    .click();
  await page
    .getByRole("button", { name: "План на день 2", exact: true })
    .click();
  await page.getByRole("button", { name: /›/ }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.getByRole("dialog").getByRole("button").nth(1).click();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page
    .getByRole("button", { name: "План на день 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Завершить день", exact: true })
    .click();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  await page
    .getByRole("button", { name: "Посмотреть итоги", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Итоги дня", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "План и факт", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Начать следующий день", exact: true }),
  ).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(after.currentPeriod).toBeNull();
  expect(after.periodHistory).toHaveLength(before.periodHistory.length + 1);
  expect(after.walletBalance).toBe(before.walletBalance);
  await page.screenshot({ path: `${qa}/day-result.png` });
  await page.reload();
  await page
    .getByRole("button", { name: "План на день 2", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Итоги дня 2", exact: true }),
  ).toBeVisible();
});

test("new day, no goal, all complete and empty wallet remain usable", async ({
  page,
}) => {
  const p = initial();
  p.selectedGoalId = null;
  await seed(page, p);
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-id",
    "choose-goal",
  );
  await sceneFits(page);
  await page
    .getByRole("button", { name: "Выбрать мечту", exact: true })
    .click();
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-type",
    "day",
  );
  await page.getByRole("button", { name: "Начать день", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Составить план", exact: true }),
  ).toBeVisible();
});

test("completed task enables finish and never renders another daily task", async ({
  page,
}) => {
  const p = readyDay(300, 1);
  p.walletBalance = 0;
  p.savingsBalance = 200;
  await seed(page, p);
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-type",
    "achievement",
  );
  await page.getByRole("button", { name: "Закрыть сообщение" }).click();
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-type",
    "finish",
  );
  await dismissAll(page);
  await page.reload();
  await expect(page.locator(".home-context-card")).toHaveCount(0);
  await sceneFits(page);
  await expect(page.getByTestId("wallet-balance")).toHaveText("0");
  await expect(page.getByTestId("goal-balance")).toHaveText("200 / 200");
  await page.getByRole("link", { name: /Моя цель:/ }).click();
  await expect(
    page.getByRole("heading", { name: /Мечта сбылась/ }),
  ).toBeVisible();
});

test("informational speech times out and stays read after refresh", async ({
  page,
}) => {
  await seed(page, initial());
  await page.getByRole("button", { name: "Закрыть сообщение" }).click();
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-id",
    "welcome",
  );
  await page.mouse.move(1, 1);
  await page.mouse.click(8, 100);
  await expect(page.locator(".home-context-card")).toHaveCount(0, {
    timeout: 16000,
  });
  await page.reload();
  await expect(page.locator(".home-context-card")).toHaveCount(0);
});

test("saved draft plan starts from Home without changing allocations or paying income twice", async ({
  page,
}) => {
  const p = updateBudgetPlan(
    startPeriod(initial(), {
      periodId: "draft",
      income: 100,
      transactionId: "income",
      startedAt: now,
      mandatoryNeeds: periodNeeds(1),
    }),
    { plannedMandatory: 40, plannedOptional: 20, plannedSavings: 40 },
    now,
  );
  await seed(page, p);
  await expect(page.locator(".home-context-card")).toContainText("Нужно — 40");
  await page.getByRole("button", { name: "Начать день", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Сегодня твой план");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Начать день", exact: true })
    .dblclick();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(saved.currentPeriod.status).toBe("ACTIVE");
  expect(saved.currentPeriod.budgetPlan).toMatchObject({
    plannedMandatory: 40,
    plannedOptional: 20,
    plannedSavings: 40,
    confirmed: true,
  });
  expect(saved.walletBalance).toBe(100);
  expect(saved.transactions).toHaveLength(1);
});

test("unseen growth stays one required event and remains reachable after reload", async ({
  page,
}) => {
  const p = closePeriod(active(), now);
  p.periodHistory[0]!.evolutionSeen = false;
  p.periodHistory[0]!.periodResult!.petStageChange = {
    from: "BABY",
    to: "EXPLORER",
  };
  p.pet.stage = "EXPLORER";
  await seed(page, p);
  await expect(page.locator(".home-context-card")).toHaveAttribute(
    "data-event-type",
    "evolution",
  );
  await expect(
    page.getByRole("button", { name: "Закрыть сообщение" }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Посмотреть", exact: true }).click();
  await expect(page).toHaveURL(/day\/evolution/);
  await page
    .getByRole("button", { name: "Продолжить вместе", exact: true })
    .click();
  await expect(page.locator("[data-event-type='evolution']")).toHaveCount(0);
});
