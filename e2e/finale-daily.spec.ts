import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  createInitialProfile,
  startPeriod,
  updateBudgetPlan,
  confirmBudgetPlan,
  closePeriod,
  type GameProfile,
} from "../packages/shared/src";
import { dailySituations, programTasks } from "../packages/content";
const now = "2026-09-25T08:00:00.000Z";
function fixture(days: number, active = false) {
  let p = createInitialProfile({
    id: "finale-ui",
    petId: "pet",
    petName: "Искорка",
    playerNickname: "Гость",
    appearance: { species: "dragon", colorVariant: "turquoise" },
    now,
  });
  p.selectedGoalId = "scooter";
  for (let day = 1; day <= days + Number(active); day++) {
    p = confirmBudgetPlan(
      updateBudgetPlan(
        startPeriod(p, {
          periodId: `d${day}`,
          transactionId: `i${day}`,
          income: 100,
          startedAt: now,
        }),
        { plannedMandatory: 50, plannedOptional: 30, plannedSavings: 20 },
        now,
      ),
      now,
    );
    if (day <= days) p = closePeriod(p, now);
  }
  p.periodHistory = p.periodHistory.map((d) => ({ ...d, evolutionSeen: true }));
  p.pendingEvolution = null;
  p.pet.state = { satiety: 80, mood: 80, care: 80 };
  p.completedSituationIds = Array.from({ length: days }, (_, i) =>
    dailySituations(i + 1),
  ).flat();
  p.completedTasks = programTasks.filter(t => t.day <= days).map(t => ({taskId:t.id,periodId:`d${t.day}`,successful:true,completedAt:now}));
  return p;
}
async function seed(page: import("@playwright/test").Page, p: GameProfile) {
  await page.clock.install({ time: new Date(now) });
  await page.addInitScript((value) => {
    if (!localStorage.getItem("finni.game-profile"))
      localStorage.setItem("finni.game-profile", JSON.stringify(value));
  }, p);
}
test("situations open at day six, with previous days still available", async ({
  page,
}, info) => {
  await seed(page, fixture(5, true));
  await page.goto("/situations");
  await expect(page.getByLabel("Выбери день")).toHaveValue("6");
  await expect(page.locator(".situation-list > *")).toHaveCount(6);
  await expect(page.locator(".situation-card").first()).toContainText("День 6");
  await page.getByLabel("Выбери день").selectOption("1");
  await expect(page.locator(".situation-card").first()).toContainText("День 1");
  await page.goto("/home");
  await page.goto("/situations");
  await expect(page.getByLabel("Выбери день")).toHaveValue("6");
  mkdirSync("docs/qa/finale", { recursive: true });
  await page.screenshot({
    path: `docs/qa/finale/${info.project.name}-day-six.png`,
  });
});
test("finale leads to a personal dream, new friend and saved album", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/assets/") && r.status() >= 400) errors.push(r.url());
  });
  await seed(page, fixture(10));
  await page.goto("/home");
  await expect(page).toHaveURL(/\/finale$/);
  await expect(
    page.getByRole("heading", { name: "Вы выросли вместе! ✨" }),
  ).toBeVisible();
  await expect(page.locator(".finale-pet")).toHaveAttribute(
    "src",
    /-finni-pro-determined\.webp$/,
  );
  mkdirSync("docs/qa/finale", { recursive: true });
  await page.screenshot({
    path: `docs/qa/finale/${info.project.name}-celebration.png`,
  });
  await page
    .getByRole("button", { name: "Остаться вместе", exact: true })
    .click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/goal/select");
  await page.getByLabel("О чём мечтаешь?").fill("Мой секретный подарок");
  await page.getByLabel("Сколько игровых монет накопим?").fill("250");
  await page.getByRole("button", { name: "Копить на свою мечту" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/progress");
  await expect(
    page.getByRole("link", { name: /Моя цель: Мой секретный подарок/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Моя цель: Мой секретный подарок/ }),
  ).toBeVisible();
  await page.goto("/finale");
  await page.getByRole("button", { name: "Выбрать нового питомца" }).click();
  await page.getByRole("link", { name: "Выбрать нового друга" }).click();
  await page.getByLabel("Как назовём питомца?").fill("Дружок");
  await page.getByRole("button", { name: /Готово/ }).click();
  await expect(page).toHaveURL(/\/goal\/select$/);
  await page.getByRole("button", { name: /К нашей мечте/ }).click();
  await page.goto("/pet/album");
  await expect(
    page.getByRole("heading", { name: "Искорка", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(saved.pet.name).toBe("Дружок");
  expect(saved.pet.stage).toBe("BABY");
  expect(saved.petAlbum).toHaveLength(1);
  expect(saved.periodHistory).toHaveLength(0);
  expect(errors).toEqual([]);
});
test("red needs block the next day but recovery works without coins", async ({
  page,
}) => {
  const p = fixture(1);
  p.walletBalance = 0;
  p.savingsBalance = 0;
  p.pet.state = { satiety: 20, mood: 20, care: 20 };
  await seed(page, p);
  await page.goto("/day/start");
  await expect(
    page.getByRole("heading", { name: "Поможем Финни перед новым днём" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Составить план" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Покормить Финни · бесплатно" })
    .click();
  await page.getByRole("button", { name: "Умыть Финни · бесплатно" }).click();
  await expect(
    page.getByRole("button", { name: "Составить план" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Составить план" }).click();
  await expect(page).toHaveURL(/\/budget$/);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("finni.game-profile")!),
  );
  expect(saved.walletBalance).toBe(100);
  expect(saved.currentPeriod.index).toBe(2);
});

test("adult dashboard shows every day and completed dreams separately",async({page})=>{
 const p=fixture(10,true);p.finaleSeen=true;p.achievedGoalIds=['scooter','pet_house'];p.selectedGoalId='space_trip';
 await seed(page,p);await page.goto('/adult');
 await page.locator('.hold-button').focus();await page.keyboard.down('Enter');await page.clock.runFor(3100);await page.keyboard.up('Enter');
 await expect(page).toHaveURL(/\/adult\/dashboard$/);
 await expect(page.locator('.adult-results > *')).toHaveCount(10);
 await expect(page.locator('.adult-stats')).toContainText('20 / 20');
 await expect(page.locator('.adult-stats')).toContainText('60 / 60');
 await expect(page.locator('.adult-goals-completed > *')).toHaveCount(2);
 await expect(page.locator('.adult-results')).toContainText('День 1');
});
test("legacy save with missing lessons cannot finish the programme early",async({page})=>{
 const p=fixture(10,true);p.finaleSeen=true;p.completedTasks=p.completedTasks.filter(t=>!['T19','T20'].includes(t.taskId));
 await seed(page,p);await page.goto('/home');await expect(page).toHaveURL(/\/home$/);
 await page.getByRole('navigation').getByRole('link',{name:'Задания',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Осталось завершить истории',exact:true})).toBeVisible();
 await expect(page.locator('.task-list').first().locator('.task-list-card')).toHaveCount(20);
 await page.goto('/finale');await expect(page).toHaveURL(/\/home$/);
});
