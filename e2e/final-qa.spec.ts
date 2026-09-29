import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createInitialProfile,
  selectSavingsGoal,
  startPeriod,
  updateBudgetPlan,
  confirmBudgetPlan,
  closePeriod,
  type GameProfile,
} from "../packages/shared/src";
const petOptions = Object.entries({
  cat: ["ginger", "white", "black"],
  dragon: ["turquoise", "green", "purple"],
  dog: ["dalmatian", "brown", "husky"],
}).flatMap(([species, colors]) =>
  colors.map((colorVariant) => ({ species, colorVariant })),
);
import {
  situations,
  purchases,
  goals,
  programDailyTasks,
} from "../packages/content";
const now = "2026-09-19T00:00:00.000Z";
const qa = "docs/qa/final";
const faults = new Map<Page, string[]>();
test.beforeEach(async ({ page }) => {
  mkdirSync(qa, { recursive: true });
  const errors: string[] = [];
  faults.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
});
test.afterEach(async ({ page }) => expect(faults.get(page)).toEqual([]));
function initial(appearance = petOptions[0]!, active = true): GameProfile {
  let p = selectSavingsGoal(
    createInitialProfile({
      id: "final",
      petId: "final-pet",
      petName: "Финни",
      playerNickname: "Гость",
      appearance,
      now,
    }),
    "scooter",
    now,
  );
  return active ? start(p, 1) : p;
}
function start(p: GameProfile, day: number) {
  return confirmBudgetPlan(
    updateBudgetPlan(
      startPeriod(p, {
        income: 100,
        periodId: `day-${day}`,
        transactionId: `income-${day}`,
        startedAt: now,
      }),
      { plannedMandatory: 30, plannedOptional: 20, plannedSavings: 40 },
      now,
    ),
    now,
  );
}
async function seed(page: Page, p: GameProfile) {
  await page.goto("/");
  await page.evaluate((p) => {
    localStorage.setItem(
      "finni.game-profile",
      JSON.stringify({ ...p, needsUpdatedAt: new Date().toISOString() }),
    );
    localStorage.removeItem("finni.profile-mode");
  }, p);
  await page.goto("/home");
}
async function state(page: Page): Promise<GameProfile> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
}
async function reload(page: Page) {
  const before = await state(page);
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  expect(await state(page)).toEqual(before);
}
async function layout(page: Page, name: string) {
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((imgs) =>
          imgs.every(
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
    name,
  ).toBe(true);
  for (const container of await page
    .locator(".game-content,.setup-content,dialog[open],.home-body")
    .all()) {
    expect(
      await container.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      name + " inner overflow",
    ).toBe(true);
  }
  const dialogs = page.locator("dialog[open]");
  for (const dialog of await dialogs.all()) {
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1,
    );
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    );
  }
  await page.screenshot({
    path: `${qa}/${name}-${page.viewportSize()!.width}.png`,
  });
}
for (const pet of petOptions) {
  test(`identity ${pet.species}/${pet.colorVariant}: all stages, low state, reward, wrong answer, reload`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    for (const stage of ["BABY", "EXPLORER", "FINNI_PRO"] as const) {
      let p = initial(pet);
      p.pet.stage = stage;
      await seed(page, p);
      await layout(page, `${pet.species}-${pet.colorVariant}-${stage}-idle`);
      const fileStage =
        stage === "FINNI_PRO" ? "finni-pro" : stage.toLowerCase();
      await expect(page.locator(".home-pet")).toHaveAttribute(
        "src",
        new RegExp(`pet-${pet.species}-${pet.colorVariant}-${fileStage}-idle`),
      );
      await reload(page);
      p.pet.state = { satiety: 0, mood: 0, care: 0 };
      await seed(page, p);
      await expect(page.locator(".home-pet")).toHaveAttribute(
        "src",
        new RegExp(`-sad\\.webp`),
      );
      await layout(page, `${pet.species}-${pet.colorVariant}-${stage}-low`);
      await page.goto("/shop");
      await page
        .getByRole("button", { name: "Купить: Завтрак", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Купить", exact: true })
        .dblclick();
      // Profile writes go through the async Web Locks coordinator; await the commit.
      await expect.poll(() => state(page).then((p) => p.walletBalance)).toBe(80);
      expect(
        (await state(page)).transactions.filter(
          (t) => t.type === "PURCHASE_MANDATORY",
        ),
      ).toHaveLength(1);
      await expect(
        page.getByRole("dialog").getByTestId("pet-image"),
      ).toHaveAttribute(
        "src",
        new RegExp(
          `pet-${pet.species}-${pet.colorVariant}-${fileStage}-${pet.species === "dragon" ? "idle" : "happy"}`,
        ),
      );
      await layout(page, `${pet.species}-${pet.colorVariant}-${stage}-happy`);
      await page.getByRole("button", { name: "Здорово!" }).click();
      await reload(page);
      await page.goto("/situations/S01");
      await page
        .getByRole("button", {
          name: situations[0]!.options[(situations[0]!.correct + 1) % 3]!,
          exact: true,
        })
        .click();
      await expect(page.locator(".reaction-pet")).toHaveAttribute(
        "src",
        new RegExp(
          `pet-${pet.species}-${pet.colorVariant}-${fileStage}-sad`,
        ),
      );
      await layout(page, `${pet.species}-${pet.colorVariant}-${stage}-wrong`);
    }
  });
}
test("all thirty situations: incorrect, hint, correct, double tap, reload, back, isolated demo", async ({
  page,
}) => {
  test.setTimeout(180000);
  let p = initial();
  for (let day = 1; day < 5; day++) {
    p = closePeriod(p, now);
    p = start(p, day + 1);
  }
  await seed(page, p);
  const learning = p.pet.progress.learning;
  for (const [i, s] of situations.entries()) {
    await page.goto(`/situations/${s.id}`);
    await page
      .getByRole("button", {
        name: s.options[(s.correct + 1) % 3]!,
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Попробуй ещё раз");
    await page.getByRole("dialog").getByRole("button", { name: "Попробовать ещё раз" }).click();
    await page.getByRole("button", { name: /Подсказка/ }).click();
    await expect(page.locator(".task-hint")).toContainText(s.hint);
    await page
      .getByRole("button", { name: s.options[s.correct]!, exact: true })
      .dblclick();
    await expect(page.getByRole("heading", { name: /Верно!/ })).toBeVisible();
    await expect.poll(async () => (await state(page)).completedSituationIds.length).toBe(i + 1);
    expect((await state(page)).pet.progress.learning).toBe(
      learning + 8 * (i + 1),
    );
    await layout(page, `situation-${s.id}`);
    await reload(page);
    await page
      .getByRole("button", { name: s.options[s.correct]!, exact: true })
      .click();
    expect((await state(page)).pet.progress.learning).toBe(
      learning + 8 * (i + 1),
    );
  }
  const saved = await state(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Демо-режим", exact: true }).click();
  await page
    .getByRole("button", { name: "Запустить демо", exact: true })
    .click();
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await page.goto("/situations");
  await expect(page.locator(".situation-progress")).toContainText(
    "Пройдено 0 из 30",
  );
  expect(await state(page)).toEqual(saved);
});
test("every shop item: price, effect, single debit, history, reload and insufficient funds", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const item of purchases) {
    let p = initial();
    p.pet.state = { satiety: 0, mood: 0, care: 0 };
    await seed(page, p);
    await page.goto("/shop");
    await page
      .getByRole("button", { name: `Купить: ${item.title}`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Купить", exact: true })
      .dblclick();
    // Writes are coordinated through Web Locks; await the committed balance.
    await expect
      .poll(() => state(page).then((p) => p.walletBalance))
      .toBe(100 - item.price);
    const after = await state(page);
    expect(after.transactions.at(-1)?.metadata.purchaseId).toBe(item.id);
    for (const stat of ["satiety", "mood", "care"] as const)
      expect(after.pet.state[stat]).toBe(Math.max(0, item.effect[stat] ?? 0));
    await layout(page, `item-${item.id}`);
    await page.getByRole("button", { name: "Здорово!" }).click();
    await reload(page);
    p.walletBalance = 0;
    await seed(page, p);
    await page.goto("/shop");
    await page
      .getByRole("button", { name: `Купить: ${item.title}`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Купить", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Не хватает");
    expect((await state(page)).walletBalance).toBe(0);
  }
});
test("all goals at zero, partial, complete and over target; all-complete return preserves selected goal", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const g of goals)
    for (const value of [0, Math.floor(g.cost / 2), g.cost, g.cost + 100]) {
      let p = initial();
      p.selectedGoalId = g.id;
      p.savingsBalance = value;
      await seed(page, p);
      await page.goto("/progress");
      const bars = page.getByRole("progressbar");
      for (const b of await bars.all()) {
        const v = Number(await b.getAttribute("value"));
        const max = Number((await b.getAttribute("max")) ?? 1);
        expect(v).toBeLessThanOrEqual(max);
      }
      await layout(page, `goal-${g.id}-${value}`);
      await reload(page);
    }
  let p = initial();
  p.achievedGoalIds = goals.map((g) => g.id);
  p.selectedGoalId = goals.at(-1)!.id;
  await seed(page, p);
  await page.goto("/goal/select");
  await page.getByRole("button", { name: "К Финни" }).click();
  expect((await state(page)).selectedGoalId).toBe(p.selectedGoalId);
});
test("onboarding drafts and existing pet on repeat tutorial", async ({
  page,
}) => {
  await page.goto("/pet/create");
  await page.getByRole("button", { name: /Собачка/ }).click();
  await page.getByRole("button", { name: "Цвет: Хаски", exact: true }).click();
  await page.getByLabel("Как назовём питомца?").fill("ОченьДлинноеИмя!");
  await page.reload();
  await expect(page.getByLabel("Как назовём питомца?")).toHaveValue(
    "ОченьДлинноеИмя!",
  );
  await expect(page.locator(".creation-preview img")).toHaveAttribute(
    "src",
    /dog-husky/,
  );
  await page.getByRole("button", { name: /Готово/ }).click();
  await page.getByRole("button", { name: /Домик Финни/ }).click();
  await reload(page);
  await expect(
    page.getByRole("button", { name: /Домик Финни/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await page.goto("/onboarding");
  await expect(page.locator(".welcome-pet img")).toHaveAttribute(
    "src",
    /dog-husky/,
  );
  await layout(page, "repeat-tutorial-husky");
});
test("small and tall screens, large balances, long names, keyboard-sized viewport, routes and guards", async ({
  page,
}) => {
  test.setTimeout(90000);
  let p = initial();
  p.pet.name = "ОченьДлинноеИмя!!";
  p.walletBalance = 999999999;
  p.savingsBalance = 999999999;
  p.transactions.push({
    id: "large-balance-income",
    type: "PERIOD_INCOME",
    amount: 1999999898,
    source: "large-balance-test",
    category: "INCOME",
    periodId: p.currentPeriod!.id,
    createdAt: now,
    metadata: {},
  });
  await seed(page, p);
  for (const size of [
    { width: 320, height: 568 },
    { width: 360, height: 360 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    await page.setViewportSize(size);
    for (const path of [
      "/home",
      "/budget",
      "/shop",
      "/savings",
      "/tasks",
      "/situations",
      "/progress",
      "/settings",
      "/adult",
      "/unknown",
    ]) {
      await page.goto(path);
      await layout(page, `${path.slice(1)}-edge-${size.height}`);
    }
  }
  await page.goto("/adult/dashboard");
  await expect(page).toHaveURL(/\/adult$/);
  for (const path of ["/day/evolution", "/day/result/missing"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/home$/);
  }
  await page.goto("/tasks/missing");
  await expect(
    page.getByRole("heading", { name: "Выберем другую историю" }),
  ).toBeVisible();
  await page.goto("/situations/missing");
  await expect(
    page.getByRole("heading", { name: "Выберем другую историю" }),
  ).toBeVisible();
});
test("day five keeps its second task visible after the first", async ({
  page,
}) => {
  let p = initial();
  const [first, second] = programDailyTasks(5);
  p.currentPeriod!.index = 5;
  p.completedTasks = [
    {
      taskId: first!.id,
      periodId: p.currentPeriod!.id,
      successful: true,
      completedAt: now,
    },
  ];
  p.currentPeriod!.taskResults = [
    {
      taskId: first!.id,
      topic: "PAYMENTS_AND_PURCHASES",
      successful: true,
      reward: 10,
      completedAt: now,
    },
  ];
  await seed(page, p);
  await expect(page.locator(".home-context-card")).toContainText("Задание дня");
  await expect(page.locator(".home-context-card")).toContainText(second!.title);
});

test("failed situation save can retry, and a failed demo-mode switch keeps normal service", async ({
  page,
}) => {
  await seed(page, initial());
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (sessionStorage.getItem("qa-fail-key") === key)
        throw new Error("QA injected quota");
      return original.call(this, key, value);
    };
  });
  await page.evaluate(() =>
    sessionStorage.setItem("qa-fail-key", "finni.game-profile"),
  );
  await page.goto("/situations/S01");
  const before = await state(page);
  await page
    .getByRole("button", {
      name: situations[0]!.options[situations[0]!.correct]!,
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  expect(await state(page)).toEqual(before);
  await expect(page.getByRole("heading", { name: /Верно!/ })).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem("qa-fail-key"));
  await page
    .getByRole("button", {
      name: situations[0]!.options[situations[0]!.correct]!,
      exact: true,
    })
    .click();
  await expect.poll(async () => (await state(page)).completedSituationIds).toEqual(["S01"]);
  await reload(page);
  const normal = await state(page);
  await page.evaluate(() =>
    sessionStorage.setItem("qa-fail-key", "finni.profile-mode"),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Демо-режим", exact: true }).click();
  await page
    .getByRole("button", { name: "Запустить демо", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Не удалось сохранить");
  await page.goto("/situations/S02");
  await page
    .getByRole("button", {
      name: situations[1]!.options[situations[1]!.correct]!,
      exact: true,
    })
    .click();
  await expect.poll(async () => (await state(page)).completedSituationIds).toEqual(["S01", "S02"]);
  expect((await state(page)).id).toBe(normal.id);
});
test("missing pet images fall back within identity and then to readable placeholder", async ({
  page,
}) => {
  await seed(page, initial());
  // A successfully fetched but undecodable image exercises onError without a network outage.
  await page.route("**/characters/pet-cat-ginger-baby-happy.webp", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/webp",
      body: "QA invalid image",
    }),
  );
  await page.goto("/shop");
  await page
    .getByRole("button", { name: "Купить: Завтрак", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Купить", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByTestId("pet-image"),
  ).toHaveAttribute("src", /cat-ginger-baby-idle/);
  await page.route("**/characters/pet-cat-ginger-*.webp", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/webp",
      body: "QA invalid image",
    }),
  );
  await page.goto("/home");
  await expect(page.locator(".asset-unavailable").first()).toContainText(
    "Твой прогресс сохранён",
  );
  await expect(page.getByRole("navigation")).toBeVisible();
  expect((await state(page)).walletBalance).toBe(80);
});
test("situation learning survives reload without premature evolution", async ({
  page,
}) => {
  const p = initial();
  p.pet.progress = {
    mandatoryCare: 745,
    planDiscipline: 0,
    savings: 0,
    learning: 0,
    completedPeriods: 3,
  };
  await seed(page, p);
  await page.goto("/situations/S01");
  await page
    .getByRole("button", {
      name: situations[0]!.options[situations[0]!.correct]!,
      exact: true,
    })
    .click();
  await expect.poll(async () => (await state(page)).completedSituationIds).toContain("S01");
  expect((await state(page)).pet.stage).toBe("BABY");
  await reload(page);
  expect((await state(page)).pendingEvolution).toBeNull();
  await page.goto("/day/evolution");
  await expect(page).toHaveURL(/home/);
});

test("Adult gate can be reopened after leaving", async ({ page }) => {
  await seed(page, initial());
  await page.goto("/adult");
  await page
    .getByRole("button", { name: "Удерживайте 3 секунды" })
    .press("Space", { delay: 3200 });
  await expect(page).toHaveURL(/adult\/dashboard/);
  await page.getByRole("link", { name: "Назад", exact: true }).click();
  await page.getByRole("link", { name: "Для взрослых", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Для взрослых" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Удерживайте 3 секунды" }).focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => Number(await page.locator(".hold-progress").getAttribute("value"))).toBeGreaterThan(0);
  await expect(page).toHaveURL(/adult\/dashboard/);
  await page.keyboard.up("Space");
});

test("all nine appearance choices survive creation, reload and navigation", async ({
  page,
}) => {
  test.setTimeout(90000);
  const labels: Record<string, string> = {
    cat: "Котик",
    dragon: "Дракончик",
    dog: "Собачка",
    ginger: "Рыжий",
    white: "Белый",
    black: "Чёрный",
    turquoise: "Бирюзовый",
    green: "Зелёный",
    purple: "Фиолетовый",
    dalmatian: "Далматинец",
    brown: "Коричневый",
    husky: "Хаски",
  };
  await page.goto("/");
  for (const pet of petOptions) {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/pet/create");
    await page
      .getByRole("button", { name: new RegExp(labels[pet.species]!) })
      .click();
    await page
      .getByRole("button", {
        name: `Цвет: ${labels[pet.colorVariant]}`,
        exact: true,
      })
      .click();
    await page.getByLabel("Как назовём питомца?").fill("Финни");
    await page.reload();
    await expect(page.locator(".creation-preview img")).toHaveAttribute(
      "src",
      new RegExp(`pet-${pet.species}-${pet.colorVariant}-baby-idle`),
    );
    await page.getByRole("button", { name: /Готово/ }).click();
    await expect(page).toHaveURL(/goal\/select/);
    await reload(page);
    await page.getByRole("button", { name: /К нашей мечте/ }).click();
    await expect(page).toHaveURL(/home/);
    await reload(page);
    expect((await state(page)).pet.appearance).toMatchObject(pet);
    await page.getByRole("link", { name: "Настройки", exact: true }).click();
    await page.getByRole("link", { name: "Назад", exact: true }).click();
    await expect(page.locator(".home-pet")).toHaveAttribute(
      "src",
      new RegExp(`pet-${pet.species}-${pet.colorVariant}-baby-`),
    );
  }
});

test("mobile touch targets, simulated safe areas and input viewport resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/pet/create");
  await page.addStyleTag({
    content:
      ":root { --safe-area-inset-top: 24px; --safe-area-inset-bottom: 24px; }",
  });
  await page.setViewportSize({ width: 320, height: 320 });
  await page.getByLabel("Как назовём питомца?").fill("Друг");
  await expect(page.getByLabel("Как назовём питомца?")).toBeInViewport();
  await page.getByRole("button", { name: /Готово/ }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  for (const path of ["/home", "/settings", "/adult"]) {
    await page.goto(path);
    await page.addStyleTag({
      content:
        ":root { --safe-area-inset-top: 24px; --safe-area-inset-bottom: 24px; }",
    });
    for (const el of await page
      .locator("button,a.button,.bottom-navigation a,.icon-button,.toggle-row")
      .all()) {
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      expect(b!.height, `${path} target height`).toBeGreaterThanOrEqual(48);
      expect(b!.width, `${path} target width`).toBeGreaterThanOrEqual(48);
    }
    await layout(page, `safe-area-${path.slice(1)}`);
  }
});

test("Adult failed reset/delete reports the error and preserves the saved profile", async ({
  page,
}) => {
  await seed(page, initial());
  const saved = await state(page);
  await page.goto("/adult");
  await page
    .getByRole("button", { name: "Удерживайте 3 секунды" })
    .press("Space", { delay: 3200 });
  await page.evaluate(() => {
    const save = Storage.prototype.setItem,
      remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "finni.game-profile") throw new Error("QA quota");
      return save.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (key === "finni.game-profile") throw new Error("QA unavailable");
      return remove.call(this, key);
    };
  });
  await page
    .getByRole("button", { name: "Сбросить прогресс", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Сбросить", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  expect(await state(page)).toEqual(saved);
  await page
    .getByRole("button", { name: "Удалить профиль", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить профиль", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  expect(await state(page)).toEqual(saved);
  await reload(page);
  await expect(page).toHaveURL(/\/adult$/);
});
