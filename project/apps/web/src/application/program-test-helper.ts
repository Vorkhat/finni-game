import { programDailyTasks, dailySituations, situations } from "@finni/content";
import { programTestAnswers } from "../../../../packages/content/program-test-answers";
import type { GameService } from "./game-service";
export async function completeProgramDay(service: GameService, now: string) {
  for (const task of programDailyTasks(service.getState()!.currentPeriod!.index))
    await service.completeProgramTask(task.id, programTestAnswers[task.id]!, `reward:${task.id}`, now);
  for (const id of dailySituations(service.getState()!.currentPeriod!.index)) {
    const situation = situations.find(s => s.id === id)!;
    await service.completeSituation(id, situation.correct, now);
  }
  await service.claimSituationReward(service.getState()!.currentPeriod!.index, now);
}
