import { personalizePetText } from "./pet-name";
import { dailySituations } from "@finni/content";
import { profileGoals } from "@finni/content";
import { assetRegistry } from "../assets/registry";
import {
  calculatePeriodScore,
  dayProgress,
  type GameProfile,
  type PetState,
} from "@finni/shared";
import {
  events,
  goals,
  periodContent,
  periodEventId,
  purchases,
  programTasks as tasks,
  programDailyTasks,
} from "@finni/content";

export const homePriority = {
  CRITICAL: 100,
  HIGH: 70,
  MEDIUM: 40,
  LOW: 10,
} as const;
export type HomeAction = {
  label: string;
  href?: string;
  sheet?: "day" | "finish" | "story";
};
export type HomeEvent = {
  id: string;
  type: string;
  priority: number;
  title: string;
  message: string;
  assetId?: string;
  action?: HomeAction;
  dismissible: boolean;
  timeout?: number;
  expiresAt?: number;
};
export type HomeMemory = {
  seen: string[];
  conditions?: string[];
  pending: HomeEvent[];
  snapshot?: {
    goalId: string | null;
    savings: number;
    transactionId: string | null;
  };
};
export const emptyHomeMemory = (): HomeMemory => ({ seen: [], pending: [] });
export const homeMemoryKey = (p: GameProfile) =>
  `finni.home-events.v1:${p.demoMode ? "demo" : "normal"}:${p.id}:${p.createdAt}`;
export const statusTone = (value: number) =>
  value <= 20 ? "alert" : value <= 50 ? "attention" : "calm";

export function homeEmotion(
  p: GameProfile,
  event?: HomeEvent,
): "happy" | "sad" | "idle" {
  if (Object.values(p.pet.state).some((value) => value <= 20)) return "sad";
  if (
    event &&
    (["reward", "achievement", "milestone"].includes(event.type) ||
      (event.type === "speech" && event.message === "Спасибо за заботу!") ||
      (event.type === "savings" && event.message.startsWith("+")))
  )
    return "happy";
  return Object.values(p.pet.state).some((value) => value < 30)
    ? "sad"
    : "idle";
}

export function dailyTask(p: GameProfile) {
  const day = p.currentPeriod;
  if (!day || day.status !== "ACTIVE") return undefined;
  const scheduled = programDailyTasks(day.index).map(task => task.id);
  return scheduled.length
    ? scheduled
        .map((id) => tasks.find((t) => t.id === id))
        .find((t) => t && !p.completedTasks.some((c) => c.taskId === t.id))
    : undefined;
}
export function dayStory(p: GameProfile) {
  return events.find(
    (e) => e.id === periodEventId(p.currentPeriod?.index ?? 0),
  );
}
export function readyToFinish(p: GameProfile, now = new Date().toISOString()) {
  const day = p.currentPeriod;
  return !!day?.budgetPlan?.confirmed && dayProgress(p, now, programDailyTasks(day.index).map(task => task.id), dailySituations(day.index)).ready;
}
export function careAction(
  _profile: GameProfile,
  stat: keyof PetState,
): HomeAction {
  const activity =
    stat === "satiety" ? "feed" : stat === "mood" ? "play" : "care";
  return {
    label:
      stat === "satiety"
        ? "Покормить"
        : stat === "care"
          ? "Позаботиться"
          : "Порадовать",
    href: `/shop?activity=${activity}&need=${stat}`,
  };
}

