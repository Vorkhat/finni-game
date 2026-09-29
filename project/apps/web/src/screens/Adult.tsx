import { usePetText } from "../application/game-context";
import { profileGoals, programTasks, situations } from "@finni/content";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { learningStatus, type LearningTopic } from "@finni/shared";
import { goals, interfaceContent, periodContent } from "@finni/content";
import { useGame } from "../application/game-context";
import {
  Art,
  Button,
  Card,
  ConfirmDialog,
  ProgressBar,
  ScreenHeader,
} from "../components/ui";

const HOLD_MS = 3000;

export function AdultGate() {
  const petText = usePetText();
  const game = useGame();
  const navigate = useNavigate();
  const [progress, setProgress] = createSignal(0);
  let startedAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const cancel = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    startedAt = 0;
    setProgress(0);
  };
  const complete = () => {
    cancel();
    setProgress(100);
    game.unlockAdult();
    navigate("/adult/dashboard", { replace: true });
  };
  const start = () => {
    if (timer || game.adultUnlocked()) return;
    startedAt = performance.now();
    timer = setInterval(() => {
      const next = Math.min(
        100,
        ((performance.now() - startedAt) / HOLD_MS) * 100,
      );
      setProgress(next);
      if (next >= 100) complete();
    }, 40);
  };
  onCleanup(cancel);
  return (
    <main class="adult-page adult-gate-page">
      <ScreenHeader title="Для взрослых" back="/settings" />
      <div class="adult-content gate-content">
        <Art id="logo-finni" alt="Финни" class="adult-logo" />
        <span class="eyebrow">Отдельный раздел</span>
        <h1>Для взрослых</h1>
        <p id="adult-gate-help">
          Чтобы продолжить, удерживайте кнопку 3 секунды.
        </p>
        <button
          type="button"
          class="hold-button"
          aria-describedby="adult-gate-help"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            start();
          }}
          onPointerUp={cancel}
          onPointerCancel={cancel}
          onLostPointerCapture={cancel}
          onKeyDown={(event) => {
            if ((event.key === " " || event.key === "Enter") && !event.repeat) {
              event.preventDefault();
              start();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") cancel();
          }}
          onBlur={cancel}
        >
          Удерживайте 3 секунды
        </button>
        <ProgressBar
          value={progress()}
          max={100}
          label={`Удержание кнопки: ${Math.round(progress())}%`}
          class="hold-progress"
        />
        <p class="field-hint" role="status">
          {progress() > 0
            ? "Продолжайте удерживать…"
            : "Отпустите — и отсчёт начнётся заново."}
        </p>
        <A class="button secondary" href="/home">
          {petText("Вернуться к Финни")}</A>
      </div>
    </main>
  );
}

const education = [
  [
    "Планирование бюджета",
    "Ребёнок сначала распределяет ограниченную сумму, а затем сравнивает план с фактическими действиями.",
  ],
  [
    "Нужное и желаемое",
    "Ребёнок учится отличать обязательные расходы от необязательных покупок.",
  ],
  [
    "Накопления",
    "Ребёнок выбирает финансовую цель и самостоятельно переводит игровые монеты в копилку.",
  ],
  [
    "Последствия решений",
    "Решения отражаются на состоянии и развитии виртуального питомца.",
  ],
] as const;

