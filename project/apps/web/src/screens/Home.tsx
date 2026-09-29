import { usePetText } from "../application/game-context";
import { profileGoals } from "@finni/content";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { type GamePeriod, type PetState } from "@finni/shared";
import { goals, interfaceContent } from "@finni/content";
import { useGame } from "../application/game-context";
import {
  careAction,
  homeEmotion,
  dayStory,
  statusTone,
  type HomeAction,
  type HomeEvent,
} from "../application/home-events";
import { backgroundAssets } from "../assets/registry";
import { Art, BalanceBadge, Button, Modal } from "../components/ui";
import {
  budgetCategories,
  GameError,
  PlanPreview,
} from "../components/gameplay";
import { BottomNavigation, PetImage } from "../components/game";
import { EventDetails } from "../components/PeriodExtras";
import { DemoGuide } from "../components/demo";
import { NeedMeter, needLabel } from "../components/NeedMeter";
import { ResultDetails } from "./PeriodResult";
import { DailyRoutine, useDayProgress } from "../components/DailyRoutine";

export function Home() {
  const petText = usePetText();
  const readiness = useDayProgress();
  const game = useGame();
  const navigate = useNavigate();
  const [sheet, setSheet] = createSignal<
    "day" | "finish" | "result" | "story" | null
  >(null);
  const [finished, setFinished] = createSignal<GamePeriod>();
  const [paused, setPaused] = createSignal(false);
  const [hidden, setHidden] = createSignal(document.hidden);
  const visibility = () => setHidden(document.hidden);
  document.addEventListener("visibilitychange", visibility);
  onCleanup(() => document.removeEventListener("visibilitychange", visibility));
  const event = () => game.homeEvents.queue()[0];
  const goal = () => profileGoals(game.profile()).find((g) => g.id === game.profile()?.selectedGoalId);
  const day = () => game.profile()?.currentPeriod;
  const dayNumber = () =>
    day()?.index ?? (game.profile()?.periodHistory.length ?? 0) + 1;
  const closeSheet = () => {
    if (!game.busy()) {
      setSheet(null);
      game.clearError();
    }
  };
  const act = (action: HomeAction, current?: HomeEvent) => {
    // Starting an action is not completion: a cancelled task or purchase stays
    // available on return. Informational events can be acknowledged by opening.
    if (current?.timeout) game.homeEvents.dismiss(current.id);
    game.clearError();
    if (action.sheet) setSheet(action.sheet);
    else if (action.href) navigate(action.href);
  };
  createEffect(() => {
    const current = event();
    if (!current?.timeout || sheet() || paused() || hidden()) return;
    const timer = window.setTimeout(
      () => game.homeEvents.dismiss(current.id),
      current.expiresAt ? Math.max(0, current.expiresAt - Date.now()) : current.timeout,
    );
    onCleanup(() => window.clearTimeout(timer));
  });
  const finish = async () => {
    if (
      await game.perform((service) =>
        service.finishPeriod(new Date().toISOString()),
      )
    ) {
      setFinished(game.profile()!.periodHistory.at(-1));
      setSheet("result");
    }
  };
  const beginPlannedDay = async () => {
    if (
      await game.perform((service) =>
        service.confirmPlan(new Date().toISOString()),
      )
    )
      setSheet(null);
  };
  return (
    <Show when={game.profile()}>
      {(profile) => (
        <main
          class="home-screen"
          style={{ "background-image": `url("${backgroundAssets.room}")` }}
        >
          <div class="home-body">
            <header class="home-top">
              <div class="profile-badge">
                <PetImage
                  {...profile().pet.appearance}
                  stage={profile().pet.stage}
                  name={profile().pet.name}
                />
                <div>
                  <h1>{profile().pet.name}</h1>
                  <span>
                    {interfaceContent.stages[profile().pet.stage]}
                    <Show when={game.mode() === "demo"}>
                      <span aria-label="Включён демо-режим"> · Демо</span>
                    </Show>
                  </span>
                </div>
              </div>
              <BalanceBadge amount={profile().walletBalance} />
              <A
                href="/settings"
                class="icon-button settings-button"
                aria-label="Настройки"
              >
                <Art id="icon-settings" />
              </A>
            </header>
            <section class="pet-room" aria-label={petText("Дом Финни")}>
              <PetImage
                {...profile().pet.appearance}
                stage={profile().pet.stage}
                name={profile().pet.name}
                class="home-pet"
                emotion={homeEmotion(profile(), event())}
              />
            </section>
            <section class="home-status" aria-label={petText("Состояние Финни")}>
              <For each={interfaceContent.status}>
                {(stat) => {
                  const value = () =>
                    profile().pet.state[stat.id as keyof PetState];
                  return (
                    <button
                      class={`home-stat ${statusTone(value())}`}
                      aria-label={`${stat.title}: ${needLabel(stat.id as keyof PetState, value())}`}
                      onClick={() =>
                        act(careAction(profile(), stat.id as keyof PetState))
                      }
                    >
                      <Art id={stat.assetId} />
                      <NeedMeter
                        stat={stat.id as keyof PetState}
                        value={value()}
                        title={stat.title}
                      />
                    </button>
                  );
                }}
              </For>
            </section>
            <div class="home-event-slot" aria-live="polite" aria-atomic="true">
              <Show when={!sheet() && event()} keyed>
                {(current) => (
                  <section
                    class={`home-context-card ${current.type === "speech" ? "home-speech" : ""} ${current.type === "care" ? "home-care" : ""}`}
                    data-event-id={current.id}
                    data-event-type={current.type}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onFocusIn={() => setPaused(true)}
                    onFocusOut={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        setPaused(false);
                    }}
                  >
                    <div class="home-event-copy">
                      <Show when={current.assetId}>
                        {(id) => <Art id={id()} />}
                      </Show>
                      <div>
                        <h2>{current.title}</h2>
                        <p>{current.message}</p>
                      </div>
                    </div>
                    <Show when={current.dismissible}>
                      <button
                        class="home-event-dismiss"
                        aria-label="Закрыть сообщение"
                        onClick={() => {
                          setPaused(false);
                          game.homeEvents.dismiss(current.id);
                        }}
                      >
                        ×
                      </button>
                    </Show>
                    <Show when={current.action}>
                      {(action) => (
                        <Button
                          data-sound={["/day/evolution", "/day/start", "/finale"].includes(action().href ?? "") || (!day() && action().href === "/budget") ? "replace" : undefined}
                          onClick={() => {
                            setPaused(false);
                            act(action(), current);
                          }}
                        >
                          {action().label}
                        </Button>
                      )}
                    </Show>
                  </section>
                )}
              </Show>
            </div>
            <div class="home-progress">
              <button
                class="home-chip"
                aria-label={`План на день ${dayNumber()}`}
                onClick={() => {
                  game.clearError();
                  setSheet("day");
                }}
              >
                <Art id="icon-tasks" />
                <span>
                  День {dayNumber()} ·{" "}
                  {day()?.status === "ACTIVE" ? "план" : "начать"}
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <A
                class="home-chip home-goal-chip"
                href={goal() ? "/progress" : "/goal/select"}
                aria-label={
                  goal()
                    ? `Моя цель: ${goal()!.title}, ${profile().savingsBalance} из ${goal()!.cost}`
                    : "Выбрать мечту"
                }
              >
                <Art id={goal()?.assetId ?? "icon-goals"} />
                <span data-testid="goal-balance">
                  {goal()
                    ? `${profile().savingsBalance} / ${goal()!.cost}`
                    : "Мечта"}
                </span>
                <span aria-hidden="true">›</span>
              </A>
            </div>
          </div>
          <BottomNavigation />
          <Modal
            open={sheet() !== null}
            title={
              sheet() === "story"
                ? (dayStory(profile())?.title ?? "Событие дня")
                : sheet() === "finish"
                  ? "Завершить день?"
                  : sheet() === "result"
                    ? "Итоги дня"
                    : `День ${dayNumber()} · План`
            }
            onClose={closeSheet}
          >
            <Show when={sheet() === "day"}>
              <DemoGuide />
              <Show
                when={day()?.status === "ACTIVE"}
                fallback={
                  <Show
                    when={day()?.budgetPlan}
                    fallback={
                      <>
                        <p>Распределим монетки на нужное, желания и мечту.</p>
                        <A class="button" href="/budget" data-sound={!day() ? "replace" : undefined}>
                          {day() ? "Составить план" : "Начать день"}
                        </A>
                      </>
                    }
                  >
                    {(plan) => (
                      <>
                        <p>Сегодня твой план:</p>
                        <div class="plan-confirm">
                          <For each={budgetCategories}>
                            {(category) => (
                              <p>
                                {category.title}
                                <strong>{plan()[category.field]}</strong>
                              </p>
                            )}
                          </For>
                          <p>
                            Не распределено<strong>{plan().unallocated}</strong>
                          </p>
                        </div>
                        <p>
                          После начала дня план не меняется. Решения принимаешь
                          ты.
                        </p>
                        <GameError />
                        <Button
                          disabled={game.busy()}
                          onClick={beginPlannedDay}
                        >
                          Начать день
                        </Button>
                        <A class="text-link" href="/budget">
                          Изменить план
                        </A>
                      </>
                    )}
                  </Show>
                }
              >
                <PlanPreview profile={profile()} />
                <DailyRoutine />
                <Show when={dayStory(profile())}>
                  <Button class="secondary" onClick={() => setSheet("story")}>
                    {day()?.eventDecisions.some(decision => decision.eventId === dayStory(profile())?.id) ? "✓ " : ""}
                    {dayStory(profile())?.title} ›
                  </Button>
                </Show>
                <A class="text-link" href="/budget">
                  Открыть план дня
                </A>
                <Button class="secondary" onClick={() => setSheet("finish")}>
                  Завершить день
                </Button>
              </Show>
              <Show when={profile().periodHistory.at(-1)}>
                {(last) => (
                  <A class="text-link" href={`/day/result/${last().id}`}>
                    Итоги дня {last().index}
                  </A>
                )}
              </Show>
            </Show>
            <Show when={sheet() === "story"}>
              <EventDetails onClose={closeSheet} />
            </Show>
            <Show when={sheet() === "finish"}>
              <p>
                Подведём итоги, когда пройдут 30 минут и будут выполнены все дела
                дня.
              </p>
              <PlanPreview profile={profile()} />
              <DailyRoutine />
              <GameError />
              <Button
                disabled={game.busy() || !readiness()?.ready}
                onClick={finish}
              >
                Посмотреть итоги
              </Button>
            </Show>
            <Show when={sheet() === "result" && finished()}>
              {(result) => (
                <>
                  <div class="home-result-details">
                    <ResultDetails period={result()} />
                    <p>
                      Получено:{" "}
                      {result().income + result().budgetActual.earnedExtra}{" "}
                      монет · Потрачено:{" "}
                      {result().budgetActual.spentMandatory +
                        result().budgetActual.spentOptional}{" "}
                      монет
                    </p>
                  </div>
                  <A
                    class="button"
                    href={
                      profile().periodHistory.some((d) => !d.evolutionSeen)
                        ? "/day/evolution"
                        : "/day/start"
                    }
                  >
                    Начать следующий день
                  </A>
                </>
              )}
            </Show>
          </Modal>
        </main>
      )}
    </Show>
  );
}
