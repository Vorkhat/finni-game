import { programCompletion } from "@finni/content";
import {
  createEffect,
  createSignal,
  ErrorBoundary,
  onCleanup,
  onMount,
  Show,
  type ParentProps,
} from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  GameProvider,
  useGame,
  bootDestination,
} from "./application/game-context";
import { Art, Button } from "./components/ui";
import { applyPreferences } from "./application/preferences";
import { focusIsInsideDialog } from "./application/heading-focus";
import { DemoBadge } from "./components/demo";
import { installNativeShell } from "./application/native-shell";

function UnexpectedError(props: { error: unknown; reset: () => void }) {
  const navigate = useNavigate();
  console.error("Unexpected Finni UI error", props.error);
  return (
    <main class="boot error-fallback">
      <Art id="logo-finni" alt="Финни" class="boot-logo" />
      <h1>Что-то пошло не так</h1>
      <p>Попробуйте вернуться на главный экран.</p>
      <Button
        onClick={() => {
          props.reset();
          navigate("/home", { replace: true });
        }}
      >
        На главную
      </Button>
    </main>
  );
}

function Guard(props: ParentProps) {
  const game = useGame();
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmRecovery, setConfirmRecovery] = createSignal(false);
  onMount(() => {
    const cleanup = installNativeShell({
      currentPath: () => location.pathname,
      goHome: () => navigate("/home", { replace: true }),
    });
    onCleanup(cleanup);
  });
  createEffect(() => {
    location.pathname;
    window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (heading && !focusIsInsideDialog(document.activeElement)) {
        heading.tabIndex = -1;
        heading.focus();
      }
    });
  });
  createEffect(() => {
    if (game.loading() || game.bootError()) return;
    const path = location.pathname;
    const profile = game.profile();
    if (profile && programCompletion(profile).complete && !profile.finaleSeen && !path.startsWith("/situations/") && !path.startsWith("/tasks/") && !["/finale", "/pet/new", "/settings", "/adult", "/adult/dashboard"].includes(path)) {
      navigate("/finale", {replace: true}); return;
    }
    if (profile && !programCompletion(profile).complete && path === "/finale") {navigate("/home", {replace: true}); return;}
    if (path === "/adult/dashboard" && !game.adultUnlocked()) {
      navigate("/adult", { replace: true });
      return;
    }
    if (
      (profile?.pendingEvolution ||
        profile?.periodHistory.some((p) => !p.evolutionSeen)) &&
      ["/day/start", "/budget"].includes(path)
    ) {
      navigate("/day/evolution", { replace: true });
      return;
    }
    if (["/", "/boot"].includes(path))
      navigate(bootDestination(profile), { replace: true });
    else if (!profile && !["/onboarding", "/pet/create"].includes(path))
      navigate("/onboarding", { replace: true });
    else if (profile && path === "/pet/create")
      navigate(bootDestination(profile), { replace: true });
    else if (
      profile &&
      !profile.selectedGoalId &&
      !["/home", "/goal/select", "/onboarding", "/settings", "/adult"].includes(
        path,
      )
    )
      navigate("/goal/select", { replace: true });
    else if (
      profile &&
      path.startsWith("/day/result/") &&
      !profile.periodHistory.some((period) => path.endsWith(`/${period.id}`))
    )
      navigate("/home", { replace: true });
    else if (
      profile &&
      path === "/day/result" &&
      profile.currentPeriod?.status !== "ACTIVE" &&
      profile.periodHistory.length === 0
    )
      navigate("/home", { replace: true });
    else if (
      profile &&
      path === "/day/evolution" &&
      !profile.pendingEvolution &&
      !profile.periodHistory.some((period) => !period.evolutionSeen)
    )
      navigate("/home", { replace: true });
  });
  applyPreferences();
  return (
    <Show
      when={!game.loading()}
      fallback={
        <div class="boot" role="status">
          <Art id="logo-finni" alt="Финни" class="boot-logo" />
          <p>Финни готовится к встрече…</p>
        </div>
      }
    >
      <Show
        when={!game.bootError()}
        fallback={
          <main class="boot recovery-screen">
            <h1>Не удалось открыть сохранённую игру</h1>
            <p>{game.bootErrorKind() === "future"
              ? "Сохранение создано более новой версией игры. Обновите приложение; данные сохранены."
              : game.bootErrorKind() === "corrupt"
                ? "Сохранение не удалось прочитать. Сначала скачайте его копию, затем можно начать новую игру."
                : "Хранилище сейчас недоступно. Проверьте настройки браузера и попробуйте ещё раз; данные не удалены."}</p>
            <Button onClick={game.boot}>Попробовать ещё раз</Button>
            <Show when={game.bootErrorKind() !== "unavailable"}>
              <Button onClick={game.exportUnopenedSave}>Скачать копию сохранения</Button>
            </Show>
            <Show when={game.bootErrorKind() === "corrupt" && game.recoveryExported()}>
            <Button
              class="danger-link"
              onClick={() => setConfirmRecovery(true)}
            >
              Начать новую игру
            </Button>
            <Show when={confirmRecovery()}>
              <section
                class="inline-confirm"
                role="alertdialog"
                aria-label="Начать новую игру?"
              >
                <h2>Начать новую игру?</h2>
                <p>
                  Повреждённое локальное сохранение будет удалено. Это действие
                  нельзя отменить.
                </p>
                <Button
                  class="danger"
                  onClick={async () => {
                    if (await game.recoverCorruptProfile())
                      navigate("/onboarding", { replace: true });
                  }}
                >
                  Удалить сохранение
                </Button>
                <Button
                  class="secondary"
                  onClick={() => setConfirmRecovery(false)}
                >
                  Отмена
                </Button>
              </section>
            </Show>
            </Show>
          </main>
        }
      >
        {props.children}
        <DemoBadge />
      </Show>
    </Show>
  );
}
export function App(props: ParentProps) {
  return (
    <GameProvider>
      <ErrorBoundary
        fallback={(error, reset) => (
          <UnexpectedError error={error} reset={reset} />
        )}
      >
        <Guard>{props.children}</Guard>
      </ErrorBoundary>
    </GameProvider>
  );
}
