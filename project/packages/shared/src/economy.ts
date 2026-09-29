import {
  GameProfileSchema,
  PetNameSchema,
  PurchaseDefinitionSchema,
  TaskSubmissionSchema,
  type TaskSubmission,
  type InteractiveLearningTaskDefinition,
  SCHEMA_VERSION,
  type BudgetActual,
  type BudgetPlan,
  type DomainErrorCode,
  type GameEventDefinition,
  type GamePeriod,
  type GameProfile,
  type LearningProgress,
  type LearningTaskDefinition,
  type PetAppearance,
  type PetStage,
  type PeriodResult,
  type PlanVsActual,
  type PurchaseDefinition,
  type SavingsGoalDefinition,
  type Transaction,
} from "./schemas";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

const emptyActual = (remainingBalance = 0): BudgetActual => ({
  spentMandatory: 0,
  spentOptional: 0,
  savedActual: 0,
  earnedExtra: 0,
  remainingBalance,
});
const emptyLearningProgress = (): LearningProgress => ({
  BUDGET_PLANNING: {
    completedTasks: 0,
    attempts: 0,
    successfulDecisions: 0,
    experiencedConsequences: 0,
  },
  SAVINGS: {
    completedTasks: 0,
    attempts: 0,
    successfulDecisions: 0,
    experiencedConsequences: 0,
  },
  PAYMENTS_AND_PURCHASES: {
    completedTasks: 0,
    attempts: 0,
    successfulDecisions: 0,
    experiencedConsequences: 0,
  },
});
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const activePeriod = (profile: GameProfile): GamePeriod => {
  if (!profile.currentPeriod || profile.currentPeriod.status !== "ACTIVE")
    throw new DomainError("NO_ACTIVE_PERIOD");
  return profile.currentPeriod;
};
const openPeriod = (profile: GameProfile): GamePeriod => {
  if (!profile.currentPeriod || profile.currentPeriod.status === "COMPLETED")
    throw new DomainError("NO_ACTIVE_PERIOD");
  return profile.currentPeriod;
};
const withPeriod = (
  profile: GameProfile,
  currentPeriod: GamePeriod,
  updatedAt: string,
): GameProfile => ({ ...profile, currentPeriod, updatedAt });
const appendTransaction = (
  profile: GameProfile,
  period: GamePeriod,
  transaction: Transaction,
  walletBalance: number,
  savingsBalance: number,
): GameProfile => {
  if (profile.transactions.some((item) => item.id === transaction.id))
    throw new DomainError("DUPLICATE_ACTION");
  if (walletBalance < 0 || savingsBalance < 0)
    throw new DomainError("INSUFFICIENT_FUNDS");
  const transactions = [...period.transactions, transaction];
  return {
    ...profile,
    walletBalance,
    savingsBalance,
    transactions: [...profile.transactions, transaction],
    updatedAt: transaction.createdAt,
    currentPeriod: {
      ...period,
      transactions,
      budgetActual: calculateBudgetActual(transactions, walletBalance),
    },
  };
};

