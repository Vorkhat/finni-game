import { programCompletion } from "@finni/content";
import {
  GameProfileSchema,
  evaluateProgramTask,
  calculateBudgetActual,
  type ProgramAnswer,
  advancePetNeeds,
  dayProgress,
  changeSavingsGoal,
  closePeriod,
  acknowledgeEvolution,
  acknowledgeGoal,
  awardSituationLearning,
  resolveDecisionEvent,
  completeTask,
  confirmBudgetPlan,
  createDemoProfile,
  createInitialProfile,
  depositToSavings,
  executePurchase,
  previewSavingsWithdrawal,
  resetDemoProfile,
  startPeriod,
  updateBudgetPlan,
  withdrawFromSavings,
  type BudgetPlan,
  type CreateProfileCommand,
  type GameProfile,
  type LearningTaskDefinition,
  type TaskSubmission,
  type PurchaseDefinition,
  type SavingsWithdrawalPreview,
  type StartPeriodCommand,
} from "@finni/shared";
import { profileFingerprint, type StorageAdapter } from "./storage";
import {
  programDailyTasks,
  programTasks,
  dailySituations,
  goals,
  profileGoals,
  events,
  purchases,
  periodEventId,
  situations,
  situationDay,
} from "@finni/content";
import { DomainError } from "@finni/shared";

