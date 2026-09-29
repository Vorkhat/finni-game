import { usePetText } from "../application/game-context";
import { createSignal, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
  readPreferences,
  savePreferences,
  type Preferences,
} from "../application/preferences";
import { useGame } from "../application/game-context";
import { Button, Card, ConfirmDialog, ScreenHeader } from "../components/ui";

type SettingsDialog = "tutorial" | "demo" | "restart" | "exit" | "new-game" | null;

export function Settings() {
  const petText = usePetText();
  const game = useGame();
  const [preferences, setPreferences] = createSignal(readPreferences());
  const [dialog, setDialog] = createSignal<SettingsDialog>(null);
  const [error, setError] = createSignal("");
  const navigate = useNavigate();
  const change = (key: keyof Preferences, value: boolean) => {
    const next = { ...preferences(), [key]: value };
    try {
      savePreferences(next);
      setPreferences(next);
      setError("");
    } catch {
      setError("Настройки не сохранились. Попробуй ещё раз.");
    }
  };
  const startDemo = async () => {
    setDialog(null);
    const profile = await game.startDemo();
    if (profile)
      navigate(profile.selectedGoalId ? "/home" : "/goal/select", {
        replace: true,
      });
  };
  const exitDemo = async () => {
    setDialog(null);
    const profile = await game.exitDemo();
    navigate(
      profile
        ? profile.selectedGoalId
          ? "/home"
          : "/goal/select"
        : "/onboarding",
      { replace: true },
    );
  };
  const restartDemo = async () => {
    setDialog(null);
    if (await game.resetGame()) navigate("/goal/select", { replace: true });
  };
  return (
    <main class="setup-page">
      <ScreenHeader title="Настройки" />
      <div class="setup-content settings-content">
        <h1>Как тебе удобнее?</h1>
        <Card>
          <label class="toggle-row">
            <span>
              <strong>Звук</strong>
              <small>Звуки нажатий, ответов, монет и событий</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={preferences().sound}
              onChange={(e) => change("sound", e.currentTarget.checked)}
            />
          </label>
          <label class="toggle-row">
            <span>
              <strong>Анимации</strong>
              <small>{petText("Плавные движения Финни")}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={preferences().animations}
              onChange={(e) => change("animations", e.currentTarget.checked)}
            />
          </label>
        </Card>
        <p class="field-hint">
          Настройка уменьшения движения на устройстве действует всегда.
        </p>
        <Button class="secondary" onClick={() => setDialog("tutorial")}>
          Повторить обучение
        </Button>
        <A class="button secondary" href="/adult">
          Для взрослых
        </A>
        <Show
          when={game.mode() === "demo"}
          fallback={
            <Button class="demo-action" onClick={() => setDialog("demo")}>
              Демо-режим
            </Button>
          }
        >
          <section class="settings-demo" aria-label="Управление демо-режимом">
            <strong>Сейчас включено демо</strong>
            <Button class="secondary" onClick={() => setDialog("restart")}>
              Начать демо заново
            </Button>
            <Button class="secondary" onClick={() => setDialog("exit")}>
              Выйти из демо
            </Button>
          </section>
        </Show>
        <Show when={game.mode() !== "demo" && game.profile()}><Button class="secondary" onClick={() => setDialog("new-game")}>Начать игру сначала</Button></Show>
        <p role="status">{error() || game.error()}</p>
      </div>
      <ConfirmDialog open={dialog() === "new-game"} title="Начать игру сначала?" text="Текущий питомец, монеты, мечты, альбом и история будут удалены. Ты сможешь выбрать нового друга. Отменить сброс нельзя." confirmLabel="Сбросить и начать сначала" cancelLabel="Отмена" destructive onClose={() => setDialog(null)} onConfirm={async () => { if (game.busy()) return; if (await game.deleteProfile()) {setDialog(null); navigate("/pet/create", {replace:true});} }} />
      <ConfirmDialog
        open={dialog() === "tutorial"}
        title="Вспомним правила?"
        text={petText("Ещё раз посмотрим, что такое «Нужно», «Хочу» и «Коплю». Финни, монетки и мечта сохранятся.")}
        confirmLabel="Повторить обучение"
        cancelLabel="Отмена"
        onClose={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          navigate("/onboarding");
        }}
      />
      <ConfirmDialog
        open={dialog() === "demo"}
        title="Запустить демо?"
        text="Текущая игра сохранится. После демо можно будет вернуться к ней."
        confirmLabel="Запустить демо"
        cancelLabel="Отмена"
        onClose={() => setDialog(null)}
        onConfirm={startDemo}
      />
      <ConfirmDialog
        open={dialog() === "restart"}
        title="Начать демо заново?"
        text="Прогресс демо вернётся к одинаковому начальному состоянию. Обычная игра не изменится."
        confirmLabel="Начать заново"
        cancelLabel="Отмена"
        onClose={() => setDialog(null)}
        onConfirm={restartDemo}
      />
      <ConfirmDialog
        open={dialog() === "exit"}
        title="Выйти из демо?"
        text="Обычная игра восстановится в том же состоянии, в котором вы её оставили."
        confirmLabel="Выйти из демо"
        cancelLabel="Остаться в демо"
        onClose={() => setDialog(null)}
        onConfirm={exitDemo}
      />
    </main>
  );
}
