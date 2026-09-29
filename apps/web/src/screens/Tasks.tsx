import { usePetText } from "../application/game-context";
import { profileGoals, programCompletion } from "@finni/content";
import { For, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import {
  programTasks as tasks,
  goals,
  programDailyTasks,
  dailySituations,
  situations,
} from "@finni/content";
import { useGame } from "../application/game-context";
import { Art } from "../components/ui";
import { ActiveDayGate, GameScreen, WalletRow } from "../components/gameplay";
import { ProgramTaskRenderer } from "../components/ProgramTaskRenderer";
import { programAsset } from "../assets/registry";

export function Tasks() {
  const petText = usePetText();
  const game = useGame();
  const day = () => {
    const profile = game.profile();
    const value =
      profile?.currentPeriod?.index ?? (profile?.periodHistory.length ?? 0) + 1;
    return Math.max(1, value);
  };
  const dayStories = () => day() > 10 ? tasks : programDailyTasks(day());
  const situationIds = () => day() > 10 ? situations.map(s => s.id) : dailySituations(day());
  const situationsDone = () =>
    situationIds().filter((id) =>
      game.profile()?.completedSituationIds.includes(id),
    ).length;
  const goal = () => profileGoals(game.profile()).find((g) => g.id === game.profile()?.selectedGoalId);
  const isDone = (id: string) =>
    game
      .profile()
      ?.completedTasks.some(
        (result) => result.taskId === id && result.successful,
      ) ?? false;
  return (
    <GameScreen title="Задания">
      <h1>{day() <= 10 ? `Задания дня ${day()}` : (programCompletion(game.profile()!).tasks.length ? "Осталось завершить истории" : "Повторяем и зарабатываем")}</h1>
      <p>
        {day() <= 10 ? "Каждый день — два задания по 10 монет и шесть жизненных ситуаций. Открой ситуации ниже, чтобы выбрать следующую." : programCompletion(game.profile()!).tasks.length ? "Заверши пропущенные истории, чтобы увидеть общие итоги. Пройденные задания тоже можно повторять за 10 монет." : "Все задания доступны снова. Решай их заново и получай по 10 монет за каждое прохождение."}
      </p>
      <A class="situation-entry" href="/situations">
        <span class="situation-entry-icon" aria-hidden="true">
          📖
        </span>
        <div>
          <h2>
            {day() <= 10
              ? `Открыть ${situationIds().length} ситуаций дня`
              : situationsDone() < 60 ? "Завершить жизненные ситуации" : "Повторить жизненные ситуации"}
          </h2>
          <span>
            Решено {situationsDone()} из {situationIds().length} {petText("· помогают Финни расти")}</span>
        </div>
        <span aria-hidden="true">›</span>
      </A>
      <Show when={goal()}>
        {(goal) => (
          <A class="situation-entry goal-entry" href="/progress">
            <Art id={goal().assetId} />
            <div>
              <h2>Мечта: {goal().title}</h2>
              <span>
                {game.profile()?.savingsBalance} из {goal().cost} монет
              </span>
            </div>
            <span aria-hidden="true">›</span>
          </A>
        )}
      </Show>
      <ActiveDayGate>
        <h2>{day() <= 10 ? "Учебные истории дня" : "Истории программы"}</h2>
        <p>
          {petText("В историях можно передумать и попробовать ещё. За завершение — настоящие игровые монетки, а решения растят Финни.")}</p>
        <WalletRow />
        <Show when={day() <= 10 && dayStories().every((task) => isDone(task.id))}>
          <section class="all-tasks-complete" role="status">
            <h2>Истории дня пройдены! ⭐</h2>
            <p>{petText("Загляни в ситуации дня и продолжай заботиться о Финни.")}</p>
          </section>
        </Show>
        <div class="task-list">
          <For each={dayStories()}>
            {(task) => (
              <A class="task-list-card" href={`/tasks/${task.id}`}>
                <img class="art" src={programAsset(task.hero)} alt="" />
                <div>
                  <small>
                    День {task.day} · {task.petStage}
                  </small>
                  <h2>{task.title}</h2>
                  <span>
                    {isDone(task.id)
                      ? (day() > 10 ? "Повторить · +10 монет" : "✓ Выполнено")
                      : `+${task.reward.coins} монет`}
                  </span>
                </div>
                <span aria-hidden="true">›</span>
              </A>
            )}
          </For>
        </div>
      </ActiveDayGate>
      <details>
        <summary>Все задания программы · 20</summary>
        <div class="task-list">
          <For each={tasks}>
            {(task) => (
              <Show
                when={task.day <= day()}
                fallback={
                  <p>
                    День {task.day} · {task.title} 🔒
                  </p>
                }
              >
                <A class="task-list-card" href={`/tasks/${task.id}`}>
                  <img class="art" src={programAsset(task.hero)} alt="" />
                  <div>
                    <small>День {task.day}</small>
                    <h2>{task.title}</h2>
                    <span>{isDone(task.id) ? (day() > 10 ? "Повторить · +10 монет" : "✓ Выполнено") : "+10 монет"}</span>
                  </div>
                </A>
              </Show>
            )}
          </For>
        </div>
      </details>
    </GameScreen>
  );
}
export function TaskPlay() {
  const params = useParams();
  const task = () => tasks.find((task) => task.id === params.id);
  return (
    <GameScreen title="Учебная история" back="/tasks" focused>
      <ActiveDayGate>
        <Show
          when={task()}
          keyed
          fallback={
            <>
              <h1>Выберем другую историю</h1>
              <A class="button" href="/tasks">
                К заданиям
              </A>
            </>
          }
        >
          {(task) => <ProgramTaskRenderer task={task} />}
        </Show>
      </ActiveDayGate>
    </GameScreen>
  );
}
