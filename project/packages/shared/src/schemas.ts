import { z } from "zod";

export const SCHEMA_VERSION = 2 as const;

export const DomainErrorCodeSchema = z.enum([
  "DAY_NOT_READY",
  "INVALID_CUSTOM_GOAL",
  "PROGRAM_NOT_COMPLETE",
  "FINALE_PENDING",
  "PET_NEEDS_CARE",
  "INSUFFICIENT_FUNDS",
  "INVALID_BUDGET",
  "BUDGET_ALREADY_CONFIRMED",
  "NO_ACTIVE_PERIOD",
  "INVALID_SAVINGS_AMOUNT",
  "INVALID_WITHDRAWAL",
  "GOAL_NOT_SELECTED",
  "TASK_ALREADY_COMPLETED",
  "INVALID_PROFILE",
  "INVALID_PET_NAME",
  "INVALID_TASK_ACTION",
  "INVALID_EVENT_ACTION",
  "ACTION_IN_PROGRESS",
  "PROFILE_CONFLICT",
  "UNSUPPORTED_PROFILE_VERSION",
  "DUPLICATE_ACTION",
  "TASK_NOT_SUCCESSFUL",
]);
export type DomainErrorCode = z.infer<typeof DomainErrorCodeSchema>;

export const PetStageSchema = z.enum(["BABY", "EXPLORER", "FINNI_PRO"]);
export type PetStage = z.infer<typeof PetStageSchema>;
export const PetAppearanceSchema = z.object({
  species: z.string().min(1),
  colorVariant: z.string().min(1),
  accessoryVariant: z.string().min(1).optional(),
});
export type PetAppearance = z.infer<typeof PetAppearanceSchema>;
export const PetNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
export const PetStateSchema = z.object({
  satiety: z.number().int().min(0).max(100),
  mood: z.number().int().min(0).max(100),
  care: z.number().int().min(0).max(100),
});
export type PetState = z.infer<typeof PetStateSchema>;
export const PetProgressSchema = z.object({
  mandatoryCare: z.number().int().nonnegative(),
  planDiscipline: z.number().int().nonnegative(),
  savings: z.number().int().nonnegative(),
  learning: z.number().int().nonnegative(),
  completedPeriods: z.number().int().nonnegative(),
});
export type PetProgress = z.infer<typeof PetProgressSchema>;
export const PetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  species: z.string().min(1),
  appearance: PetAppearanceSchema,
  state: PetStateSchema,
  stage: PetStageSchema,
  progress: PetProgressSchema,
});
export type Pet = z.infer<typeof PetSchema>;

export const BudgetPlanSchema = z.object({
  plannedMandatory: z.number().int().nonnegative(),
  plannedOptional: z.number().int().nonnegative(),
  plannedSavings: z.number().int().nonnegative(),
  unallocated: z.number().int().nonnegative(),
  confirmed: z.boolean(),
  confirmedAt: z.string().datetime().nullable(),
});
export type BudgetPlan = z.infer<typeof BudgetPlanSchema>;
export const BudgetActualSchema = z.object({
  spentMandatory: z.number().int().nonnegative(),
  spentOptional: z.number().int().nonnegative(),
  savedActual: z.number().int().nonnegative(),
  earnedExtra: z.number().int().nonnegative(),
  remainingBalance: z.number().int().nonnegative(),
});
export type BudgetActual = z.infer<typeof BudgetActualSchema>;

