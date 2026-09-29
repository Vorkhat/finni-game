import { test, expect, type Page } from "@playwright/test";
import { createInitialProfile, startPeriod, updateBudgetPlan, confirmBudgetPlan, closePeriod, type GameProfile } from "../packages/shared/src";
import { situations, programTasks } from "../packages/content";
const now = "2026-09-25T10:00:00.000Z";
function profile(active=true) {
  let p=createInitialProfile({id:"sound",petId:"pet",petName:"Финни",playerNickname:"Гость",appearance:{species:"dog",colorVariant:"dalmatian"},now}); p.selectedGoalId="scooter";
  if(active) p=confirmBudgetPlan(updateBudgetPlan(startPeriod(p,{periodId:"day1",transactionId:"income1",income:100,startedAt:now}),{plannedMandatory:50,plannedOptional:30,plannedSavings:20},now),now);
  return p;
}
async function setup(page:Page,p=profile()) {
  await page.clock.install({time:new Date(now)});
  await page.addInitScript(value=>{
    if(!localStorage.getItem("finni.game-profile")) localStorage.setItem("finni.game-profile",JSON.stringify(value));
    if(!localStorage.getItem("finni.preferences")) localStorage.setItem("finni.preferences",JSON.stringify({sound:true,animations:false}));
    const audit=(window as any).audioAudit={effects:[] as string[],playing:[] as string[],errors:[] as string[],clicks:0};
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){audit.effects.push((this.src.split("/").pop() ?? ""));return play.call(this).then(()=>{audit.playing.push((this.src.split("/").pop() ?? ""));},error=>{audit.errors.push(String(error));throw error;});};
    const create=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){audit.clicks++;return create.call(this);};
  },p);
}
const reset=(page:Page)=>page.evaluate(()=>{const a=(window as any).audioAudit;a.effects=[];a.playing=[];a.errors=[];a.clicks=0;});
const audit=(page:Page)=>page.evaluate(()=>(window as any).audioAudit);
async function only(page:Page,sound:string) {
  await expect.poll(async()=>(await audit(page)).playing).toEqual([sound+".mp3"]);
  expect((await audit(page)).effects).toEqual([sound+".mp3"]);expect((await audit(page)).clicks).toBe(0);expect((await audit(page)).errors).toEqual([]);
}
test("answers and reward replace click; purchases play coins; settings mute all",async({page})=>{
  await setup(page);await page.goto("/tasks/T01");
  await page.getByRole("button",{name:"Игрушка · 30",exact:true}).click();await only(page,"incorrect");
  await page.getByRole("button",{name:"Попробовать ещё раз",exact:true}).click();await reset(page);
  await page.getByRole("button",{name:"Обед · 20",exact:true}).click();await only(page,"correct");await reset(page);
  await page.getByRole("button",{name:"Забрать награду · +10 монет",exact:true}).click();await only(page,"coins");
  await page.goto("/shop");await page.getByRole("button",{name:"Купить: Завтрак",exact:true}).click();await reset(page);
  await page.getByRole("dialog").getByRole("button",{name:"Купить",exact:true}).click();
  await expect(page.getByText("Покупка у Финни!",{exact:true})).toBeVisible();await only(page,"coins");
  await page.goto("/settings");await page.getByRole("switch",{name:/Звук/}).uncheck();await page.goto("/situations/S01");
  await page.getByRole("button",{name:"Дешёвую игрушку",exact:true}).click();expect((await audit(page)).effects).toEqual([]);expect((await audit(page)).clicks).toBe(0);
  await page.getByRole("button",{name:"Попробовать ещё раз",exact:true}).click();expect((await audit(page)).clicks).toBe(0);
});
test("new day and growing play milestone once with no click layer",async({page})=>{
  await setup(page,profile(false));await page.goto("/home");await page.locator(".home-context-card").getByRole("button",{name:"Начать день",exact:true}).click();await only(page,"milestone");await reset(page);await page.getByRole("button",{name:"Составить план",exact:true}).click();expect((await audit(page)).effects).toEqual([]);
  let p=profile(false);
  for(let day=1;day<=4;day++) {p=closePeriod(confirmBudgetPlan(updateBudgetPlan(startPeriod(p,{periodId:`d${day}`,transactionId:`i${day}`,income:100,startedAt:now}),{plannedMandatory:50,plannedOptional:30,plannedSavings:20},now),now),now);}
  await page.evaluate(value=>localStorage.setItem("finni.game-profile",JSON.stringify(value)),p);
  await page.goto("/day/result");await page.getByRole("link",{name:"Следующий день",exact:true}).click();await only(page,"milestone");
});
test("sixth situation grants coins only on explicit claim",async({page})=>{
  const p=profile();p.completedSituationIds=["S01","S02","S03","S04","S05"];
  await setup(page,p);await page.goto("/situations/S06");const s=situations.find(s=>s.id==="S06")!;
  await page.getByRole("button",{name:s.options[s.correct],exact:true}).click();
  await only(page,"correct");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("finni.game-profile")!).walletBalance)).toBe(100);
  await reset(page);await page.getByRole("button",{name:"Забрать награду · +10 монет",exact:true}).click();await only(page,"coins");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("finni.game-profile")!).walletBalance)).toBe(110);
  expect((await audit(page)).clicks).toBe(0);expect((await audit(page)).errors).toEqual([]);
});

test("savings plays coins then achieved dream plays milestone; finale celebrates",async({page})=>{
 const p=profile();p.savingsBalance=190;
 await setup(page,p);await page.goto('/savings');
 await page.getByRole('button',{name:'Отложить монетки',exact:true}).click();
 await page.getByRole('button',{name:'+10',exact:true}).click();
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();await reset(page);
 await page.getByRole('button',{name:'Отложить',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Мечта сбылась! 🎉',exact:true})).toBeVisible();
 await expect.poll(async()=>(await audit(page)).playing).toEqual(['coins.mp3','milestone.mp3']);
 expect((await audit(page)).effects).toEqual(['coins.mp3','milestone.mp3']);expect((await audit(page)).clicks).toBe(0);
 let done=profile(false);
 for(let day=1;day<=10;day++)done=closePeriod(confirmBudgetPlan(updateBudgetPlan(startPeriod(done,{periodId:`d${day}`,transactionId:`i${day}`,income:100,startedAt:now}),{plannedMandatory:50,plannedOptional:30,plannedSavings:20},now),now),now);
 done.completedTasks=programTasks.map(t=>({taskId:t.id,periodId:`d${t.day}`,successful:true,completedAt:now}));done.completedSituationIds=situations.map(s=>s.id);done.finaleSeen=true;
 await page.evaluate(value=>localStorage.setItem('finni.game-profile',JSON.stringify(value)),done);
 await page.goto('/progress');await reset(page);await page.getByRole('link',{name:'Праздник нашей дружбы',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Вы выросли вместе! ✨',exact:true})).toBeVisible();await only(page,'milestone');
});

test("savings deposit plays supplied coins without a click",async({page})=>{
 await setup(page);await page.goto('/savings');
 await page.getByRole('button',{name:'Отложить монетки',exact:true}).click();
 await page.getByRole('button',{name:'+10',exact:true}).click();
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();await reset(page);
 await page.getByRole('button',{name:'Отложить',exact:true}).click();await only(page,'coins');
});
