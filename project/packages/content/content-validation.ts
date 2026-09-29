import { z } from "zod";
import type { ProgramTask } from "@finni/shared";

const id = z.string().trim().min(1);
export const ProgramScheduleSchema = z.object({
  days: z.array(z.object({
    day: z.number().int().min(1).max(10),
    tasks: z.array(z.string().regex(/^T\d{2}$/)).length(2),
    situations: z.array(z.string().regex(/^S\d{2}$/)).length(6),
    levels: z.array(id).min(1),
    taskRewardTotal: z.number().int().nonnegative(),
    situationsBundleReward: z.number().int().nonnegative(),
  })).length(10),
  stageBlocks: z.array(z.object({ level: z.number().int(), label: id, from: id, to: id })),
  transitions: z.array(z.object({ day: z.number().int(), beforeSituation: id })),
});

export const ProgramSituationMetaSchema = z.object({
  id: z.string().regex(/^S\d{2}$/),
  day: z.number().int().min(1).max(10),
  slot: z.number().int().min(1).max(6),
}).passthrough();

export const PeriodContentSchema = z.object({
  taskIds: z.array(id),
  dailyTasks: z.record(z.object({ stories: z.array(id), situations: z.array(id) })),
  events: z.record(id),
  mandatoryNeeds: z.array(z.object({ id, purchaseIds: z.array(id) })).min(1),
  extraCareNeed: z.object({ id, purchaseIds: z.array(id) }),
}).passthrough();

export const InterfaceContentSchema = z.object({
  welcome: z.record(z.unknown()),
  concepts: z.array(z.unknown()).min(1),
  stages: z.record(z.unknown()),
  status: z.array(z.unknown()).min(1),
  navigation: z.array(z.unknown()).min(1),
  sections: z.record(z.unknown()),
});

export function validateProgramRelations(
  days: z.infer<typeof ProgramScheduleSchema>["days"],
  tasks: ProgramTask[],
  situations: z.infer<typeof ProgramSituationMetaSchema>[],
): void {
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
  };
  unique(tasks.map((task) => task.id), "task ID");
  unique(situations.map((situation) => situation.id), "situation ID");
  unique(days.map((day) => String(day.day)), "schedule day");
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const situationById = new Map(situations.map((situation) => [situation.id, situation]));
  const scheduledTasks: string[] = [];
  const scheduledSituations: string[] = [];
  for (const day of days) {
    day.tasks.forEach((taskId, slot) => {
      const task = taskById.get(taskId);
      if (!task || task.day !== day.day || task.slot !== slot + 1)
        throw new Error(`Invalid task reference ${taskId} on day ${day.day}`);
      scheduledTasks.push(taskId);
    });
    day.situations.forEach((situationId, slot) => {
      const situation = situationById.get(situationId);
      if (!situation || situation.day !== day.day || situation.slot !== slot + 1)
        throw new Error(`Invalid situation reference ${situationId} on day ${day.day}`);
      scheduledSituations.push(situationId);
    });
  }
  unique(scheduledTasks, "scheduled task");
  unique(scheduledSituations, "scheduled situation");
  if (scheduledTasks.length !== tasks.length || scheduledSituations.length !== situations.length)
    throw new Error("Programme contains unscheduled content");
}