/** Observe committed game data, never mutate it or replay rewards from an old save. */
export function observeHome(p: GameProfile, memory: HomeMemory): HomeMemory {
  const previous = memory.snapshot;
  const pending = [...memory.pending.slice(-1)];
  const seen = [...memory.seen];
  const enqueue = (event: HomeEvent) => {
    if (!seen.includes(event.id) && !pending.some((e) => e.id === event.id))
      pending.splice(0, pending.length, event);
  };
  const goal = profileGoals(p).find((g) => g.id === p.selectedGoalId);
  if (previous && previous.goalId !== p.selectedGoalId && goal) {
    enqueue({
      id: `goal:${goal.id}:${p.updatedAt}`,
      type: "goal",
      priority: 75,
      title: "Новая мечта!",
      message: goal.title,
      assetId: goal.assetId,
      action: { label: "Посмотреть цель", href: "/progress" },
      dismissible: true,
      timeout: 12000,
    });
  }
  if (previous) {
    const index = previous.transactionId
      ? p.transactions.findIndex((t) => t.id === previous.transactionId)
      : -1;
    // A missing checkpoint means a replaced/imported save: establish a new baseline.
    const fresh =
      previous.transactionId && index < 0
        ? []
        : p.transactions.slice(index + 1);
    for (const t of fresh) {
      const base = {
        id: `transaction:${t.id}`,
        priority: homePriority.MEDIUM,
        dismissible: true,
        timeout: 10000,
      };
      if (t.type === "TASK_REWARD" || t.type === "EVENT_REWARD")
        enqueue({
          ...base,
          type: "reward",
          title:
            t.type === "TASK_REWARD"
              ? "Задание выполнено ✓"
              : "Получена награда",
          message: `+${t.amount} монет в кошельке`,
          assetId: "icon-coin",
        });
      if (t.type === "SAVINGS_DEPOSIT" || t.type === "SAVINGS_WITHDRAWAL")
        enqueue({
          ...base,
          type: "savings",
          title:
            t.type === "SAVINGS_DEPOSIT"
              ? "Ближе к мечте!"
              : "Монетки в кошельке",
          message: `${t.type === "SAVINGS_DEPOSIT" ? "+" : "−"}${t.amount} в копилке${goal ? ` · ${p.savingsBalance} / ${goal.cost}` : ""}`,
          assetId: "icon-savings",
        });
      if (t.type === "PURCHASE_MANDATORY" || t.type === "PURCHASE_OPTIONAL")
        enqueue({
          ...base,
          type: "speech",
          priority: homePriority.LOW,
          title: p.pet.name,
          message: "Спасибо за заботу!",
          dismissible: false,
          timeout: undefined,
          assetId: "icon-mood",
        });
    }
    if (goal && p.savingsBalance > previous.savings) {
      const milestone = [90, 75, 50, 25].find(
        (n) =>
          previous.savings < (goal.cost * n) / 100 &&
          p.savingsBalance >= (goal.cost * n) / 100,
      );
      if (milestone && p.savingsBalance < goal.cost)
        enqueue({
          id: `milestone:${goal.id}:${milestone}`,
          type: "milestone",
          priority: 45,
          title:
            milestone === 90
              ? "Мечта совсем близко!"
              : `${milestone}% мечты уже в копилке`,
          message: `${goal.title} · ${p.savingsBalance} / ${goal.cost}`,
          assetId: goal.assetId,
          dismissible: true,
          timeout: 12000,
        });
    }
  }
  const low = (Object.keys(p.pet.state) as (keyof PetState)[]).filter(
    (s) => p.pet.state[s] < 30,
  );
  // A recovered stat re-arms its alert for a future low-state episode.
  const nextSeen = seen.filter(
    (id) =>
      !id.startsWith("low:") || low.includes(id.slice(4) as keyof PetState),
  );
  return {
    seen: nextSeen,
    conditions: memory.conditions,
    pending: pending.filter(
      (e) =>
        (e.type !== "goal" || e.assetId === goal?.assetId) &&
        (e.type !== "milestone" ||
          (e.id.startsWith(`milestone:${goal?.id}:`) &&
            p.savingsBalance < (goal?.cost ?? 0))),
    ),
    snapshot: {
      goalId: p.selectedGoalId,
      savings: p.savingsBalance,
      transactionId: p.transactions.at(-1)?.id ?? null,
    },
  };
}

