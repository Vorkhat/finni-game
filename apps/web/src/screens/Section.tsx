import { usePetText } from "../application/game-context";
import { Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { interfaceContent, tasks } from "@finni/content";
import { useGame } from "../application/game-context";
import { Art, Card, ScreenHeader } from "../components/ui";
import { BottomNavigation, GoalCard } from "../components/game";

export function Section() {
  const petText = usePetText();
  const location = useLocation();
  const game = useGame();
  const section = () =>
    interfaceContent.sections[
      location.pathname as keyof typeof interfaceContent.sections
    ];
  const task = () =>
    tasks.find(
      (task) =>
        !game
          .profile()
          ?.completedTasks.some((result) => result.taskId === task.id),
    );
  return (
    <main class="section-page">
      <ScreenHeader title={section()?.title ?? "Этот путь пока закрыт"} />
      <div class="setup-content section-content">
        <Art id={section()?.assetId ?? "icon-home"} class="section-art" />
        <h1>{section()?.title ?? "Вернёмся домой?"}</h1>
        <p>{petText(section()?.text ?? "Финни ждёт тебя дома.")}</p>
        <Show when={location.pathname === "/tasks" && task()}>
          <Card>
            <span class="eyebrow">Следующая история</span>
            <h2>{task()?.title}</h2>
            <p>{task()?.intro}</p>
            <span>Награда: +{task()?.reward} монет</span>
          </Card>
        </Show>
        <Show when={location.pathname === "/progress" && game.profile()}>
          <GoalCard profile={game.profile()!} />
          <A class="text-link" href="/goal/select">
            Выбрать другую мечту
          </A>
        </Show>
        <p class="coming-soon">Продолжение скоро появится.</p>
        <A class="button" href="/home">
          {petText("К Финни")}</A>
      </div>
      <BottomNavigation />
    </main>
  );
}
