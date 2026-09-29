import {
  ProgramTaskSchema,
  FeedbackDefinitionSchema,
  EconomyConfigSchema,
  DecisionEventDefinitionSchema,
  GlossaryEntrySchema,
  InteractiveLearningTaskDefinitionSchema,
  PurchaseDefinitionSchema,
  SavingsGoalDefinitionSchema,
  SituationDefinitionSchema,
} from "@finni/shared";
import rawEvents from "./events.json";
import rawFeedback from "./feedback.json";
import rawGlossary from "./glossary.json";
import rawGoals from "./goals.json";
import rawPurchases from "./purchases.json";
import rawTasks from "./tasks.json";
import rawSituations from "./program-situations.json";
import rawProgramTasks from "./program-tasks.json";
import schedule from "./program-schedule.json";
import { InterfaceContentSchema, PeriodContentSchema, ProgramScheduleSchema, ProgramSituationMetaSchema, validateProgramRelations } from "./content-validation";
export const programTasks = ProgramTaskSchema.array().parse(rawProgramTasks);
const checkedSchedule = ProgramScheduleSchema.parse(schedule);
const checkedSituations = ProgramSituationMetaSchema.array().parse(rawSituations);
validateProgramRelations(checkedSchedule.days, programTasks, checkedSituations);
export const programSchedule = checkedSchedule.days;
export function programDailyTasks(day: number) {
  return programTasks.filter((task) => task.day === day);
}
import rawEconomy from "./economy.json";
import periodContent from "./periods.json";
PeriodContentSchema.parse(periodContent);
export { periodContent };
export function periodEventId(index: number): string | undefined {
  return periodContent.events[
    String(index) as keyof typeof periodContent.events
  ];
}
export function periodNeeds(_index: number) {
  return periodContent.mandatoryNeeds;
}
const dailyPlan = periodContent.dailyTasks as Record<
  string,
  { stories: string[]; situations: string[] }
>;
export function dailyStories(day: number): string[] {
  const sequence = [
    "assemble-budget",
    "needs-first",
    "fit-the-budget",
    "plan-changed",
    "save-for-scooter",
    "dream-or-now",
  ];
  return [sequence[(Math.max(1, day) - 1) % sequence.length]!];
}
export function dailySituations(day: number): string[] {
  return schedule.days.find((entry) => entry.day === day)?.situations ?? [];
}
export function situationDay(id: string): number {
  return rawSituations.find((situation) => situation.id === id)?.day ?? 1;
}
export const economyConfig = EconomyConfigSchema.parse(rawEconomy);
import rawInterface from "./interface.json";
InterfaceContentSchema.parse(rawInterface);
export const interfaceContent = rawInterface;

export const purchases = PurchaseDefinitionSchema.required({ assetId: true })
  .array()
  .parse(rawPurchases);
export const goals = SavingsGoalDefinitionSchema.required({
  assetId: true,
  description: true,
})
  .array()
  .parse(rawGoals);
export const tasks =
  InteractiveLearningTaskDefinitionSchema.array().parse(rawTasks);
export const situations = SituationDefinitionSchema.array().parse(
  rawSituations.map(
    ({
      id,
      group,
      title,
      question,
      hero,
      options,
      icons,
      correct,
      explanation,
      theme,
      hint,
      feedback,
    }) => ({
      id,
      group,
      title,
      question,
      hero,
      options,
      icons,
      correct,
      explanation,
      theme,
      hint,
      feedback,
    }),
  ),
);
export const events = DecisionEventDefinitionSchema.array().parse(rawEvents);
export const feedback = FeedbackDefinitionSchema.array().parse(rawFeedback);
export const glossary = GlossaryEntrySchema.array().parse(rawGlossary);

export function profileGoals(profile?: Pick<import("@finni/shared").GameProfile, "customGoals"> | null) {
  return [...goals, ...(profile?.customGoals ?? [])];
}

export function programCompletion(profile: import("@finni/shared").GameProfile) {
  const tasks = programTasks.filter(t => !profile.completedTasks.some(r => r.taskId === t.id && r.successful));
  const pendingSituations = situations.filter(s => !profile.completedSituationIds.includes(s.id));
  return {tasks, situations: pendingSituations, complete: profile.periodHistory.length >= 10 && tasks.length === 0 && pendingSituations.length === 0};
}
