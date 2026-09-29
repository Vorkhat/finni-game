import type {
  GameProfile,
  SavingsGoalDefinition,
  Transaction,
} from "./schemas";
import { calculateBudgetActual } from "./economy";

export const DAY_DURATION_MS = 30 * 60 * 1000;
export type DailyCare = "feed" | "play" | "care";

export function dayProgress(
  profile: GameProfile,
  now: string,
  taskId?: string | string[],
  situationIds: string[] = [],
) {
  const p = profile.currentPeriod;
  const elapsed = p
    ? Math.max(0, Date.parse(now) - Date.parse(p.startedAt))
    : 0;
  const bought = (ids: string[]) =>
    p?.transactions.some(
      (t) =>
        ["PURCHASE_MANDATORY", "PURCHASE_OPTIONAL", "EVENT_EXPENSE"].includes(
          t.type,
        ) && ids.includes(String(t.metadata.purchaseId)),
    );
  const feed = !!bought(["breakfast", "lunch", "snack"]);
  const play = !!bought(["ball", "toy", "game", "balloon"]);
  const care = !!bought(["care"]);
  const task = Array.isArray(taskId)
    ? taskId.every((id) =>
        profile.completedTasks.some((t) => t.successful && t.taskId === id),
      )
    : !!p?.taskResults.some(
        (t) => t.successful && (!taskId || t.taskId === taskId),
      );
  const situations = situationIds.every((id) =>
    profile.completedSituationIds.includes(id),
  );
  const redNeeds = (
    Object.keys(profile.pet.state) as (keyof GameProfile["pet"]["state"])[]
  ).filter((key) => profile.pet.state[key] <= 20);
  const remainingMs = Math.max(0, DAY_DURATION_MS - elapsed);
  return {
    feed,
    play,
    care,
    task,
    situations,
    redNeeds,
    remainingMs,
    ready:
      p?.status === "ACTIVE" &&
      remainingMs === 0 &&
      feed &&
      task &&
      situations &&
      redNeeds.length === 0,
  };
}

/** Real-time needs continue across closed days and offline sessions. */
export function advancePetNeeds(
  profile: GameProfile,
  now: string,
): GameProfile {
  const halfHour = 30 * 60 * 1000;
  const period = profile.currentPeriod;
  // Legacy saves already paid for needsDecaySteps; do not charge those twice.
  const legacyStart = period
    ? Date.parse(period.budgetPlan?.confirmedAt ?? period.startedAt) +
      (period.needsDecaySteps ?? 0) * halfHour
    : Date.parse(profile.updatedAt);
  const anchor = profile.needsUpdatedAt
    ? Date.parse(profile.needsUpdatedAt)
    : legacyStart;
  const steps = Math.max(0, Math.floor((Date.parse(now) - anchor) / halfHour));
  if (!steps) return profile;
  const lower = (value: number, rate: number) =>
    Math.min(value, Math.max(20, value - steps * rate));
  return {
    ...profile,
    updatedAt: now,
    needsUpdatedAt: new Date(anchor + steps * halfHour).toISOString(),
    pet: {
      ...profile.pet,
      state: {
        satiety: lower(profile.pet.state.satiety, 4),
        mood: lower(profile.pet.state.mood, 3),
        care: lower(profile.pet.state.care, 2),
      },
    },
  };
}

/** Settle the old dream atomically when selecting a different one, including legacy saves. */
export function changeSavingsGoal(
  profile: GameProfile,
  goalId: string,
  oldGoal: SavingsGoalDefinition | undefined,
  now: string,
): GameProfile {
  if (profile.selectedGoalId === goalId) return profile;
  const cost =
    oldGoal && profile.savingsBalance >= oldGoal.cost ? oldGoal.cost : 0;
  const returned = profile.savingsBalance - cost;
  const periodId =
    profile.currentPeriod?.id ??
    profile.periodHistory.at(-1)?.id ??
    `goal:${profile.id}`;
  const entries: Transaction[] = [];
  for (const [type, amount] of [
    ["GOAL_PURCHASE", cost],
    ["GOAL_CHANGE_RETURN", returned],
  ] as const) {
    if (amount)
      entries.push({
        id: `${type}:${profile.id}:${profile.transactions.length}:${goalId}`,
        type,
        amount,
        source: `goal:${oldGoal?.id ?? "unassigned"}`,
        category: "SAVINGS",
        periodId,
        createdAt: now,
        metadata: { goalId: oldGoal?.id, nextGoalId: goalId },
      });
  }
  const walletBalance = profile.walletBalance + returned;
  const current = profile.currentPeriod;
  const transactions = current ? [...current.transactions, ...entries] : [];
  return {
    ...profile,
    selectedGoalId: goalId,
    savingsBalance: 0,
    walletBalance,
    updatedAt: now,
    achievedGoalIds:
      cost && oldGoal
        ? [...new Set([...profile.achievedGoalIds, oldGoal.id])]
        : profile.achievedGoalIds,
    transactions: [...profile.transactions, ...entries],
    currentPeriod: current
      ? {
          ...current,
          transactions,
          budgetActual: calculateBudgetActual(transactions, walletBalance),
        }
      : null,
  };
}