export interface CreateProfileCommand {
  id: string;
  playerNickname: string;
  petId: string;
  petName: string;
  appearance: PetAppearance;
  now: string;
  demoMode?: boolean;
}
export function createInitialProfile(
  command: CreateProfileCommand,
): GameProfile {
  const name = PetNameSchema.safeParse(command.petName);
  if (!name.success) throw new DomainError("INVALID_PET_NAME");
  return GameProfileSchema.parse({
    id: command.id,
    playerNickname: command.playerNickname,
    pet: {
      id: command.petId,
      name: name.data,
      species: command.appearance.species,
      appearance: command.appearance,
      state: { satiety: 70, mood: 70, care: 70 },
      stage: "BABY",
      progress: {
        mandatoryCare: 0,
        planDiscipline: 0,
        savings: 0,
        learning: 0,
        completedPeriods: 0,
      },
    },
    walletBalance: 0,
    savingsBalance: 0,
    selectedGoalId: null,
    currentPeriod: null,
    periodHistory: [],
    transactions: [],
    completedTasks: [],
    learningProgress: emptyLearningProgress(),
    demoMode: command.demoMode ?? false,
    needsUpdatedAt: command.now,
    createdAt: command.now,
    updatedAt: command.now,
    schemaVersion: SCHEMA_VERSION,
  });
}
export function createDemoProfile(): GameProfile {
  return createInitialProfile({
    id: "demo-profile",
    playerNickname: "Гость",
    petId: "demo-pet",
    petName: "Финни",
    appearance: {
      species: "cat",
      colorVariant: "ginger",
      accessoryVariant: "green-scarf",
    },
    now: "2026-01-01T00:00:00.000Z",
    demoMode: true,
  });
}
export function resetDemoProfile(): GameProfile {
  return createDemoProfile();
}
export function migrateProfile(rawProfile: unknown): GameProfile {
  if (rawProfile && typeof rawProfile === "object" && "schemaVersion" in rawProfile) {
    const version = (rawProfile as { schemaVersion?: unknown }).schemaVersion;
    if (typeof version === "number" && version > SCHEMA_VERSION)
      throw new DomainError("UNSUPPORTED_PROFILE_VERSION");
  }
  try {
    if (!rawProfile || typeof rawProfile !== "object") throw new Error();
    const raw = rawProfile as Record<string, unknown>;
    // V1 had no snapshots or presentation acknowledgements. Schema defaults
    // preserve old results without inventing historical pet state or replaying evolution.
    if (
      raw.schemaVersion !== undefined &&
      raw.schemaVersion !== 1 &&
      raw.schemaVersion !== SCHEMA_VERSION
    )
      throw new Error();
    const profile = GameProfileSchema.parse({
      ...raw,
      schemaVersion: SCHEMA_VERSION,
    });
    const current = profile.currentPeriod;
    const periods = [...profile.periodHistory, ...(current ? [current] : [])];
    const invalidPlan = periods.some((period) => period.budgetPlan &&
      period.budgetPlan.plannedMandatory + period.budgetPlan.plannedOptional +
      period.budgetPlan.plannedSavings + period.budgetPlan.unallocated !== period.income);
    const credited = profile.transactions
      .filter((transaction) => ["PERIOD_INCOME", "TASK_REWARD", "EVENT_REWARD", "GOAL_CHANGE_RETURN", "SAVINGS_WITHDRAWAL"].includes(transaction.type))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    if (
      invalidPlan ||
      profile.walletBalance + profile.savingsBalance > credited ||
      profile.pet.species !== profile.pet.appearance.species ||
      (current &&
        (current.status === "COMPLETED" ||
          (current.status === "ACTIVE" && !current.budgetPlan?.confirmed))) ||
      profile.periodHistory.some(
        (p) => p.status !== "COMPLETED" || !p.periodResult,
      ) ||
      new Set(profile.transactions.map((t) => t.id)).size !==
        profile.transactions.length
    )
      throw new Error();
    return profile;
  } catch {
    throw new DomainError("INVALID_PROFILE");
  }
}

export interface StartPeriodCommand {
  mandatoryNeeds?: GamePeriod["mandatoryNeeds"];
  periodId: string;
  income: number;
  startedAt: string;
  transactionId: string;
}
export function startPeriod(
  profile: GameProfile,
  command: StartPeriodCommand,
): GameProfile {
  if (profile.currentPeriod)
    throw new DomainError("NO_ACTIVE_PERIOD", "A period is already open");
  if (
    profile.periodHistory.some((p) => p.id === command.periodId) ||
    profile.transactions.some((t) => t.id === command.transactionId)
  )
    throw new DomainError("DUPLICATE_ACTION");
  if (!Number.isInteger(command.income) || command.income <= 0)
    throw new DomainError("INVALID_BUDGET");
  const transaction: Transaction = {
    id: command.transactionId,
    type: "PERIOD_INCOME",
    amount: command.income,
    source: "period_income",
    category: "INCOME",
    periodId: command.periodId,
    createdAt: command.startedAt,
    metadata: {},
  };
  const currentPeriod: GamePeriod = {
    mandatoryNeeds: command.mandatoryNeeds ?? [],
    eventDecisions: [],
    evolutionSeen: true,
    id: command.periodId,
    index: profile.periodHistory.length + 1,
    status: "PLANNING",
    income: command.income,
    budgetPlan: null,
    budgetActual: emptyActual(profile.walletBalance + command.income),
    transactions: [transaction],
    taskResults: [],
    startedAt: command.startedAt,
    completedAt: null,
    periodResult: null,
  };
  return {
    ...profile,
    walletBalance: profile.walletBalance + command.income,
    currentPeriod,
    transactions: [...profile.transactions, transaction],
    updatedAt: command.startedAt,
  };
}