export class GameService {
  private profile: GameProfile | null = null;
  private savedFingerprint: string | null = null;
  private saving = false;
  constructor(
    private readonly storage: StorageAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async loadGame(): Promise<GameProfile | null> {
    this.profile = await this.storage.loadProfile();
    this.savedFingerprint = profileFingerprint(this.profile);
    if (this.profile && this.profile.periodHistory.length >= 10 && !programCompletion(this.profile).complete) this.profile = {...this.profile, finaleSeen:false};
    return this.profile;
  }
  getState(): GameProfile | null {
    return this.profile;
  }

  private requireProfile(): GameProfile {
    if (!this.profile) throw new Error("Game profile is not loaded");
    return this.profile;
  }
  private async commit(operation: () => GameProfile): Promise<GameProfile> {
    if (this.saving) throw new DomainError("ACTION_IN_PROGRESS");
    this.saving = true;
    try {
      const profile = await this.storage.updateProfile(this.savedFingerprint, operation);
      this.profile = profile;
      this.savedFingerprint = profileFingerprint(profile);
      return profile;
    } finally {
      this.saving = false;
    }
  }

  async createProfile(command: CreateProfileCommand): Promise<GameProfile> {
    return this.commit(() => createInitialProfile(command));
  }
  async createDemo(): Promise<GameProfile> {
    return this.commit(() => ({
      ...createDemoProfile(),
      needsUpdatedAt: this.now().toISOString(),
    }));
  }
  async startPeriod(command: StartPeriodCommand): Promise<GameProfile> {
    return this.commit(() => {
      const profile = this.requireProfile();
      if (programCompletion(profile).complete && !profile.finaleSeen)
        throw new DomainError("FINALE_PENDING");
      const refreshed = advancePetNeeds(profile, command.startedAt);
      if (Object.values(refreshed.pet.state).some((value) => value <= 20))
        throw new DomainError("PET_NEEDS_CARE");
      return startPeriod(refreshed, command);
    });
  }
  async setPlan(
    values: Pick<
      BudgetPlan,
      "plannedMandatory" | "plannedOptional" | "plannedSavings"
    >,
    updatedAt: string,
  ): Promise<GameProfile> {
    return this.commit(() =>
      updateBudgetPlan(this.requireProfile(), values, updatedAt),
    );
  }
  async confirmPlan(confirmedAt: string): Promise<GameProfile> {
    return this.commit(() =>
      confirmBudgetPlan(this.requireProfile(), confirmedAt),
    );
  }
  async purchase(
    definition: PurchaseDefinition,
    transactionId: string,
    createdAt: string,
  ): Promise<GameProfile> {
    return this.commit(() =>
      executePurchase(this.requireProfile(), definition, {
        transactionId,
        createdAt,
      }),
    );
  }
  async deposit(
    amount: number,
    transactionId: string,
    createdAt: string,
  ): Promise<GameProfile> {
    return this.commit(() =>
      depositToSavings(this.requireProfile(), amount, {
        transactionId,
        createdAt,
      }),
    );
  }
  previewWithdrawal(amount: number): SavingsWithdrawalPreview {
    return previewSavingsWithdrawal(this.requireProfile(), amount);
  }
  async withdraw(
    amount: number,
    transactionId: string,
    createdAt: string,
    confirmed: boolean,
  ): Promise<GameProfile> {
    return this.commit(() =>
      withdrawFromSavings(this.requireProfile(), amount, {
        transactionId,
        createdAt,
        confirmed,
      }),
    );
  }
  async completeTask(
    task: LearningTaskDefinition,
    answer: string | number | boolean | TaskSubmission,
    transactionId: string,
    completedAt: string,
  ): Promise<GameProfile> {
    return this.commit(() =>
      completeTask(this.requireProfile(), task, {
        answer,
        transactionId,
        completedAt,
      }),
    );
  }
  private replayReward(profile: GameProfile, amount: number, source: string, type: "TASK_REWARD" | "EVENT_REWARD", now: string): GameProfile {
    const period=profile.currentPeriod;
    if (!period || period.status !== "ACTIVE") throw new DomainError("INVALID_TASK_ACTION");
    if (profile.transactions.some(t=>t.source===source)) return profile;
    const reward={id:source,type,amount,source,category:"LEARNING" as const,periodId:period.id,createdAt:now,metadata:{replay:true}};
    const walletBalance=profile.walletBalance+amount, transactions=[...period.transactions,reward];
    return {...profile,walletBalance,updatedAt:now,transactions:[...profile.transactions,reward],currentPeriod:{...period,transactions,budgetActual:calculateBudgetActual(transactions,walletBalance)}};
  }
  async startTaskReplay(id: string, replayId: string, now: string): Promise<GameProfile> {
    return this.commit(()=>{
      const p=this.requireProfile();
      if (!replayId || !programTasks.some(t=>t.id===id) || p.periodHistory.length<10 || p.currentPeriod?.status!=="ACTIVE" || !p.completedTasks.some(t=>t.taskId===id&&t.successful)) throw new DomainError("INVALID_TASK_ACTION");
      const round=p.taskReplays[id];
      if (round && (!round.claimed || round.id===replayId)) return p;
      if(p.transactions.some(t=>t.source===`repeat-task:${id}:${replayId}`)) throw new DomainError("INVALID_TASK_ACTION");
      return {...p,updatedAt:now,taskReplays:{...p.taskReplays,[id]:{id:replayId,claimed:false}}};
    });
  }
  async startSituationReplay(day: number, replayId: string, now: string): Promise<GameProfile> {
    return this.commit(()=>{
      const p=this.requireProfile();
      if (!replayId || p.currentPeriod?.status!=="ACTIVE" || day>p.currentPeriod.index || dailySituations(day).length!==6 || !p.transactions.some(t=>t.source===`program-10:day-${day}:situations`)) throw new DomainError("INVALID_TASK_ACTION");
      const round=p.situationReplays[day];
      if (round && (!round.claimed || round.id===replayId)) return p;
      if(p.transactions.some(t=>t.source===`repeat-situations:${day}:${replayId}`)) throw new DomainError("INVALID_TASK_ACTION");
      return {...p,updatedAt:now,situationReplays:{...p.situationReplays,[day]:{id:replayId,completedIds:[],claimed:false}}};
    });
  }
  async completeProgramTask(
    id: string,
    answer: ProgramAnswer,
    transactionId: string,
    completedAt: string,
    replayId?: string,
  ): Promise<GameProfile> {
    return this.commit(() => {
      const profile = this.requireProfile();
      const task = programTasks.find((task) => task.id === id);
      if (
        !task ||
        !profile.currentPeriod ||
        task.day > profile.currentPeriod.index
      )
        throw new DomainError("INVALID_TASK_ACTION");
      if (replayId) {
        const round=profile.taskReplays[id];
        if (profile.periodHistory.length < 10 || !round || round.id !== replayId) throw new DomainError("INVALID_TASK_ACTION");
        if (round.claimed) return profile;
        if (!evaluateProgramTask(task, answer)) throw new DomainError("TASK_NOT_SUCCESSFUL");
        const paid=this.replayReward(profile, task.reward.coins, `repeat-task:${id}:${replayId}`, "TASK_REWARD", completedAt);
        return {...paid,taskReplays:{...paid.taskReplays,[id]:{...round,claimed:true}}};
      }
      if (
        profile.completedTasks.some(
          (result) => result.taskId === id && result.successful,
        )
      )
        return profile;
      if (!evaluateProgramTask(task, answer))
        throw new DomainError("TASK_NOT_SUCCESSFUL");
      return completeTask(
        profile,
        {
          id: task.id,
          topic: "BUDGET_PLANNING",
          text: task.question,
          answer: true,
          explain: task.explanation,
          reward: task.reward.coins,
        },
        { answer: true, transactionId, completedAt },
      );
    });
  }
  async completeSituation(
    id: string,
    answer: number,
    now: string,
    replayId?: string,
  ): Promise<GameProfile> {
    return this.commit(() => {
      const profile = this.requireProfile();
      const index = situations.findIndex((s) => s.id === id);
      const situation = situations[index];
      const day =
        profile.currentPeriod?.index ?? profile.periodHistory.length + 1;
      if (
        !situation ||
        answer !== situation.correct ||
        situationDay(id) > day ||
        (index > 0 &&
          situationDay(situations[index - 1]!.id) === situationDay(id) &&
          !profile.completedSituationIds.includes(situations[index - 1]!.id))
      )
        throw new DomainError("INVALID_TASK_ACTION");
      if (replayId) {
        const round=profile.situationReplays[situationDay(id)], bundle=dailySituations(situationDay(id)), position=bundle.indexOf(id);
        if (!round || round.id!==replayId || profile.currentPeriod?.status!=="ACTIVE") throw new DomainError("INVALID_TASK_ACTION");
        if (round.claimed || round.completedIds.includes(id)) return profile;
        if(position<0 || (position>0 && !round.completedIds.includes(bundle[position-1]!))) throw new DomainError("INVALID_TASK_ACTION");
        return {...profile,updatedAt:now,situationReplays:{...profile.situationReplays,[situationDay(id)]:{...round,completedIds:[...round.completedIds,id]}}};
      }
      return awardSituationLearning(profile, id, now);
    });
  }
  async claimSituationReward(day: number, now: string, replayId?: string): Promise<GameProfile> {
    return this.commit(() => {
      const profile = this.requireProfile();
      if (replayId) {
        const round=profile.situationReplays[day], bundle=dailySituations(day);
        if(!round || round.id!==replayId) throw new DomainError("INVALID_TASK_ACTION");
        if(round.claimed) return profile;
        if(bundle.length!==6 || !bundle.every(id=>round.completedIds.includes(id))) throw new DomainError("INVALID_TASK_ACTION");
        const paid=this.replayReward(profile,10,`repeat-situations:${day}:${replayId}`,"EVENT_REWARD",now);
        return {...paid,situationReplays:{...paid.situationReplays,[day]:{...round,claimed:true}}};
      }
      const source = `program-10:day-${day}:situations`;
      if (profile.transactions.some(t => t.source === source)) return profile;
      const bundle = dailySituations(day), period = profile.currentPeriod;
      if (!period || period.status !== "ACTIVE" || day > period.index || bundle.length !== 6 || !bundle.every(id => profile.completedSituationIds.includes(id))) throw new DomainError("INVALID_TASK_ACTION");
      const reward = {id: source, type: "EVENT_REWARD" as const, amount: 10, source, category: "LEARNING" as const, periodId: period.id, createdAt: now, metadata: {situationDay: day}};
      const walletBalance = profile.walletBalance + 10;
      const transactions = [...period.transactions, reward];
      return {...profile, walletBalance, updatedAt:now, transactions:[...profile.transactions,reward], currentPeriod:{...period,transactions,budgetActual:calculateBudgetActual(transactions,walletBalance)}};
    });
  }
  async seeSituationEvolution(now: string): Promise<GameProfile> {
    return this.commit(() => ({
      ...this.requireProfile(),
      pendingEvolution: null,
      updatedAt: now,
    }));
  }
  async selectGoal(goalId: string, updatedAt: string): Promise<GameProfile> {
    if (!profileGoals(this.requireProfile()).some((goal) => goal.id === goalId))
      throw new DomainError("GOAL_NOT_SELECTED");
    return this.commit(() =>
      changeSavingsGoal(
        this.requireProfile(),
        goalId,
        profileGoals(this.requireProfile()).find(
          (g) => g.id === this.requireProfile().selectedGoalId,
        ),
        updatedAt,
      ),
    );
  }
  async finishPeriod(completedAt: string): Promise<GameProfile> {
    return this.commit(() => {
      const profile = advancePetNeeds(this.requireProfile(), completedAt);
      if (!profile.currentPeriod) throw new DomainError("NO_ACTIVE_PERIOD");
      if (
        !dayProgress(
          profile,
          completedAt,
          programDailyTasks(profile.currentPeriod?.index ?? 1).map(
            (task) => task.id,
          ),
          dailySituations(profile.currentPeriod.index),
        ).ready
      )
        throw new DomainError("DAY_NOT_READY");
      // Apply the current food-only daily requirement to an already open legacy day too.
      return closePeriod(
        {
          ...profile,
          currentPeriod: {
            ...profile.currentPeriod,
            mandatoryNeeds: profile.currentPeriod.mandatoryNeeds
              .filter((need) => need.id !== "care")
              .map((need) =>
                need.id === "food"
                  ? { ...need, purchaseIds: ["breakfast", "lunch", "snack"] }
                  : need,
              ),
          },
        },
        completedAt,
      );
    });
  }
  async refreshNeeds(now: string): Promise<GameProfile> {
    const profile = this.requireProfile();
    if (advancePetNeeds(profile, now) === profile) return profile;
    return this.commit(() => advancePetNeeds(this.requireProfile(), now));
  }
  async seeEvolution(periodId: string, now: string) {
    return this.commit(() =>
      acknowledgeEvolution(this.requireProfile(), periodId, now),
    );
  }
  async seeGoal(goalId: string, now: string) {
    const goal = profileGoals(this.requireProfile()).find(
      (g) => g.id === goalId,
    );
    if (!goal) throw new DomainError("GOAL_NOT_SELECTED");
    return this.commit(() => acknowledgeGoal(this.requireProfile(), goal, now));
  }
  async decideEvent(
    eventId: string,
    choiceId: string,
    transactionId: string,
    createdAt: string,
  ) {
    return this.commit(() => {
      const profile = this.requireProfile();
      const event = events.find((e) => e.id === eventId);
      if (
        !event ||
        periodEventId(profile.currentPeriod?.index ?? 0) !== eventId
      )
        throw new DomainError("INVALID_EVENT_ACTION");
      return resolveDecisionEvent(profile, event, choiceId, purchases, {
        transactionId,
        createdAt,
      });
    });
  }
  async careBetweenDays(
    need: "satiety" | "mood" | "care",
    transactionId: string,
    now: string,
  ): Promise<GameProfile> {
    return this.commit(() => {
      const profile = advancePetNeeds(this.requireProfile(), now);
      if (profile.currentPeriod) throw new DomainError("INVALID_TASK_ACTION");
      if (
        profile.transactions.some((t) => t.id === transactionId) ||
        profile.pet.state[need] > 20
      )
        return profile;
      const item = purchases.find(
        (p) =>
          p.id ===
          { satiety: "breakfast", mood: "balloon", care: "care" }[need],
      )!;
      // Emergency help only for red needs between days when both balances cannot cover care.
      const price =
        profile.walletBalance + profile.savingsBalance >= item.price
          ? item.price
          : 0;
      const withdrawal = Math.max(0, price - profile.walletBalance);
      const periodId = profile.periodHistory.at(-1)?.id ?? "before-first-day";
      const entries: GameProfile["transactions"] = [];
      if (withdrawal)
        entries.push({
          id: transactionId + ":withdraw",
          type: "SAVINGS_WITHDRAWAL",
          amount: withdrawal,
          source: "between-day-care",
          category: "SAVINGS",
          periodId,
          createdAt: now,
          metadata: { purchaseId: item.id },
        });
      if (price)
        entries.push({
          id: transactionId,
          type:
            item.kind === "mandatory"
              ? "PURCHASE_MANDATORY"
              : "PURCHASE_OPTIONAL",
          amount: price,
          source: "between-day-care",
          category: item.kind === "mandatory" ? "MANDATORY" : "OPTIONAL",
          periodId,
          createdAt: now,
          metadata: { purchaseId: item.id },
        });
      const state = { ...profile.pet.state };
      for (const key of ["satiety", "mood", "care"] as const)
        state[key] = Math.min(100, state[key] + (item.effect[key] ?? 0));
      return {
        ...profile,
        updatedAt: now,
        walletBalance: profile.walletBalance + withdrawal - price,
        savingsBalance: profile.savingsBalance - withdrawal,
        transactions: [...profile.transactions, ...entries],
        pet: { ...profile.pet, state },
      };
    });
  }
  async continueTogether(now: string): Promise<GameProfile> {
    return this.commit(() => {
      const profile = this.requireProfile();
      if (!programCompletion(profile).complete)
        throw new DomainError("PROGRAM_NOT_COMPLETE");
      return { ...profile, finaleSeen: true, updatedAt: now };
    });
  }
  async createCustomGoal(
    title: string,
    cost: number,
    id: string,
    now: string,
  ): Promise<GameProfile> {
    return this.commit(() => {
      const profile = this.requireProfile();
      if (!programCompletion(profile).complete)
        throw new DomainError("PROGRAM_NOT_COMPLETE");
      const parsed = GameProfileSchema.shape.customGoals
        .removeDefault()
        .element.safeParse({
          id,
          title,
          cost,
          assetId: "goal-custom",
          description: "Твоя особенная мечта",
        });
      if (!parsed.success) throw new DomainError("INVALID_CUSTOM_GOAL");
      if (profile.customGoals.some((goal) => goal.id === id)) return profile;
      const next = {
        ...profile,
        customGoals: [...profile.customGoals, parsed.data],
      };
      return changeSavingsGoal(
        next,
        id,
        profileGoals(profile).find(
          (goal) => goal.id === profile.selectedGoalId,
        ),
        now,
      );
    });
  }
  async startNewAdventure(command: CreateProfileCommand): Promise<GameProfile> {
    return this.commit(() => {
      const previous = this.requireProfile();
      if (!programCompletion(previous).complete)
        throw new DomainError("PROGRAM_NOT_COMPLETE");
      const achieved = profileGoals(previous).filter(
        (goal) =>
          previous.achievedGoalIds.includes(goal.id) ||
          (previous.selectedGoalId === goal.id &&
            previous.savingsBalance >= goal.cost),
      );
      const memory = {
        id: previous.id,
        pet: previous.pet,
        archivedAt: command.now,
        daysCompleted: previous.periodHistory.length,
        taskCount: new Set(
          previous.completedTasks
            .filter((task) => task.successful)
            .map((task) => task.taskId),
        ).size,
        situationCount: previous.completedSituationIds.length,
        walletBalance: previous.walletBalance,
        savingsBalance: previous.savingsBalance,
        dreams: achieved.map(({ id, title, cost }) => ({ id, title, cost })),
      };
      return {
        ...createInitialProfile({ ...command, demoMode: previous.demoMode }),
        petAlbum: [...previous.petAlbum, memory],
      };
    });
  }
  async resetDemo(): Promise<GameProfile> {
    const profile = {
      ...resetDemoProfile(),
      needsUpdatedAt: this.now().toISOString(),
    };
    await this.storage.resetProfile(profile, this.savedFingerprint);
    this.profile = profile;
    this.savedFingerprint = profileFingerprint(profile);
    return profile;
  }
  async resetGame(command: CreateProfileCommand): Promise<GameProfile> {
    const profile = createInitialProfile({ ...command, demoMode: false });
    await this.storage.resetProfile(profile, this.savedFingerprint);
    this.profile = profile;
    this.savedFingerprint = profileFingerprint(profile);
    return profile;
  }
  async deleteGame(): Promise<void> {
    await this.storage.deleteProfile(this.savedFingerprint);
    this.profile = null;
    this.savedFingerprint = null;
  }
}
