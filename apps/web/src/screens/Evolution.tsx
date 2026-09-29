import { usePetText } from "../application/game-context";
import { playGameSound } from "../application/sounds";
import { onMount, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { interfaceContent, periodContent } from "@finni/content";
import { useGame } from "../application/game-context";
import { PetImage } from "../components/game";
import { Button } from "../components/ui";
import { GameError, GameScreen } from "../components/gameplay";

export function Evolution() {
  const petText = usePetText();
  const game = useGame();
  const navigate = useNavigate();
  const pending = () =>
    game.profile()?.periodHistory.find((p) => !p.evolutionSeen);
  const change = () =>
    pending()?.periodResult?.petStageChange ?? game.profile()?.pendingEvolution;
  const copy = () =>
    periodContent.evolution[
      change()?.to === "FINNI_PRO" ? "FINNI_PRO" : "EXPLORER"
    ];
  onMount(() => { if (change()) playGameSound("milestone"); });
  const continueGame = async () => {
    const id = pending()?.id;
    if (
      await game.perform((service) =>
        id
          ? service.seeEvolution(id, new Date().toISOString())
          : service.seeSituationEvolution(new Date().toISOString()),
      )
    )
      navigate("/home", { replace: true });
  };
  return (
    <GameScreen title={petText("Финни растёт")} focused>
      <Show
        when={change()}
        fallback={
          <>
            <h1>{petText("Финни продолжает расти")}</h1>
            <A class="button" href="/home">
              {petText("К Финни")}</A>
          </>
        }
      >
        <section class="evolution-celebration">
          <span class="eyebrow">Новая ступень вашей истории</span>
          <h1>{petText(copy().title)}</h1>
          <div
            class="evolution-stage"
            aria-label={`Новая стадия: ${interfaceContent.stages[change()!.to]}`}
          >
            <div class="evolution-glow" aria-hidden="true" />
            <span class="evolution-spark spark-one" aria-hidden="true">
              ✦
            </span>
            <span class="evolution-spark spark-two" aria-hidden="true">
              ✧
            </span>
            <span class="evolution-spark spark-three" aria-hidden="true">
              ✦
            </span>
            <PetImage
              {...game.profile()!.pet.appearance}
              stage={change()!.from}
              name={game.profile()!.pet.name}
              class="evolution-old"
            />
            <PetImage
              {...game.profile()!.pet.appearance}
              stage={change()!.to}
              name={game.profile()!.pet.name}
              emotion="happy"
              class="evolution-new"
            />
          </div>
          <h2>{interfaceContent.stages[change()!.to]}</h2>
          <p>{petText(copy().text)}</p>
          <GameError />
          <Button disabled={game.busy()} onClick={continueGame}>
            Продолжить вместе
          </Button>
        </section>
      </Show>
    </GameScreen>
  );
}