export function validateBudgetPlan(
  income: number,
  values: Pick<
    BudgetPlan,
    "plannedMandatory" | "plannedOptional" | "plannedSavings"
  >,
): boolean {
  const allocations = [
    values.plannedMandatory,
    values.plannedOptional,
    values.plannedSavings,
  ];
  return (
    Number.isInteger(income) &&
    income >= 0 &&
    allocations.every((value) => Number.isInteger(value) && value >= 0) &&
    allocations.reduce((sum, value) => sum + value, 0) <= income
  );
}
export function createBudgetPlan(
  income: number,
  values: Pick<
    BudgetPlan,
    "plannedMandatory" | "plannedOptional" | "plannedSavings"
  >,
): BudgetPlan {
  if (!validateBudgetPlan(income, values))
    throw new DomainError("INVALID_BUDGET");
  return {
    ...values,
    unallocated:
      income -
      values.plannedMandatory -
      values.plannedOptional -
      values.plannedSavings,
    confirmed: false,
    confirmedAt: null,
  };
}
export function updateBudgetPlan(
  profile: GameProfile,
  values: Pick<
    BudgetPlan,
    "plannedMandatory" | "plannedOptional" | "plannedSavings"
  >,
  updatedAt: string,
): GameProfile {
  const period = openPeriod(profile);
  if (period.budgetPlan?.confirmed)
    throw new DomainError("BUDGET_ALREADY_CONFIRMED");
  return withPeriod(
    profile,
    { ...period, budgetPlan: createBudgetPlan(period.income, values) },
    updatedAt,
  );
}
export function confirmBudgetPlan(
  profile: GameProfile,
  confirmedAt: string,
): GameProfile {
  const period = openPeriod(profile);
  if (!period.budgetPlan) throw new DomainError("INVALID_BUDGET");
  if (period.budgetPlan.confirmed)
    throw new DomainError("BUDGET_ALREADY_CONFIRMED");
  return withPeriod(
    profile,
    {
      ...period,
      status: "ACTIVE",
      budgetPlan: { ...period.budgetPlan, confirmed: true, confirmedAt },
    },
    confirmedAt,
  );
}

export function canPurchase(
  profile: GameProfile,
  purchase: PurchaseDefinition,
): boolean {
  return (
    profile.currentPeriod?.status === "ACTIVE" &&
    purchase.price <= profile.walletBalance
  );
}
export function executePurchase(
  profile: GameProfile,
  purchase: PurchaseDefinition,
  command: { transactionId: string; createdAt: string },
): GameProfile {
  purchase = PurchaseDefinitionSchema.parse(purchase);
  const period = activePeriod(profile);
  if (!canPurchase(profile, purchase))
    throw new DomainError("INSUFFICIENT_FUNDS");
  const mandatory = purchase.kind === "mandatory";
  const transaction: Transaction = {
    id: command.transactionId,
    type: mandatory ? "PURCHASE_MANDATORY" : "PURCHASE_OPTIONAL",
    amount: purchase.price,
    source: `purchase:${purchase.id}`,
    category: mandatory ? "MANDATORY" : "OPTIONAL",
    periodId: period.id,
    createdAt: command.createdAt,
    metadata: { purchaseId: purchase.id },
  };
  const next = appendTransaction(
    profile,
    period,
    transaction,
    profile.walletBalance - purchase.price,
    profile.savingsBalance,
  );
  return {
    ...next,
    pet: {
      ...next.pet,
      state: {
        satiety: clamp(next.pet.state.satiety + (purchase.effect.satiety ?? 0)),
        mood: clamp(next.pet.state.mood + (purchase.effect.mood ?? 0)),
        care: clamp(next.pet.state.care + (purchase.effect.care ?? 0)),
      },
    },
  };
}

export function depositToSavings(
  profile: GameProfile,
  amount: number,
  command: { transactionId: string; createdAt: string },
): GameProfile {
  const period = activePeriod(profile);
  if (!Number.isInteger(amount) || amount <= 0)
    throw new DomainError("INVALID_SAVINGS_AMOUNT");
  if (amount > profile.walletBalance)
    throw new DomainError("INSUFFICIENT_FUNDS");
  return appendTransaction(
    profile,
    period,
    {
      id: command.transactionId,
      type: "SAVINGS_DEPOSIT",
      amount,
      source: "player:savings-deposit",
      category: "SAVINGS",
      periodId: period.id,
      createdAt: command.createdAt,
      metadata: {},
    },
    profile.walletBalance - amount,
    profile.savingsBalance + amount,
  );
}
export interface SavingsWithdrawalPreview {
  amount: number;
  walletAfter: number;
  savingsAfter: number;
  goalProgressLost: number;
}
export function previewSavingsWithdrawal(
  profile: GameProfile,
  amount: number,
): SavingsWithdrawalPreview {
  if (
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > profile.savingsBalance
  )
    throw new DomainError("INVALID_WITHDRAWAL");
  return {
    amount,
    walletAfter: profile.walletBalance + amount,
    savingsAfter: profile.savingsBalance - amount,
    goalProgressLost: amount,
  };
}
export function withdrawFromSavings(
  profile: GameProfile,
  amount: number,
  command: { transactionId: string; createdAt: string; confirmed: boolean },
): GameProfile {
  const period = activePeriod(profile);
  if (!command.confirmed) throw new DomainError("INVALID_WITHDRAWAL");
  const preview = previewSavingsWithdrawal(profile, amount);
  return appendTransaction(
    profile,
    period,
    {
      id: command.transactionId,
      type: "SAVINGS_WITHDRAWAL",
      amount,
      source: "player:savings-withdrawal",
      category: "SAVINGS",
      periodId: period.id,
      createdAt: command.createdAt,
      metadata: { confirmed: true },
    },
    preview.walletAfter,
    preview.savingsAfter,
  );
}