export const TransactionTypeSchema = z.enum([
  "GOAL_PURCHASE",
  "GOAL_CHANGE_RETURN",
  "PERIOD_INCOME",
  "TASK_REWARD",
  "PURCHASE_MANDATORY",
  "PURCHASE_OPTIONAL",
  "SAVINGS_DEPOSIT",
  "SAVINGS_WITHDRAWAL",
  "EVENT_REWARD",
  "EVENT_EXPENSE",
]);
export const TransactionCategorySchema = z.enum([
  "INCOME",
  "MANDATORY",
  "OPTIONAL",
  "SAVINGS",
  "LEARNING",
  "EVENT",
]);
export const TransactionSchema = z.object({
  id: z.string().min(1),
  type: TransactionTypeSchema,
  amount: z.number().int().positive(),
  source: z.string().min(1),
  category: TransactionCategorySchema,
  periodId: z.string().min(1),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({}),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const LearningTopicSchema = z.enum([
  "BUDGET_PLANNING",
  "SAVINGS",
  "PAYMENTS_AND_PURCHASES",
]);
export type LearningTopic = z.infer<typeof LearningTopicSchema>;
export const TopicProgressSchema = z.object({
  completedTasks: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  successfulDecisions: z.number().int().nonnegative(),
  experiencedConsequences: z.number().int().nonnegative(),
});
export const LearningProgressSchema = z.object({
  BUDGET_PLANNING: TopicProgressSchema,
  SAVINGS: TopicProgressSchema,
  PAYMENTS_AND_PURCHASES: TopicProgressSchema,
});
export type LearningProgress = z.infer<typeof LearningProgressSchema>;
export const TaskResultSchema = z.object({
  taskId: z.string().min(1),
  topic: LearningTopicSchema,
  successful: z.boolean(),
  reward: z.number().int().nonnegative(),
  completedAt: z.string().datetime(),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

export const PlanVsActualSchema = z.object({
  mandatory: z.object({
    planned: z.number(),
    actual: z.number(),
    difference: z.number(),
  }),
  optional: z.object({
    planned: z.number(),
    actual: z.number(),
    difference: z.number(),
  }),
  savings: z.object({
    planned: z.number(),
    actual: z.number(),
    difference: z.number(),
  }),
  adherence: z.number().min(0).max(1),
});
export type PlanVsActual = z.infer<typeof PlanVsActualSchema>;
export const PetStateChangeSchema = z.object({
  satiety: z.number().int(),
  mood: z.number().int(),
  care: z.number().int(),
});
export const ProgressSignalsSchema = z.object({
  mandatoryCareScore: z.number().int().min(0).max(100),
  planDisciplineScore: z.number().int().min(0).max(100),
  savingsScore: z.number().int().min(0).max(100),
  learningScore: z.number().int().min(0).max(100),
});
export const PeriodResultSchema = z.object({
  snapshot: z
    .object({
      walletBalance: z.number().int().nonnegative(),
      savingsBalance: z.number().int().nonnegative(),
      selectedGoalId: z.string().nullable(),
      petState: PetStateSchema,
      petProgress: PetProgressSchema,
    })
    .nullable()
    .default(null),
  planVsActual: PlanVsActualSchema,
  mandatoryNeedsMet: z.boolean(),
  savingsConsistency: z.number().min(0).max(1),
  taskCompletion: z.number().min(0).max(1),
  score: z.number().int().min(0).max(100),
  petStateChange: PetStateChangeSchema,
  petStageChange: z.object({ from: PetStageSchema, to: PetStageSchema }),
  feedbackCodes: z.array(z.string()),
  progressSignals: ProgressSignalsSchema,
});
export type PeriodResult = z.infer<typeof PeriodResultSchema>;

export const GamePeriodSchema = z.object({
  dailyCare: z.array(z.enum(["feed", "play", "care"])).optional(),
  needsDecaySteps: z.number().int().nonnegative().optional(),
  mandatoryNeeds: z
    .array(
      z.object({ id: z.string(), purchaseIds: z.array(z.string()).min(1) }),
    )
    .default([]),
  eventDecisions: z
    .array(z.object({ eventId: z.string(), choiceId: z.string() }))
    .default([]),
  evolutionSeen: z.boolean().default(true),
  id: z.string().min(1),
  index: z.number().int().positive(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED"]),
  income: z.number().int().nonnegative(),
  budgetPlan: BudgetPlanSchema.nullable(),
  budgetActual: BudgetActualSchema,
  transactions: z.array(TransactionSchema),
  taskResults: z.array(TaskResultSchema),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  periodResult: PeriodResultSchema.nullable(),
});
export type GamePeriod = z.infer<typeof GamePeriodSchema>;
export const CompletedTaskSchema = z.object({
  taskId: z.string().min(1),
  periodId: z.string().min(1),
  successful: z.boolean(),
  completedAt: z.string().datetime(),
});

export const GameProfileSchema = z.object({
  taskReplays: z.record(z.object({id:z.string().min(1), claimed:z.boolean()})).default({}),
  situationReplays: z.record(z.object({id:z.string().min(1), completedIds:z.array(z.string()), claimed:z.boolean()})).default({}),
  finaleSeen: z.boolean().default(false),
  customGoals: z.array(z.object({
    id: z.string().startsWith("custom:"),
    title: z.string().trim().min(1).max(40),
    cost: z.number().int().min(10).max(10000),
    assetId: z.literal("goal-custom"),
    description: z.string(),
  })).default([]),
  petAlbum: z.array(z.object({
    id: z.string(), pet: PetSchema, archivedAt: z.string().datetime(),
    daysCompleted: z.number().int().nonnegative(),
    taskCount: z.number().int().nonnegative(), situationCount: z.number().int().nonnegative(),
    walletBalance: z.number().int().nonnegative(), savingsBalance: z.number().int().nonnegative(),
    dreams: z.array(z.object({id: z.string(), title: z.string(), cost: z.number().int().positive()})),
  })).default([]),
  needsUpdatedAt: z.string().datetime().optional(),
  completedSituationIds: z.array(z.string()).default([]),
  pendingEvolution: z
    .object({ from: PetStageSchema, to: PetStageSchema })
    .nullable()
    .default(null),
  achievedGoalIds: z.array(z.string()).default([]),
  id: z.string().min(1),
  playerNickname: z.string().min(1),
  pet: PetSchema,
  walletBalance: z.number().int().nonnegative(),
  savingsBalance: z.number().int().nonnegative(),
  selectedGoalId: z.string().min(1).nullable(),
  currentPeriod: GamePeriodSchema.nullable(),
  periodHistory: z.array(GamePeriodSchema),
  transactions: z.array(TransactionSchema),
  completedTasks: z.array(CompletedTaskSchema),
  learningProgress: LearningProgressSchema,
  demoMode: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  schemaVersion: z.literal(SCHEMA_VERSION),
});
export type GameProfile = z.infer<typeof GameProfileSchema>;

export const PurchaseDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  assetId: z.string().min(1).optional(),
  price: z.number().int().positive(),
  kind: z.enum(["mandatory", "optional"]),
  effect: z
    .object({
      mood: z.number().int().min(-100).max(100).optional(),
      satiety: z.number().int().min(-100).max(100).optional(),
      care: z.number().int().min(-100).max(100).optional(),
    })
    .default({}),
});
export type PurchaseDefinition = z.infer<typeof PurchaseDefinitionSchema>;
export const SavingsGoalDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  cost: z.number().int().positive(),
});
export type SavingsGoalDefinition = z.infer<typeof SavingsGoalDefinitionSchema>;
export const SituationDefinitionSchema = z
  .object({
    id: z.string().min(1),
    group: z.string().min(1),
    feedback: z.array(z.string()).length(3).optional(),
    title: z.string().min(1),
    question: z.string().min(1),
    hero: z.string().min(1),
    options: z.array(z.string().min(1)).length(3),
    icons: z.array(z.string().min(1)).length(3),
    correct: z.number().int().min(0).max(2),
    explanation: z.string().min(1),
    theme: z.string().min(1),
    hint: z.string().min(1),
  })
  .strict();
export type SituationDefinition = z.infer<typeof SituationDefinitionSchema>;
export const LegacyLearningTaskDefinitionSchema = z.object({
  id: z.string().min(1),
  topic: LearningTopicSchema,
  text: z.string().min(1),
  answer: z.union([z.string(), z.number(), z.boolean()]),
  explain: z.string().min(1),
  reward: z.number().int().nonnegative(),
});
export const DecisionActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["allocate", "buy", "deposit", "skip", "reorder", "edit_cart"]),
  itemId: z.string().optional(),
  amount: z.number().int().nonnegative().optional(),
  feedbackCode: z.string().min(1),
  retryFeedbackCode: z.string().min(1).optional(),
});
export const DecisionFeedbackSchema = z.object({
  code: z.string().min(1),
  text: z.string().min(1),
  consequence: z.string().min(1),
});
export const InteractiveLearningTaskDefinitionSchema = z
  .object({
    id: z.string().min(1),
    topic: LearningTopicSchema,
    type: z.enum([
      "allocate_budget",
      "prioritize",
      "shopping_cart",
      "savings_choice",
      "unexpected_expense",
      "goal_vs_want",
    ]),
    title: z.string().min(1),
    intro: z.string().min(1),
    hint: z.string().min(1).optional(),
    assetId: z.string().min(1),
    initialState: z.object({
      wallet: z.number().int().nonnegative(),
      savings: z.number().int().nonnegative().default(0),
      goalCost: z.number().int().positive().optional(),
      goalId: z.string().optional(),
      items: z
        .array(
          z.object({
            itemId: z.string(),
            price: z.number().int().positive(),
            kind: z.enum(["mandatory", "optional"]),
          }),
        )
        .default([]),
      allocations: z
        .object({
          mandatory: z.number().int().nonnegative(),
          optional: z.number().int().nonnegative(),
          savings: z.number().int().nonnegative(),
        })
        .optional(),
      plannedItemId: z.string().optional(),
    }),
    actions: z.array(DecisionActionSchema).min(1),
    successConditions: z
      .array(
        z.object({
          metric: z.enum([
            "totalAllocated",
            "mandatoryAllocated",
            "savingsAllocated",
            "wallet",
            "mandatoryPurchased",
            "savingsDeposited",
            "cartTotal",
            "goalRemaining",
          ]),
          operator: z.enum(["eq", "gte", "lte"]),
          value: z.number().nonnegative(),
        }),
      )
      .min(1),
    reward: z.number().int().nonnegative(),
    feedback: z.array(DecisionFeedbackSchema).min(1),
    educationalGoal: z.string().min(1),
    recovery: z.object({
      label: z.string().min(1),
      instruction: z.string().min(1),
      resetSimulation: z.boolean(),
    }),
  })
  .superRefine((task, context) => {
    for (const action of task.actions)
      if (
        !task.feedback.some((f) => f.code === action.feedbackCode) ||
        (action.retryFeedbackCode &&
          !task.feedback.some((f) => f.code === action.retryFeedbackCode))
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unknown feedbackCode",
          path: ["actions"],
        });
  });
