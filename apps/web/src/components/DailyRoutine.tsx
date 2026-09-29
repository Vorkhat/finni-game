import { usePetText } from "../application/game-context";
import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { dayProgress } from "@finni/shared";
import { programDailyTasks, dailySituations } from "@finni/content";
import { useGame } from "../application/game-context";

export function useDayProgress() {
  const game = useGame();
  return () => {
    const profile = game.profile();
    const day = profile?.currentPeriod?.index ?? 1;
    return profile
      ? dayProgress(
          profile,
          game.clock(),
          programDailyTasks(day).map((task) => task.id),
          dailySituations(day),
        )
      : null;
  };
}
export function DailyRoutine() {
  const petText = usePetText();
  const game = useGame();
  const progress = useDayProgress();
  const learning = () => (game.profile()?.currentPeriod?.index ?? 1) <= 10;
  const labels = () => ({
    satiety: petText("Покормить Финни"),
    mood: "Поднять настроение",
    care: "Позаботиться о чистоте",
  });
  const activities = { satiety: "feed", mood: "play", care: "care" };
  const minutes = () => Math.ceil((progress()?.remainingMs ?? 0) / 60000);
  const missing = () =>
    [
      progress()?.remainingMs ? `подождать ${minutes()} мин` : "",
      !progress()?.task ? "выполнить два задания" : "",
      !progress()?.situations ? "решить шесть ситуаций" : "",
      !progress()?.feed ? petText("покормить Финни") : "",
      progress()?.redNeeds.length
        ? petText("позаботиться о потребностях Финни, отмеченных красным")
        : "",
    ].filter(Boolean);
  return (
    <Show when={game.profile()?.currentPeriod?.status === "ACTIVE"}>
      <section class="daily-routine" aria-label="Дела дня">
        <h2>Дела дня</h2>
        <Show when={learning()}>
          <A class="button secondary" href="/tasks">
            {progress()?.task
              ? "✓ Задания выполнены"
              : "Выполнить 2 задания дня"}
          </A>
          <A class="button secondary" href="/situations">
            {progress()?.situations
              ? "✓ Шесть ситуаций решены"
              : "Решить 6 ситуаций дня"}
          </A>
        </Show>
        <A class="button secondary" href="/shop?activity=feed&need=satiety">
          {progress()?.feed ? petText("✓ Сегодня Финни поел") : petText("Покормить Финни")}
        </A>
        <For each={progress()?.redNeeds ?? []}>
          {(need) => (
            <A
              class="button secondary"
              href={`/shop?activity=${activities[need]}&need=${need}`}
            >
              {labels()[need]} · нужна помощь
            </A>
          )}
        </For>
        <p role="status">
          {missing().length
            ? `Чтобы завершить день, осталось: ${missing().join("; ")}.`
            : "Все дела выполнены — можно подвести итоги!"}
        </p>
        <Show when={minutes() > 0}>
          <p class="hint">Можно закрыть игру и вернуться позже.</p>
        </Show>
      </section>
    </Show>
  );
}