export function completeTask(
  profile: GameProfile,
  task: LearningTaskDefinition,
  command: {
    answer: string | number | boolean | TaskSubmission;
    transactionId: string;
    completedAt: string;
  },
): GameProfile {
  const successful =
    "answer" in task
      ? command.answer === task.answer
      : evaluateTask(task, command.answer).successful;
  if (!("answer" in task) && !successful)
    throw new DomainError("TASK_NOT_SUCCESSFUL");
  const period = activePeriod(profile);
  if (profile.completedTasks.some((item) => item.taskId === task.id))
    throw new DomainError("TASK_ALREADY_COMPLETED");
  if (period.taskResults.some((item) => item.taskId === task.id))
    throw new DomainError("TASK_ALREADY_COMPLETED");
  const reward = successful ? task.reward : 0;
  const topicProgress = profile.learningProgress[task.topic];
  let next: GameProfile = {
    ...profile,
    completedTasks: [
      ...profile.completedTasks,
      {
        taskId: task.id,
        periodId: period.id,
        successful,
        completedAt: command.completedAt,
      },
    ],
    learningProgress: {
      ...profile.learningProgress,
      [task.topic]: {
        completedTasks: topicProgress.completedTasks + 1,
        attempts: topicProgress.attempts + 1,
        successfulDecisions:
          topicProgress.successfulDecisions + (successful ? 1 : 0),
        experiencedConsequences:
          topicProgress.experiencedConsequences + (successful ? 0 : 1),
      },
    },
    currentPeriod: {
      ...period,
      taskResults: [
        ...period.taskResults,
        {
          taskId: task.id,
          topic: task.topic,
          successful,
          reward,
          completedAt: command.completedAt,
        },
      ],
    },
    updatedAt: command.completedAt,
  };
  if (reward > 0)
    next = appendTransaction(
      next,
      next.currentPeriod!,
      {
        id: command.transactionId,
        type: "TASK_REWARD",
        amount: reward,
        source: `task:${task.id}`,
        category: "LEARNING",
        periodId: period.id,
        createdAt: command.completedAt,
        metadata: { taskId: task.id },
      },
      next.walletBalance + reward,
      next.savingsBalance,
    );
  return next;
}

export function applyGameEvent(
  profile: GameProfile,
  event: GameEventDefinition,
  command: { transactionId: string; createdAt: string },
): GameProfile {
  if (event.kind === "decision") throw new DomainError("INVALID_EVENT_ACTION");
  const period = activePeriod(profile);
  if (event.kind === "expense" && event.amount > profile.walletBalance)
    throw new DomainError("INSUFFICIENT_FUNDS");
  const reward = event.kind === "reward";
  return appendTransaction(
    profile,
    period,
    {
      id: command.transactionId,
      type: reward ? "EVENT_REWARD" : "EVENT_EXPENSE",
      amount: event.amount,
      source: event.source,
      category: "EVENT",
      periodId: period.id,
      createdAt: command.createdAt,
      metadata: { eventId: event.id },
    },
    profile.walletBalance + (reward ? event.amount : -event.amount),
    profile.savingsBalance,
  );
}

export function calculateBudgetActual(
  transactions: Transaction[],
  remainingBalance: number,
): BudgetActual {
  const total = (type: Transaction["type"]) =>
    transactions
      .filter((transaction) => transaction.type === type)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    spentMandatory:
      total("PURCHASE_MANDATORY") +
      transactions
        .filter((t) => t.type === "EVENT_EXPENSE" && t.category === "MANDATORY")
        .reduce((s, t) => s + t.amount, 0),
    spentOptional:
      total("PURCHASE_OPTIONAL") +
      transactions
        .filter((t) => t.type === "EVENT_EXPENSE" && t.category === "OPTIONAL")
        .reduce((s, t) => s + t.amount, 0),
    savedActual: Math.max(
      0,
      total("SAVINGS_DEPOSIT") -
        total("SAVINGS_WITHDRAWAL") -
        total("GOAL_CHANGE_RETURN"),
    ),
    earnedExtra: total("TASK_REWARD") + total("EVENT_REWARD"),
    remainingBalance,
  };
}
export function calculatePlanVsActual(
  plan: BudgetPlan,
  actual: BudgetActual,
): PlanVsActual {
  const pairs: Array<[number, number]> = [
    [plan.plannedMandatory, actual.spentMandatory],
    [plan.plannedOptional, actual.spentOptional],
    [plan.plannedSavings, actual.savedActual],
  ];
  const plannedTotal = pairs.reduce((sum, [planned]) => sum + planned, 0);
  const deviation = pairs.reduce(
    (sum, [planned, fact]) => sum + Math.abs(planned - fact),
    0,
  );
  return {
    mandatory: {
      planned: plan.plannedMandatory,
      actual: actual.spentMandatory,
      difference: actual.spentMandatory - plan.plannedMandatory,
    },
    optional: {
      planned: plan.plannedOptional,
      actual: actual.spentOptional,
      difference: actual.spentOptional - plan.plannedOptional,
    },
    savings: {
      planned: plan.plannedSavings,
      actual: actual.savedActual,
      difference: actual.savedActual - plan.plannedSavings,
    },
    adherence:
      plannedTotal === 0 ? 1 : Math.max(0, 1 - deviation / plannedTotal),
  };
}
export function calculatePeriodScore(
  period: GamePeriod,
): Omit<
  PeriodResult,
  "petStateChange" | "petStageChange" | "feedbackCodes" | "snapshot"
