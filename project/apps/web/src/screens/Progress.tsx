import { programCompletion, programTasks } from "@finni/content";
import { profileGoals } from "@finni/content";
import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import {
  calculateGoalRemaining,
  learningStatus,
  type LearningTopic,
} from "@finni/shared";
import { goals, interfaceContent, periodContent } from "@finni/content";
import { useGame } from "../application/game-context";
import { GoalCard, PetImage } from "../components/game";
import { GameScreen } from "../components/gameplay";
import { GoalAchievement } from "../components/PeriodExtras";

export function Progress() {
  const game = useGame();
  const achieved = () =>
    profileGoals(game.profile()).some(
      (g) =>
        g.id === game.profile()?.selectedGoalId &&
        calculateGoalRemaining(game.profile()!, g) === 0,
    );
  return (
    <GameScreen title="Наш прогресс">
      <Show when={game.profile()}>
        {(p) => (
          <>
            <section class="progress-hero">
              <PetImage
                {...p().pet.appearance}
                stage={p().pet.stage}
                name={p().pet.name}
              />
              <span class="eyebrow">Растём вместе</span>
              <h1>{interfaceContent.stages[p().pet.stage]}</h1>
              <p>
                Завершено дней:{" "}
                <strong>{p().pet.progress.completedPeriods}</strong>
              </p>
              <p>
                Выполнено заданий: <strong>{programTasks.length - programCompletion(p()).tasks.length} из 20</strong>
              </p>
            </section>
            <GoalAchievement />
            <Show when={!achieved()}>
              <GoalCard profile={p()} />
            </Show>
            <A class="text-link" href="/goal/select">
              {p().achievedGoalIds.includes(p().selectedGoalId ?? "")
                ? "Выбрать новую мечту"
                : "Выбрать другую мечту"}
            </A>
            <Show when={programCompletion(p()).complete}>
              <A class="button secondary" href="/finale">
                Праздник нашей дружбы
              </A>
            </Show>
            <Show when={p().petAlbum.length}>
              <A class="button secondary" href="/pet/album">
                Альбом друзей
              </A>
            </Show>
            <h2>Чему учимся</h2>
            <div class="learning-topics">
              <For each={Object.entries(periodContent.topics)}>
                {([topic, title]) => (
                  <section>
                    <strong>{title}</strong>
                    <span>
                      {
                        periodContent.learningStatuses[
                          learningStatus(
                            p().learningProgress[topic as LearningTopic]
                              .completedTasks,
                          )
                        ]
                      }
                    </span>
                  </section>
                )}
              </For>
            </div>
            <Show when={p().periodHistory.at(-1)}>
              {(last) => (
                <A class="button secondary" href={`/day/result/${last().id}`}>
                  Последний результат · День {last().index}
                </A>
              )}
            </Show>
            <h2 id="history">История дней</h2>
            <div class="day-history" aria-label="История дней">
              <Show
                when={p().periodHistory.length}
                fallback={<p>Первый день ещё впереди. Начнём нашу историю!</p>}
              >
                <For each={[...p().periodHistory].reverse()}>
                  {(day) => (
                    <A class="history-card" href={`/day/result/${day.id}`}>
                      <h3>
                        День {day.index} <span>Завершён</span>
                      </h3>
                      <p class="hint">Факт / план, в монетах</p>
                      <For
                        each={
                          [
                            ["Нужно", day.periodResult?.planVsActual.mandatory],
                            ["Хочу", day.periodResult?.planVsActual.optional],
                            ["Коплю", day.periodResult?.planVsActual.savings],
                          ] as const
                        }
                      >
                        {([label, pair]) => (
                          <div>
                            <span>{label}</span>
                            <strong>
                              {pair?.actual} / {pair?.planned}
                            </strong>
                          </div>
                        )}
                      </For>
                    </A>
                  )}
                </For>
              </Show>
            </div>
          </>
        )}
      </Show>
    </GameScreen>
  );
}
