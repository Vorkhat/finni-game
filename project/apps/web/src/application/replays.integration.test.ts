import {expect,it} from 'vitest';
import {createInitialProfile,startPeriod,closePeriod,confirmBudgetPlan,updateBudgetPlan,GameProfileSchema} from '@finni/shared';
import {dailySituations,situations} from '@finni/content';
import {GameService} from './game-service';
import {MemoryStorageAdapter} from './storage';
const now='2026-09-25T10:00:00.000Z';
async function setup(closed=0){
 const storage=new MemoryStorageAdapter();
 let p=createInitialProfile({id:'repeat',petId:'pet',petName:'Финни',playerNickname:'Игрок',appearance:{species:'dog',colorVariant:'dalmatian'},now});
 p.selectedGoalId='scooter';
 for(let day=1;day<=closed+1;day++){
 p=confirmBudgetPlan(updateBudgetPlan(startPeriod(p,{periodId:`d${day}`,transactionId:`i${day}`,income:100,startedAt:now}),{plannedMandatory:50,plannedOptional:30,plannedSavings:20},now),now);
 if(day<=closed)p=closePeriod(p,now);
 }
 p.finaleSeen=true;
 await storage.saveProfile(p);const game=new GameService(storage);await game.loadGame();return {game,storage};
}
async function solve(game:GameService,id:string,round?:string){const s=situations.find(s=>s.id===id)!;return game.completeSituation(id,s.correct,now,round);}
it('requires six new distinct solutions for every replay reward, resumes on reload, and never inflates learning progress',async()=>{
 let {game,storage}=await setup();
 for(const id of dailySituations(1))await solve(game,id);
 await game.claimSituationReward(1,now);
 const before=structuredClone(game.getState()!);
 await expect(game.startSituationReplay(2,'locked',now)).rejects.toThrow('INVALID_TASK_ACTION');
 for(const round of ['round1','round2']){
 await game.startSituationReplay(1,round,now);
 await expect(solve(game,'S06',round)).rejects.toThrow('INVALID_TASK_ACTION');
 await solve(game,'S01',round);await solve(game,'S01',round);
 await expect(game.claimSituationReward(1,now,round)).rejects.toThrow('INVALID_TASK_ACTION');
 await game.startSituationReplay(1,'accidental-second-start',now);
 expect(game.getState()!.situationReplays[1]!.id).toBe(round);
 game=new GameService(storage);await game.loadGame();
 expect(game.getState()!.situationReplays[1]!.completedIds).toEqual(['S01']);
 for(const id of dailySituations(1).slice(1))await solve(game,id,round);
 await game.claimSituationReward(1,now,round);const wallet=game.getState()!.walletBalance;
 await game.claimSituationReward(1,now,round);expect(game.getState()!.walletBalance).toBe(wallet);
 }
 expect(game.getState()!.walletBalance).toBe(before.walletBalance+20);
 expect(game.getState()!.completedSituationIds).toEqual(before.completedSituationIds);
 expect(game.getState()!.learningProgress).toEqual(before.learningProgress);
 expect(game.getState()!.pet.progress).toEqual(before.pet.progress);
 await expect(game.claimSituationReward(1,now,'round1')).rejects.toThrow('INVALID_TASK_ACTION');
});
it('task repeats unlock only after ten closed days, need a fresh correct answer and pay once per attempt',async()=>{
 for(const days of [9,10]){
 const {game,storage}=await setup(days);await game.completeProgramTask('T01',{choice:'food'},'first',now);
 if(days===9){await expect(game.startTaskReplay('T01','r',now)).rejects.toThrow('INVALID_TASK_ACTION');continue;}
 const before=structuredClone(game.getState()!);
 await game.startTaskReplay('T01','r',now);
 await expect(game.completeProgramTask('T01',{},'bad',now,'r')).rejects.toThrow('TASK_NOT_SUCCESSFUL');
 const reloaded=new GameService(storage);await reloaded.loadGame();
 await reloaded.completeProgramTask('T01',{choice:'food'},'second',now,'r');
 await reloaded.completeProgramTask('T01',{choice:'food'},'double',now,'r');
 expect(reloaded.getState()!.walletBalance).toBe(before.walletBalance+10);
 expect(reloaded.getState()!.completedTasks).toEqual(before.completedTasks);
 expect(reloaded.getState()!.learningProgress).toEqual(before.learningProgress);
 await reloaded.startTaskReplay('T01','r2',now);await reloaded.completeProgramTask('T01',{choice:'food'},'third',now,'r2');
 expect(reloaded.getState()!.walletBalance).toBe(before.walletBalance+20);
 }
});
it('old saves get empty replay progress without losing achievements',async()=>{
 const {game}=await setup();const raw=JSON.parse(JSON.stringify(game.getState()));delete raw.taskReplays;delete raw.situationReplays;
 const migrated=GameProfileSchema.parse(raw);expect(migrated.taskReplays).toEqual({});expect(migrated.situationReplays).toEqual({});expect(migrated.walletBalance).toBe(raw.walletBalance);
});