> {
  if (!period.budgetPlan) throw new DomainError("INVALID_BUDGET");
  const planVsActual = calculatePlanVsActual(
    period.budgetPlan,
    period.budgetActual,
  );
  const coveredNeeds = period.mandatoryNeeds.filter((need) =>
    period.transactions.some(
      (t) =>
        (t.type === "PURCHASE_MANDATORY" ||
          (t.type === "EVENT_EXPENSE" && t.category === "MANDATORY")) &&
        need.purchaseIds.includes(String(t.metadata.purchaseId)),
    ),
  ).length;
  const mandatoryRatio =
    period.mandatoryNeeds.length > 0
      ? coveredNeeds / period.mandatoryNeeds.length
      : period.budgetPlan.plannedMandatory > 0
        ? Math.min(
            1,
            period.budgetActual.spentMandatory /
              period.budgetPlan.plannedMandatory,
          )
        : 0;
  const mandatoryNeedsMet = mandatoryRatio === 1;
  const savingsConsistency =
    period.budgetActual.savedActual === 0
      ? 0
      : period.budgetPlan.plannedSavings === 0
        ? 1
        : Math.min(
            1,
            period.budgetActual.savedActual / period.budgetPlan.plannedSavings,
          );
  const successfulTasks = period.taskResults.filter(
    (result) => result.successful,
  ).length;
  const taskCompletion =
    period.taskResults.length === 0
      ? 0
      : successfulTasks / period.taskResults.length;
  const progressSignals = {
    mandatoryCareScore: Math.round(mandatoryRatio * 100),
    planDisciplineScore:
      period.budgetPlan.plannedMandatory +
        period.budgetPlan.plannedOptional +
        period.budgetPlan.plannedSavings >
      0
        ? Math.round(planVsActual.adherence * 100)
        : 0,
    savingsScore: Math.round(savingsConsistency * 100),
    learningScore: Math.round(taskCompletion * 100),
  };
  const score = Math.round(
    progressSignals.mandatoryCareScore * 0.35 +
      progressSignals.planDisciplineScore * 0.25 +
      progressSignals.savingsScore * 0.2 +
      progressSignals.learningScore * 0.2,
  );
  return {
    planVsActual,
    mandatoryNeedsMet,
    savingsConsistency,
    taskCompletion,
    score,
    progressSignals,
  };
}
export function calculatePetState(
  current: GameProfile["pet"]["state"],
  result: ReturnType<typeof calculatePeriodScore>,
) {
  const change = {
    satiety: result.mandatoryNeedsMet ? 4 : -4,
    mood: result.planVsActual.adherence >= 0.7 ? 3 : -2,
    care: result.savingsConsistency >= 0.5 ? 3 : -1,
  };
  const state = {
    satiety: clamp(current.satiety + change.satiety),
    mood: clamp(current.mood + change.mood),
    care: clamp(current.care + change.care),
  };
  return {
    state,
    change: {
      satiety: state.satiety - current.satiety,
      mood: state.mood - current.mood,
      care: state.care - current.care,
    },
  };
}
const stageRank: Record<PetStage, number> = {
  BABY: 0,
  EXPLORER: 1,
  FINNI_PRO: 2,
};
export function calculatePetStage(
  progress: GameProfile["pet"]["progress"],
  currentStage: PetStage,
): PetStage {
  // Grow after completing day 4 and day 8, independently of spending or score.
  let earned: PetStage = "BABY";
  if (progress.completedPeriods >= 8) earned = "FINNI_PRO";
  else if (progress.completedPeriods >= 4) earned = "EXPLORER";
  const stages: PetStage[] = ["BABY", "EXPLORER", "FINNI_PRO"];
  return stages[
    Math.min(
      stageRank[currentStage] + 1,
      Math.max(stageRank[currentStage], stageRank[earned]),
    )
  ]!;
}
/** Persist completion and learning together; a replay never grants more progress. */
export function awardSituationLearning(
  profile: GameProfile,
  situationId: string,
  now: string,
): GameProfile {
  if (!situationId) throw new DomainError("INVALID_TASK_ACTION");
  if (profile.completedSituationIds.includes(situationId)) return profile;
  const progress = {
    ...profile.pet.progress,
    learning: profile.pet.progress.learning + 8,
  };
  const stage = profile.pendingEvolution
    ? profile.pet.stage
    : calculatePetStage(progress, profile.pet.stage);
  return {
    ...profile,
    completedSituationIds: [...profile.completedSituationIds, situationId],
    pendingEvolution:
      stage !== profile.pet.stage
        ? { from: profile.pet.stage, to: stage }
        : profile.pendingEvolution,
    pet: { ...profile.pet, progress, stage },
    updatedAt: now,
  };
}
export function closePeriod(
  profile: GameProfile,
  completedAt: string,
): GameProfile {
  const period = activePeriod(profile);
  if (!period.budgetPlan?.confirmed) throw new DomainError("INVALID_BUDGET");
  const actual = calculateBudgetActual(
    period.transactions,
    profile.walletBalance,
  );
  const scored = calculatePeriodScore({ ...period, budgetActual: actual });
  const petState = calculatePetState(profile.pet.state, scored);
  const progress = {
    mandatoryCare:
      profile.pet.progress.mandatoryCare +
      scored.progressSignals.mandatoryCareScore,
    planDiscipline:
      profile.pet.progress.planDiscipline +
      scored.progressSignals.planDisciplineScore,
    savings: profile.pet.progress.savings + scored.progressSignals.savingsScore,
    learning:
      profile.pet.progress.learning + scored.progressSignals.learningScore,
    completedPeriods: profile.pet.progress.completedPeriods + 1,
  };
  const nextStage = profile.pendingEvolution
    ? profile.pet.stage
    : calculatePetStage(progress, profile.pet.stage);
  const periodResult: PeriodResult = {
    ...scored,
    snapshot: {
      walletBalance: profile.walletBalance,
      savingsBalance: profile.savingsBalance,
      selectedGoalId: profile.selectedGoalId,
      petState: petState.state,
      petProgress: progress,
    },
    petStateChange: petState.change,
    petStageChange: { from: profile.pet.stage, to: nextStage },
    feedbackCodes: [
      scored.mandatoryNeedsMet ? "MANDATORY_MET" : "MANDATORY_NEXT_STEP",
      actual.savedActual === 0
        ? "SAVINGS_ZERO"
        : scored.savingsConsistency >= 1
          ? "SAVINGS_ON_PLAN"
          : "SAVINGS_CAN_GROW",
      scored.planVsActual.optional.difference > 0
        ? "OPTIONAL_OVER"
        : scored.taskCompletion > 0
          ? "LEARNING_DONE"
          : "OPTIONAL_ON_PLAN",
    ],
  };
  const completed: GamePeriod = {
    ...period,
    evolutionSeen: nextStage === profile.pet.stage,
    status: "COMPLETED",
    budgetActual: actual,
    completedAt,
    periodResult,
  };
  return {
    ...profile,
    pet: { ...profile.pet, state: petState.state, progress, stage: nextStage },
    currentPeriod: null,
    periodHistory: [...profile.periodHistory, completed],
    updatedAt: completedAt,
  };
}

