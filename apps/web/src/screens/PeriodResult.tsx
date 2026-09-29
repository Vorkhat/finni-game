import { usePetText } from "../application/game-context";
import { profileGoals } from "@finni/content";
import { For, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import {
  comparisonMaximum,
  goalRemainingForBalance,
  type GamePeriod,
} from "@finni/shared";
import {
  feedback,
  goals,
  interfaceContent,
  periodContent,
} from "@finni/content";
import { useGame } from "../application/game-context";
import { Art, Button, ProgressBar } from "../components/ui";
import {
  budgetCategories,
  GameError,
  GameScreen,
} from "../components/gameplay";
import { PetStatus } from "../components/game";
import { GoalAchievement } from "../components/PeriodExtras";
import { DailyRoutine, useDayProgress } from "../components/DailyRoutine";

export function ResultDetails(props: { period: GamePeriod }) {
  const petText = usePetText();
  const game = useGame();
  const result = () => props.period.periodResult!;
  const snapshot = () => result().snapshot;
  const goal = () => profileGoals(game.profile()).find((g) => g.id === snapshot()?.selectedGoalId);
  return (
    <>
      <span class="eyebrow">День {props.period.index} · Завершён</span>
      <h1>Как прошёл день?</h1>
      <p>План — что задумали. Факт — что получилось, в монетах.</p>
      <div class="result-comparisons" role="region" aria-label="План и факт">
        <For each={budgetCategories}>
          {(category) => {
            const pair = () => result().planVsActual[category.simulation];
            return (
              <section
                class={`result-category result-${category.simulation}`}
                aria-label={category.title}
              >
                <h2>
                  <Art id={category.assetId} />
                  {category.title}
                </h2>
                <div class="comparison-row">
                  <span>План</span>
                  <strong>{pair().planned}</strong>
                </div>
                <ProgressBar
                  class="plan-bar"
                  value={pair().planned}
                  max={comparisonMaximum(result().planVsActual)}
                  label={`${category.title}: план ${pair().planned} монет`}
                />
                <div class="comparison-row">
                  <span>
                    {category.simulation === "savings"
                      ? "Отложили"
                      : "Потратили"}
                  </span>
                  <strong>{pair().actual}</strong>
                </div>
                <ProgressBar
                  value={pair().actual}
                  max={comparisonMaximum(result().planVsActual)}
                  label={`${category.title}: факт ${pair().actual} монет`}
                />
              </section>
            );
          }}
        </For>
      </div>
      <section class="result-feedback" aria-label="Что получилось и почему">
        <h2>Что получилось и почему</h2>
        <For each={result().feedbackCodes.slice(0, 3)}>
          {(code) => <p>{petText(feedback.find((f) => f.code === code)?.text ?? "")}</p>}
        </For>
      </section>
      <section class="result-balances" aria-label="Баланс в конце дня">
        <div>
          <Art id="icon-coin" />
          <span>Осталось в кошельке</span>
          <strong>{props.period.budgetActual.remainingBalance} монет</strong>
        </div>
        <Show when={snapshot()}>
          {(s) => (
            <div>
              <Art id="icon-savings" />
              <span>В копилке</span>
              <strong>{s().savingsBalance} монет</strong>
            </div>
          )}
        </Show>
      </section>
      <Show when={goal()}>
        {(g) => (
          <p>
            Мечта: {g().title}. Осталось{" "}
            {goalRemainingForBalance(snapshot()!.savingsBalance, g())} монет.
          </p>
        )}
      </Show>
      <Show
        when={snapshot()}
        fallback={
          <p class="hint">
            Этот день был сыгран в более ранней версии Финни. Подробности не
            сохранились.
          </p>
        }
      >
        {(s) => (
          <>
            <h2>{petText("Как Финни?")}</h2>
            <PetStatus state={s().petState} />
            <section class="progress-note">
              <Art id="icon-goals" />
              <div>
                <h2>{petText("Финни растёт вместе с тобой")}</h2>
                <p>
                  {interfaceContent.stages[result().petStageChange.to]} · Дней
                  вместе: {s().petProgress.completedPeriods}
                </p>
                <p>
                  Забота, планирование, накопления и новые знания помогают ему
                  развиваться.
                </p>
              </div>
            </section>
          </>
        )}
      </Show>
    </>
  );
}

export function PeriodResult() {
  const readiness = useDayProgress();
  const game = useGame();
  const params = useParams();
  const active = () =>
    !params.id && game.profile()?.currentPeriod?.status === "ACTIVE";
  const period = () =>
    params.id
      ? game.profile()?.periodHistory.find((p) => p.id === params.id)
      : game.profile()?.periodHistory.at(-1);
  const finish = () =>
    game.perform((service) => service.finishPeriod(new Date().toISOString()));
  return (
    <GameScreen title="Итоги дня">
      <Show
        when={!active()}
        fallback={
          <section class="day-intro">
            <Art id="icon-goals" />
            <h1>Закончить день?</h1>
            <p>После этого посмотрим, как получилось следовать нашему плану.</p>
            <GameError />
            <DailyRoutine />
            <Button
              disabled={game.busy() || !readiness()?.ready}
              onClick={finish}
            >
              Посмотреть итоги
            </Button>
            <A class="button secondary" href="/home">
              Ещё не закончил
            </A>
          </section>
        }
      >
        <Show
          when={period()?.periodResult && period()}
          fallback={
            <>
              <h1>Итоги ещё впереди</h1>
              <A class="button" href="/budget">
                Составить план
              </A>
            </>
          }
        >
          {(p) => (
            <>
              <ResultDetails period={p()} />
              <Show when={!params.id}>
                <GoalAchievement />
                <p class="hint">{periodContent.recovery}</p>
                <A
                  class="button"
                  href={
                    !p().evolutionSeen
                      ? "/day/evolution"
                      : game.profile()?.currentPeriod
                        ? "/home"
                        : "/day/start"
                  }
                >
                  Следующий день
                </A>
              </Show>
              <A class="button secondary" href="/progress">
                История дней
              </A>
            </>
          )}
        </Show>
      </Show>
    </GameScreen>
  );
}
