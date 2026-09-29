import { test, expect } from '@playwright/test';
import { createInitialProfile, startPeriod, confirmBudgetPlan, updateBudgetPlan } from '../packages/shared/src';

for (const [name, feeding, owner] of [['Гаврик', 'Гаврика', 'Гаврика'], ['Кузя', 'Кузю', 'Кузи'], ['Zz-42', 'питомца', 'питомца']]) {
  test(`pet name ${name} is preserved and used in the daily routine and shop`, async ({ page }) => {
    const now = new Date().toISOString();
    let p = createInitialProfile({id:'name-ui', petId:'pet', petName:name!, playerNickname:'Гость', appearance:{species:'dog', colorVariant:'dalmatian'}, now});
    p.selectedGoalId = 'scooter';
    p = confirmBudgetPlan(updateBudgetPlan(startPeriod(p, {periodId:'d1', transactionId:'i1', income:100, startedAt:now}), {plannedMandatory:50, plannedOptional:30, plannedSavings:20}, now), now);
    await page.addInitScript(p => {if(!localStorage.getItem('finni.game-profile')) localStorage.setItem('finni.game-profile', JSON.stringify(p));}, p);
    await page.goto('/home');
    await expect(page.getByText(name!, {exact:true}).first()).toBeVisible();
    await page.getByRole('button', {name:'План на день 1', exact:true}).click();
    await expect(page.getByRole('link', {name:`Покормить ${feeding}`, exact:true})).toBeVisible();
    await page.getByRole('link', {name:`Покормить ${feeding}`, exact:true}).click();
    await expect(page.getByRole('heading', {name:`Что выберем для ${owner}?`, exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', {name:`Что выберем для ${owner}?`, exact:true})).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('finni.game-profile')!).pet.name)).toBe(name);
  });
}