export function AdultDashboard() {
  const petText = usePetText();
  const game = useGame();
  onCleanup(game.lockAdult);
  const navigate = useNavigate();
  const [dialog, setDialog] = createSignal<"reset" | "delete" | null>(null);
  const profile = () => game.profile();
  const goal = () =>
    profileGoals(profile()).find((item) => item.id === profile()?.selectedGoalId);
  const reset = async () => {
    setDialog(null);
    if (await game.resetGame()) navigate("/goal/select", { replace: true });
  };
  const remove = async () => {
    setDialog(null);
    if (await game.deleteProfile()) {
      const next = game.profile();
      navigate(
        next ? (next.selectedGoalId ? "/home" : "/goal/select") : "/onboarding",
        { replace: true },
      );
    }
  };
  return (
    <main class="adult-page">
      <ScreenHeader title="Для взрослых" back="/settings" />
      <Show when={game.error()}>
        <p class="error-message" role="alert">
          {game.error()}
        </p>
      </Show>
      <Show when={profile()}>
        {(p) => (
          <div class="adult-content">
            <section class="adult-hero">
              <span class="eyebrow">Спокойный обзор без оценок</span>
              <h1>Как идёт знакомство с деньгами</h1>
              <p>Здесь видны темы, которые ребёнок уже пробовал в игре.</p>
            </section>

            <h2>Прогресс</h2>
            <div class="adult-stats">
              <Card>
                <strong>{p().pet.progress.completedPeriods}</strong>
                <span>завершено дней</span>
              </Card>
              <Card>
                <strong>{interfaceContent.stages[p().pet.stage]}</strong>
                <span>{petText("текущая стадия Финни")}</span>
              </Card>
              <Card>
                <strong>{programTasks.filter(t => p().completedTasks.some(r => r.successful && r.taskId === t.id)).length} / 20</strong>
                <span>выполнено заданий</span>
              </Card>
              <Card><strong>{situations.filter(s => p().completedSituationIds.includes(s.id)).length} / 60</strong><span>решено жизненных ситуаций</span></Card>
              <Card><strong>{p().currentPeriod?.index ?? p().periodHistory.length + 1}</strong><span>текущий день</span></Card>
            </div>

            <h2 id="adult-learning">Темы</h2>
            <div class="adult-topics">
              <For each={Object.entries(periodContent.topics)}>
                {([topic, title]) => (
                  <Card>
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
                  </Card>
                )}
              </For>
            </div>

            <h2>Цель</h2>
            <Card class="adult-goal">
              <Show when={goal()} fallback={<span>Цель пока не выбрана.</span>}>
                {(item) => (
                  <>
                    <Art id={item().assetId} alt={item().title} />
                    <div>
                      <strong>{item().title}</strong>
                      <span>
                        Накоплено {p().savingsBalance} из {item().cost} монет
                      </span>
                    </div>
                  </>
                )}
              </Show>
            </Card>

            <h2>Исполненные мечты</h2>
            <div class="adult-goals-completed"><For each={profileGoals(p()).filter(g => p().achievedGoalIds.includes(g.id) || (p().selectedGoalId === g.id && p().savingsBalance >= g.cost))}>{goal => <Card class="adult-goal"><Art id={goal.assetId} /><div><strong>{goal.title}</strong><span>✓ Выполнено · {goal.cost} монет</span></div></Card>}</For></div>
            <h2>Результаты всех дней</h2>
            <div class="adult-results">
              <Show
                when={p().periodHistory.length}
                fallback={<Card>Завершённых дней пока нет.</Card>}
              >
                <For each={[...p().periodHistory].reverse()}>
                  {(period) => (
                    <Card>
                      <strong>День {period.index}</strong>
                      <A class="text-link" href={`/day/result/${period.id}`}>Подробные итоги</A>
                      <Show
                        when={period.periodResult?.snapshot}
                        fallback={
                          <span>
                            День сыгран в более ранней версии. Подробная история
                            тогда ещё не сохранялась.
                          </span>
                        }
                      >
                        <span>
                          Нужно: {period.budgetActual.spentMandatory} · Хочу:{" "}
                          {period.budgetActual.spentOptional} · Коплю:{" "}
                          {period.budgetActual.savedActual}
                        </span>
                      </Show>
                    </Card>
                  )}
                </For>
              </Show>
            </div>

            <section class="adult-education" aria-labelledby="education-title">
              <h2 id="education-title">Чему учит Финни</h2>
              <For each={education}>
                {([title, text]) => (
                  <article>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                )}
              </For>
            </section>

            <section class="adult-privacy" aria-labelledby="privacy-title">
              <h2 id="privacy-title">О приложении и данных</h2>
              <ul>
                <li>
                  Только игровая валюта — реальных платежей и рекламы нет.
                </li>
                <li>Профиль хранится в этом браузере или приложении для текущего адреса игры.</li>
                <li>Настоящее имя, телефон и email ребёнка не требуются.</li>
                <li>Основной игровой цикл работает без интернета.</li>
              </ul>
            </section>

            <section
              class="adult-danger"
              aria-label="Управление локальным профилем"
            >
              <h2>Управление профилем</h2>
              <Button class="secondary" onClick={() => setDialog("reset")}>
                Сбросить прогресс
              </Button>
              <Button class="danger-link" onClick={() => setDialog("delete")}>
                Удалить профиль
              </Button>
            </section>
          </div>
        )}
      </Show>
      <ConfirmDialog
        open={dialog() === "reset"}
        title="Сбросить игровой прогресс?"
        text={petText("Финни, монетки, копилка, цели и история начнутся заново. Это действие нельзя отменить.")}
        confirmLabel="Сбросить"
        cancelLabel="Отмена"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={reset}
      />
      <ConfirmDialog
        open={dialog() === "delete"}
        title={petText("Удалить профиль Финни?")}
        text={game.mode() === "demo"
          ? "Демо-профиль в этом браузере будет удалён. Основной профиль сохранится. Данные в других браузерах и по другим адресам не изменятся."
          : "Основной и демо-профили в этом браузере будут удалены. Данные в других браузерах и по другим адресам не изменятся. Это действие нельзя отменить."}
        confirmLabel="Удалить профиль"
        cancelLabel="Отмена"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={remove}
      />
    </main>
  );
}