export function selectSavingsGoal(
  profile: GameProfile,
  goalId: string,
  updatedAt: string,
): GameProfile {
  if (!goalId) throw new DomainError("GOAL_NOT_SELECTED");
  return { ...profile, selectedGoalId: goalId, updatedAt };
}

/** Acknowledgements are persisted independently of awarding progress. */
export function acknowledgeEvolution(
  profile: GameProfile,
  periodId: string,
  now: string,
): GameProfile {
  if (!profile.periodHistory.some((p) => p.id === periodId))
    throw new DomainError("NO_ACTIVE_PERIOD");
  return {
    ...profile,
    updatedAt: now,
    periodHistory: profile.periodHistory.map((p) =>
      p.id === periodId ? { ...p, evolutionSeen: true } : p,
    ),
  };
}
export function acknowledgeGoal(
  profile: GameProfile,
  goal: SavingsGoalDefinition,
  now: string,
): GameProfile {
  if (profile.selectedGoalId !== goal.id || profile.savingsBalance < goal.cost)
    throw new DomainError("GOAL_NOT_SELECTED");
  return {
    ...profile,
    updatedAt: now,
    achievedGoalIds: [...new Set([...profile.achievedGoalIds, goal.id])],
  };
}
export function resolveDecisionEvent(
  profile: GameProfile,
  event: GameEventDefinition,
  choiceId: string,
  purchases: PurchaseDefinition[],
  command: { transactionId: string; createdAt: string },
): GameProfile {
  const period = activePeriod(profile);
  if (event.kind !== "decision") throw new DomainError("INVALID_EVENT_ACTION");
  if (period.eventDecisions.some((d) => d.eventId === event.id))
    throw new DomainError("DUPLICATE_ACTION");
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) throw new DomainError("INVALID_EVENT_ACTION");
  let next = profile;
  if (choice.outcome === "income") {
    next = applyGameEvent(
      profile,
      {
        id: event.id,
        kind: "reward",
        amount: event.context.amount,
        source: `event:${event.id}`,
      },
      command,
    );
  } else if (choice.outcome === "deposit") {
    next = depositToSavings(profile, event.context.amount, command);
  } else if (choice.outcome === "purchase") {
    const item = purchases.find((p) => p.id === event.context.itemId);
    if (!item) throw new DomainError("INVALID_EVENT_ACTION");
    next = executePurchase(
      profile,
      { ...item, price: event.context.amount },
      command,
    );
    const transaction: Transaction = {
      ...next.transactions.at(-1)!,
      type: "EVENT_EXPENSE",
      source: `event:${event.id}`,
      metadata: {
        purchaseId: item.id,
        eventId: event.id,
        regularPrice: item.price,
      },
    };
    const replace = (transactions: Transaction[]) =>
      transactions.map((t) => (t.id === transaction.id ? transaction : t));
    const transactions = replace(next.currentPeriod!.transactions);
    next = {
      ...next,
      transactions: replace(next.transactions),
      currentPeriod: {
        ...next.currentPeriod!,
        transactions,
        budgetActual: calculateBudgetActual(transactions, next.walletBalance),
      },
    };
  }
  return {
    ...next,
    updatedAt: command.createdAt,
    currentPeriod: {
      ...next.currentPeriod!,
      eventDecisions: [
        ...period.eventDecisions,
        { eventId: event.id, choiceId },
      ],
    },
  };
}