export type InteractiveLearningTaskDefinition = z.infer<
  typeof InteractiveLearningTaskDefinitionSchema
>;
export const TaskSubmissionSchema = z
  .object({
    actionId: z.string().min(1),
    allocations: z
      .object({
        mandatory: z.number().int().nonnegative(),
        optional: z.number().int().nonnegative(),
        savings: z.number().int().nonnegative(),
      })
      .optional(),
    selectedItemIds: z.array(z.string()).optional(),
  })
  .strict();
export type TaskSubmission = z.infer<typeof TaskSubmissionSchema>;
export const EconomyConfigSchema = z.object({
  periodIncome: z.number().int().positive(),
  budgetStep: z.number().int().positive(),
  quickAmounts: z.array(z.number().int().positive()).min(1),
});
export const LearningTaskDefinitionSchema = z.union([
  InteractiveLearningTaskDefinitionSchema,
  LegacyLearningTaskDefinitionSchema,
]);
export type LearningTaskDefinition = z.infer<
  typeof LearningTaskDefinitionSchema
>;
export const FinancialEventDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["reward", "expense"]),
  amount: z.number().int().positive(),
  source: z.string().min(1),
});
export const DecisionEventDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("decision"),
  eventType: z.enum([
    "discount",
    "required_expense",
    "bonus",
    "impulse",
    "skip",
    "goal",
  ]),
  title: z.string().min(1),
  intro: z.string().min(1),
  assetId: z.string().min(1),
  context: z.object({
    itemId: z.string().optional(),
    amount: z.number().int().nonnegative(),
    discountPercent: z.number().min(0).max(100).optional(),
    usesSelectedGoal: z.boolean().optional(),
  }),
  choices: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        outcome: z.enum(["purchase", "income", "deposit", "skip"]),
        feedback: z.string().min(1),
      }),
    )
    .min(1),
});
export const GameEventDefinitionSchema = z.union([
  FinancialEventDefinitionSchema,
  DecisionEventDefinitionSchema,
]);
export type GameEventDefinition = z.infer<typeof GameEventDefinitionSchema>;
export const FeedbackDefinitionSchema = z.object({
  code: z.string().min(1),
  text: z.string().min(1),
});
export type FeedbackDefinition = z.infer<typeof FeedbackDefinitionSchema>;
export const GlossaryEntrySchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  definition: z.string().min(1),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

// Aliases kept for compatibility with the first prototype.
export const PlanSchema = BudgetPlanSchema;
export const PurchaseSchema = PurchaseDefinitionSchema;
export const GoalSchema = SavingsGoalDefinitionSchema;
export type Plan = BudgetPlan;
export type Purchase = PurchaseDefinition;
export type Goal = SavingsGoalDefinition;
