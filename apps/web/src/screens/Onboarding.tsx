import { usePetText } from "../application/game-context";
import { createSignal, For, Show } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { interfaceContent } from "@finni/content";
import { useGame } from "../application/game-context";
import { PetImage } from "../components/game";
import { Art, Button, ConfirmDialog, ScreenHeader } from "../components/ui";
import { bootDestination } from "../application/boot-route";

export function Onboarding() {
 const petText = usePetText();
  const game = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmDemo, setConfirmDemo] = createSignal(false);
  const step = () =>
    new URLSearchParams(location.search).get("step") === "concepts" ? 1 : 0;
  const finish = () => {
    const profile = game.profile();
    navigate(profile ? bootDestination(profile) : "/pet/create");
  };
  const launchDemo = async () => {
    setConfirmDemo(false);
    const profile = await game.startDemo();
    if (profile)
      navigate(profile.selectedGoalId ? "/home" : "/goal/select", {
        replace: true,
      });
  };
  return (
    <main class="setup-page onboarding">
      <Show
        when={step() > 0}
        fallback={
          <header class="welcome-brand">
            <Art id="logo-finni" alt="Финни" class="wordmark" />
          </header>
        }
      >
        <ScreenHeader
          back={game.profile() ? "/settings" : "/onboarding"}
          title="Знакомимся с монетками"
        />
      </Show>
      <div class="setup-content">
        <Show
          when={step() === 0}
          fallback={
            <>
              <span class="eyebrow">Три маленьких правила</span>
              <h1>
                На сегодня.
                <br />И для мечты.
              </h1>
              <div class="concept-list">
                <For each={interfaceContent.concepts}>
                  {(concept) => (
                    <article class={`concept concept-${concept.id}`}>
                      <Art id={concept.assetId} />
                      <div>
                        <h2>{concept.title}</h2>
                        <p>{petText(concept.text)}</p>
                      </div>
                    </article>
                  )}
                </For>
              </div>
              <Button onClick={finish}>
                {game.profile()
                  ? game.profile()?.selectedGoalId
                    ? petText("Вернуться к Финни")
                    : "Выбрать мечту"
                  : "Выбрать Финни"}{" "}
                <span aria-hidden="true">→</span>
              </Button>
            </>
          }
        >
          <div class="welcome-pet">
            <PetImage
              species={game.profile()?.pet.appearance.species ?? "cat"}
              colorVariant={
                game.profile()?.pet.appearance.colorVariant ?? "ginger"
              }
              stage={game.profile()?.pet.stage ?? "BABY"}
              emotion="happy"
              name={game.profile()?.pet.name ?? "Финни"}
            />
            <span class="hello-tag">Давай дружить!</span>
          </div>
          <h1>{interfaceContent.welcome.title}</h1>
          <p class="intro">{interfaceContent.welcome.intro}</p>
          <Button onClick={() => navigate("/onboarding?step=concepts")}>
            {interfaceContent.welcome.button} <span aria-hidden="true">→</span>
          </Button>
          <Show when={game.mode() !== "demo"}>
            <button
              type="button"
              class="demo-entry"
              onClick={() =>
                game.profile() ? setConfirmDemo(true) : launchDemo()
              }
              disabled={game.busy()}
            >
              <strong>Демо-режим</strong>
              <span>Посмотреть возможности Финни за несколько минут</span>
            </button>
          </Show>
          <span class="setup-note">
            Твоя маленькая история начинается здесь
          </span>
        </Show>
        <div
          class="step-dots"
          role="status"
          aria-live="polite"
          aria-label={`Знакомство, шаг ${step() + 1} из 2`}
        >
          <span aria-hidden="true" classList={{ current: step() === 0 }} />
          <span aria-hidden="true" classList={{ current: step() === 1 }} />
        </div>
      </div>
      <Show when={game.error()}>
        <p role="alert">{game.error()}</p>
      </Show>
      <ConfirmDialog
        open={confirmDemo()}
        title="Запустить демо?"
        text="Текущая игра сохранится. После демо можно будет вернуться к ней."
        confirmLabel="Запустить демо"
        cancelLabel="Отмена"
        onClose={() => setConfirmDemo(false)}
        onConfirm={launchDemo}
      />
    </main>
  );
}
