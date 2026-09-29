import { situations, situationDay } from "@finni/content";

/** Unlocked when its day is reached AND the previous situation is solved (first is always open). */
export function isUnlocked(
  index: number,
  done: string[],
  currentDay: number,
): boolean {
  if (!situations[index] || situationDay(situations[index]!.id) > currentDay)
    return false;
  return index === 0 || situationDay(situations[index - 1]!.id) !== situationDay(situations[index]!.id) || done.includes(situations[index - 1]!.id);
}