export function comparisonMaximum(comparison: PlanVsActual) {
  return Math.max(
    1,
    ...[comparison.mandatory, comparison.optional, comparison.savings].flatMap(
      (p) => [p.planned, p.actual],
    ),
  );
}
export function learningStatus(
  completedTasks: number,
): "new" | "started" | "practising" | "familiar" {
  return completedTasks === 0
    ? "new"
    : completedTasks === 1
      ? "started"
      : completedTasks === 2
        ? "practising"
        : "familiar";
}
export function calculateGoalProgress(
  profile: GameProfile,
  goal: SavingsGoalDefinition,
): number {
  return Math.min(1, profile.savingsBalance / goal.cost);
}
export function calculateGoalRemaining(
  profile: GameProfile,
  goal: SavingsGoalDefinition,
): number {
  return Math.max(0, goal.cost - profile.savingsBalance);
}
export function goalEta(
  goalCost: number,
  saved: number,
  averageDeposit: number,
): number | null {
  if (saved >= goalCost) return 0;
  if (averageDeposit <= 0) return null;
  return Math.ceil((goalCost - saved) / averageDeposit);
}

export type BudgetValues = Pick<
  BudgetPlan,
  "plannedMandatory" | "plannedOptional" | "plannedSavings"
>;
export const emptyBudgetValues = (): BudgetValues => ({
  plannedMandatory: 0,
  plannedOptional: 0,
  plannedSavings: 0,
});
export function summarizeBudget(income: number, values: BudgetValues) {
  const plan = createBudgetPlan(income, values);
  return { ...plan, allocated: income - plan.unallocated, income };
}
export function adjustBudgetAllocation(
  income: number,
  values: BudgetValues,
  field: keyof BudgetValues,
  delta: number,
): BudgetValues {
  const next = { ...values, [field]: values[field] + delta };
  if (!validateBudgetPlan(income, next))
    throw new DomainError("INVALID_BUDGET");
  return next;
}
export function adjustMoneyAmount(
  amount: number,
  delta: number,
  available: number,
) {
  return Math.min(available, Math.max(0, Math.round(amount + delta)));
}
export function purchasePreview(
  profile: GameProfile,
  item: PurchaseDefinition,
) {
  return {
    price: item.price,
    available: profile.walletBalance,
    shortage: Math.max(0, item.price - profile.walletBalance),
  };
}
export function previewSavingsDeposit(profile: GameProfile, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0)
    throw new DomainError("INVALID_SAVINGS_AMOUNT");
  if (amount > profile.walletBalance)
    throw new DomainError("INSUFFICIENT_FUNDS");
  return {
    amount,
    walletAfter: profile.walletBalance - amount,
    savingsAfter: profile.savingsBalance + amount,
  };
}
export function goalRemainingForBalance(
  savings: number,
  goal: SavingsGoalDefinition,
) {
  return Math.max(0, goal.cost - savings);
}
export function activeDayPreview(profile: GameProfile) {
  const period = profile.currentPeriod;
  if (!period?.budgetPlan) return null;
  return calculatePlanVsActual(
    period.budgetPlan,
    calculateBudgetActual(period.transactions, profile.walletBalance),
  );
}

