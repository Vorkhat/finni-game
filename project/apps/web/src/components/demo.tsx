import { Show } from "solid-js";
import { useLocation } from "@solidjs/router";
import { useGame } from "../application/game-context";

function demoStep() {
  const game = useGame();
  const location = useLocation();
  const profile = () => game.profile();
  const period = () => profile()?.currentPeriod;
  const transactions = () => period()?.transactions ?? [];
  const has = (type: string) =>
    transactions().some((item) => item.type === type);

  return () => {
    if (location.pathname.startsWith("/adult"))
      return {
        number: 12,
        text: "Посмотрите прогресс и информацию для взрослых.",
      };
    if (location.pathname.startsWith("/day/result"))
      return {
        number: 10,
        text: "Сравните план с фактом и посмотрите, как Финни себя чувствует.",
      };
    if (location.pathname === "/day/evolution")
      return {
        number: 11,
        text: "Финни растёт благодаря серии финансовых решений.",
      };
    if (!profile()?.selectedGoalId)
      return {
        number: 3,
        text: "Выберите мечту, на которую Финни будет копить.",
      };
    if (!period())
      return {
        number: profile()!.periodHistory.length ? 11 : 4,
        text: "Начните следующий день — ждать не нужно.",
      };
    if (period()?.status === "PLANNING")
      return {
        number: 5,
        text: "Составьте план: Нужно 40, Хочу 30, Коплю 30.",
      };
    if (!profile()?.completedTasks.length)
      return {
        number: 6,
        text: "Выполните финансовое задание и получите награду.",
      };
    if (!has("PURCHASE_MANDATORY"))
      return { number: 7, text: "Купите сначала то, что нужно Финни." };
    if (!has("PURCHASE_OPTIONAL"))
      return { number: 8, text: "Выберите покупку из раздела «Хочу»." };
    if (!has("SAVINGS_DEPOSIT"))
      return {
        number: 9,
        text: "Попробуйте дорогую покупку, затем положите монетки в копилку.",
      };
    return { number: 10, text: "Завершите день и сравните план с фактом." };
  };
}

export function DemoBadge() {
  const game = useGame();
  const location = useLocation();
  return (
    <Show when={game.mode() === "demo" && location.pathname !== "/home"}>
      <span class="demo-badge" aria-label="Включён демо-режим">
        Демо
      </span>
    </Show>
  );
}

export function DemoGuide() {
  const game = useGame();
  const step = demoStep();
  return (
    <Show when={game.mode() === "demo"}>
      <aside class="demo-guide" aria-label="Подсказка демо-режима">
        <strong>Шаг демо {step().number} из 12</strong>
        <span>{step().text}</span>
      </aside>
    </Show>
  );
}
