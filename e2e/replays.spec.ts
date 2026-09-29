import {test,expect,type Page} from '@playwright/test';
import {createInitialProfile,startPeriod,closePeriod,confirmBudgetPlan,updateBudgetPlan,type GameProfile} from '../packages/shared/src';
import {programTasks,situations,dailySituations} from '../packages/content';
const now='2026-09-25T10:00:00.000Z';
function fixture(days:number){
 let p=createInitialProfile({id:'replay-ui',petId:'pet',petName:'Финни',playerNickname:'Гость',appearance:{species:'dog',colorVariant:'dalmatian'},now});p.selectedGoalId='scooter';
 for(let day=1;day<=days+1;day++){
 p=confirmBudgetPlan(updateBudgetPlan(startPeriod(p,{periodId:`d${day}`,transactionId:`i${day}`,income:100,startedAt:now}),{plannedMandatory:50,plannedOptional:30,plannedSavings:20},now),now);
 if(day<=days)p=closePeriod(p,now);
 }
 p.completedTasks=programTasks.filter(t=>t.day<=Math.max(1,days)).map(t=>({taskId:t.id,periodId:`d${t.day}`,successful:true,completedAt:now}));
 p.completedSituationIds=situations.filter(s=>Number(s.id.slice(1))<=Math.max(6,days*6)).map(s=>s.id);
 p.finaleSeen=true;
 for(let day=1;day<=Math.max(1,days);day++)p.transactions.push({id:`paid${day}`,source:`program-10:day-${day}:situations`,type:'EVENT_REWARD',category:'LEARNING',periodId:`d${day}`,amount:10,createdAt:now,metadata:{}});
 return p;
}
async function seed(page:Page,p:GameProfile){await page.clock.install({time:new Date(now)});await page.addInitScript(p=>{if(!localStorage.getItem('finni.game-profile'))localStorage.setItem('finni.game-profile',JSON.stringify(p));},p);}
const saved=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('finni.game-profile')!));
test('on day three a previous set pays only after six fresh answers; a second round pays again',async({page})=>{
 const p=fixture(2);await seed(page,p);await page.goto('/situations');await page.getByLabel('Выбери день').selectOption('2');
 for(let round=0;round<2;round++){
 await page.getByRole('button',{name:'Пройти ещё раз · +10 монет',exact:true}).click();
 for(const [i,id] of dailySituations(2).entries()){
 const s=situations.find(s=>s.id===id)!;
 await expect(page.getByRole('heading',{name:s.title,exact:true})).toBeVisible();
 await page.getByRole('button',{name:s.options[s.correct],exact:true}).click();
 if(i<5){
 await expect(page.getByRole('button',{name:'Забрать награду · +10 монет',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Здорово!',exact:true}).click();
 if(i===2)await page.reload();
 await page.getByRole('button',{name:'Следующая история →',exact:true}).click();
 }else{
 expect((await saved(page)).walletBalance).toBe(p.walletBalance+round*10);
 await page.getByRole('button',{name:'Забрать награду · +10 монет',exact:true}).click();
 expect((await saved(page)).walletBalance).toBe(p.walletBalance+(round+1)*10);
 await page.reload();
 await expect(page.getByRole('button',{name:'Забрать награду · +10 монет',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Пройти ещё раз · +10 монет',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'К Финни',exact:true})).toHaveAttribute('href','/home');
 await expect(page.locator('.situation-complete-navigation').getByRole('link')).toHaveCount(2);
 await page.getByRole('link',{name:'К ситуациям',exact:true}).click();
 await page.getByLabel('Выбери день').selectOption('2');
 }
 }
 }
 expect((await saved(page)).completedSituationIds).toEqual(p.completedSituationIds);
});
test('tasks repeat for coins after day ten but not before',async({page})=>{
 const early=fixture(9);await seed(page,early);await page.goto('/tasks/T01');await expect(page.getByText('Награда уже получена.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Пройти ещё раз · +10 монет',exact:true})).toHaveCount(0);
 const p=fixture(10);await page.evaluate(p=>localStorage.setItem('finni.game-profile',JSON.stringify(p)),p);await page.goto('/tasks');
 await expect(page.getByRole('heading',{name:'Повторяем и зарабатываем',exact:true})).toBeVisible();
 await page.locator('.task-list').first().getByRole('link').first().click();
 for(let round=0;round<2;round++){
 await page.getByRole('button',{name:'Пройти ещё раз · +10 монет',exact:true}).click();await page.reload();
 await page.getByRole('button',{name:'Игрушка · 30',exact:true}).click();
 await page.getByRole('button',{name:'Попробовать ещё раз',exact:true}).click();expect((await saved(page)).walletBalance).toBe(p.walletBalance+round*10);
 await page.getByRole('button',{name:'Обед · 20',exact:true}).click();
 await page.getByRole('button',{name:'Забрать награду · +10 монет',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Задание выполнено!',exact:true})).toBeVisible();
 expect((await saved(page)).walletBalance).toBe(p.walletBalance+(round+1)*10);
 }
 expect((await saved(page)).completedTasks).toHaveLength(20);
});