export function homeCandidates(
  p: GameProfile,
  memory: HomeMemory,
): HomeEvent[] {
  const result: HomeEvent[] = [...memory.pending];
  const add = (event: HomeEvent) => result.push(event);
  const day = p.currentPeriod;
  const dayNumber = day?.index ?? p.periodHistory.length + 1;
  const goal = profileGoals(p).find((g) => g.id === p.selectedGoalId);
  const evolution = p.periodHistory.find((d) => !d.evolutionSeen);
  if (evolution)
    add({
      id: `evolution:${evolution.id}`,
      type: "evolution",
      priority: 120,
      title: personalizePetText("Финни подрос!", p.pet.name),
      message: "Посмотрим, чему мы научились вместе.",
      action: { label: "Посмотреть", href: "/day/evolution" },
      dismissible: false,
    });
  if (!evolution && p.pendingEvolution)
    add({
      id: `situation-evolution:${p.pendingEvolution.to}`,
      type: "evolution",
      priority: 120,
      title: personalizePetText("Финни подрос!", p.pet.name),
      message: personalizePetText("Новая история помогла Финни вырасти.", p.pet.name),
      action: { label: "Посмотреть", href: "/day/evolution" },
      dismissible: false,
    });
  if (!goal)
    add({
      id: "choose-goal",
      type: "goal",
      priority: 115,
      title: "О чём будем мечтать?",
      message: "Выбери цель для нашей копилки.",
      assetId: "icon-goals",
      action: { label: "Выбрать мечту", href: "/goal/select" },
      dismissible: true,
    });
  const messages = {
    satiety: "Кажется, я проголодался…",
    mood: "Давай выберем что-нибудь для радости?",
    care: "Мне пригодится немного заботы.",
  };
  for (const stat of Object.keys(messages) as (keyof PetState)[]) {
    if (p.pet.state[stat] < 30)
      add({
        id: `low:${stat}`,
        type: "care",
        priority: 100 + (30 - p.pet.state[stat]) / 100,
        title: p.pet.name,
        message: messages[stat],
        assetId: `icon-${stat}`,
        action: careAction(p, stat),
        dismissible: true,
      });
  }
  if (!day || day.status === "PLANNING") {
    const plan = day?.budgetPlan;
    add({
      id: `start:${day?.id ?? `next-${dayNumber}`}`,
      type: "day",
      priority: 90,
      title: `День ${dayNumber}`,
      message: plan
        ? `Нужно — ${plan.plannedMandatory} · Хочу — ${plan.plannedOptional} · Коплю — ${plan.plannedSavings}`
        : "Сначала решим, на что пойдут монетки сегодня.",
      assetId: "icon-coin",
      action: plan
        ? { label: "Начать день", sheet: "day" }
        : { label: "Начать день", href: "/budget" },
      dismissible: true,
    });
  } else if (day.status === "ACTIVE") {
    const story = dayStory(p);
    if (story && !day.eventDecisions.some((d) => d.eventId === story.id))
      add({
        id: `story:${day.id}:${story.id}`,
        type: "story",
        priority: 80,
        title: story.title,
        message: "Новая история в нашем дне",
        assetId: story.assetId,
        action: { label: "Посмотреть", sheet: "story" },
        dismissible: true,
      });
    const task = dailyTask(p);
    if (task)
      add({
        id: `task:${day.id}:${task.id}`,
        type: "task",
        priority: homePriority.HIGH,
        title: "Задание дня",
        message: task.title,
        assetId: "icon-tasks",
        action: {
          label: `Начать · +${task.reward.coins} монет`,
          href: `/tasks/${task.id}`,
        },
        dismissible: true,
      });
    if (readyToFinish(p))
      add({
        id: `finish:${day.id}`,
        type: "finish",
        priority: 65,
        title: "День почти закончен",
        message: "Посмотрим, что получилось сегодня?",
        action: { label: "Завершить день", sheet: "finish" },
        dismissible: true,
      });
    add({
      id: `day-started:${day.id}`,
      type: "speech",
      priority: 15,
      title: `День ${dayNumber} начался`,
      message: "План готов. Теперь решаешь ты!",
      dismissible: true,
      timeout: 10000,
    });
  }
  if (
    goal &&
    p.savingsBalance >= goal.cost &&
    !p.achievedGoalIds.includes(goal.id)
  )
    add({
      id: `achieved:${goal.id}`,
      type: "achievement",
      priority: 85,
      title: "Мечта сбылась!",
      message: `${goal.title} · ${p.savingsBalance} / ${goal.cost}`,
      assetId: goal.assetId,
      action: { label: "К нашей мечте", href: "/progress" },
      dismissible: true,
      timeout: 15000,
    });
  if (tasks.every((t) => p.completedTasks.some((c) => c.taskId === t.id)))
    add({
      id: "all-tasks",
      type: "complete",
      priority: 45,
      title: "Все истории пройдены! ✓",
      message: personalizePetText("Продолжим заботиться о Финни и копить на мечту.", p.pet.name),
      dismissible: true,
      timeout: 12000,
    });
  if (!p.periodHistory.length && !p.completedTasks.length)
    add({
      id: "welcome",
      type: "speech",
      priority: homePriority.LOW,
      title: `Привет! Я ${p.pet.name}`,
      message: p.demoMode
        ? "Это демо. Начнём с плана, а подсказки помогут по пути."
        : "Здесь наш дом. Забота — под моими лапами, мечта и план — рядом.",
      dismissible: true,
      timeout: 12000,
    });
  return result
    .filter((e) => !memory.seen.includes(e.id))
    .sort((a, b) => b.priority - a.priority);
}
export function dismissHome(memory: HomeMemory, id: string): HomeMemory {
  return {
    ...memory,
    seen: [...new Set([...memory.seen, id])],
    pending: memory.pending.filter((e) => e.id !== id),
  };
}

export function readHomeMemory(raw: string | null): HomeMemory {
  try {
    const m = JSON.parse(raw ?? "null") as HomeMemory | null;
    if (
      !m ||
      !Array.isArray(m.seen) ||
      !m.seen.every((id) => typeof id === "string") ||
      !Array.isArray(m.pending)
    )
      return emptyHomeMemory();
    // UI state is disposable. Do not trust arbitrary cached routes or invalid events.
    const pending = m.pending.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.type === "string" &&
        typeof e.title === "string" &&
        typeof e.message === "string" &&
        Number.isFinite(e.priority) &&
        typeof e.dismissible === "boolean" &&
        (e.assetId === undefined ||
          (typeof e.assetId === "string" && e.assetId in assetRegistry)) &&
        (e.timeout === undefined ||
          (Number.isFinite(e.timeout) && e.timeout > 0)) &&
        (!e.action || e.action.href === "/progress"),
    );
    const snapshot =
      m.snapshot &&
      typeof m.snapshot.savings === "number" &&
      (typeof m.snapshot.goalId === "string" || m.snapshot.goalId === null) &&
      (typeof m.snapshot.transactionId === "string" ||
        m.snapshot.transactionId === null)
        ? m.snapshot
        : undefined;
    return { seen: m.seen, pending: [], snapshot, conditions: Array.isArray(m.conditions) ? m.conditions.filter(id => typeof id === "string") : undefined };
  } catch {
    return emptyHomeMemory();
  }
}