/** Pure, disposable educational simulation. It never receives or edits GameProfile. */
export function evaluateTask(
  task: InteractiveLearningTaskDefinition,
  raw: unknown,
) {
  const parsed = TaskSubmissionSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("INVALID_TASK_ACTION");
  const submission = parsed.data;
  const action = task.actions.find((item) => item.id === submission.actionId);
  if (!action || action.kind === "reorder")
    throw new DomainError("INVALID_TASK_ACTION");
  const initial = task.initialState;
  let wallet = initial.wallet;
  let savings = initial.savings;
  let mandatoryPurchased = 0;
  let cartTotal = 0;
  let savingsDeposited = 0;
  let totalAllocated = 0;
  let mandatoryAllocated = 0;
  let savingsAllocated = 0;
  if (action.kind === "allocate" && task.type === "allocate_budget") {
    if (!submission.allocations) throw new DomainError("INVALID_TASK_ACTION");
    const { mandatory, optional, savings: saving } = submission.allocations;
    if (
      !validateBudgetPlan(wallet, {
        plannedMandatory: mandatory,
        plannedOptional: optional,
        plannedSavings: saving,
      })
    )
      throw new DomainError("INVALID_TASK_ACTION");
    totalAllocated = mandatory + optional + saving;
    mandatoryAllocated = mandatory;
    savingsAllocated = saving;
  } else if (action.kind === "edit_cart" && task.type === "shopping_cart") {
    const ids = submission.selectedItemIds;
    if (
      !ids ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !initial.items.some((item) => item.itemId === id))
    )
      throw new DomainError("INVALID_TASK_ACTION");
    const chosen = initial.items.filter((item) => ids.includes(item.itemId));
    cartTotal = chosen.reduce((sum, item) => sum + item.price, 0);
    mandatoryPurchased = chosen.filter(
      (item) => item.kind === "mandatory",
    ).length;
    wallet -= cartTotal;
  } else if (action.kind === "buy") {
    const item = initial.items.find((item) => item.itemId === action.itemId);
    if (!item || item.price > wallet)
      throw new DomainError("INVALID_TASK_ACTION");
    wallet -= item.price;
    mandatoryPurchased = item.kind === "mandatory" ? 1 : 0;
  } else if (action.kind === "deposit") {
    if (!action.amount || action.amount > wallet)
      throw new DomainError("INVALID_TASK_ACTION");
    wallet -= action.amount;
    savings += action.amount;
    savingsDeposited = action.amount;
  } else if (action.kind !== "skip")
    throw new DomainError("INVALID_TASK_ACTION");
  const goalRemaining = Math.max(0, (initial.goalCost ?? 0) - savings);
  const metrics = {
    wallet,
    mandatoryPurchased,
    savingsDeposited,
    cartTotal,
    goalRemaining,
    totalAllocated,
    mandatoryAllocated,
    savingsAllocated,
  };
  const successful = task.successConditions.every((condition) => {
    const value = metrics[condition.metric];
    return condition.operator === "eq"
      ? value === condition.value
      : condition.operator === "gte"
        ? value >= condition.value
        : value <= condition.value;
  });
  const code =
    !successful && action.retryFeedbackCode
      ? action.retryFeedbackCode
      : action.feedbackCode;
  const feedback = task.feedback.find((item) => item.code === code)!;
  // Values are rendered into content templates, so basket feedback matches every valid combination.
  const values = {
    ...metrics,
    savings,
    unallocated: initial.wallet - totalAllocated,
    shortage: Math.max(0, -wallet),
  };
  const format = (text: string) =>
    text.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? String(values[key as keyof typeof values]) : match,
    );
  return {
    ...values,
    successful,
    feedback: {
      text: format(feedback.text),
      consequence: format(feedback.consequence),
    },
  };
}

// Compatibility helper for the earliest prototype callers.
export function petStage(
  periodsCompleted: number,
  planFulfillmentRate: number,
): 1 | 2 | 3 {
  if (periodsCompleted >= 5 && planFulfillmentRate >= 0.8) return 3;
  if (periodsCompleted >= 2 && planFulfillmentRate >= 0.5) return 2;
  return 1;
}
