import { usePetText } from "../application/game-context";
import { For } from "solid-js";
import { useGame } from "../application/game-context";
import { Button } from "./ui";
import { GameError } from "./gameplay";
export function BeforeDayCare() {
  const petText = usePetText();
  const game = useGame();
  const needs = () =>
    (["satiety", "mood", "care"] as const).filter(
      (need) => (game.profile()?.pet.state[need] ?? 100) <= 20,
    );
  return (
    <section class="daily-routine">
      <h1>{petText("Поможем Финни перед новым днём")}</h1>
      <p>Когда красных шкал не останется, можно будет начать день.</p>
      <For each={needs()}>
        {(need) => {
          const title = {
            satiety: petText("Покормить Финни"),
            mood: "Поиграть вместе",
            care: petText("Умыть Финни"),
          }[need];
          const price = { satiety: 20, mood: 15, care: 15 }[need];
          const free = () =>
            game.profile()!.walletBalance + game.profile()!.savingsBalance <
            price;
          const fromSavings = () =>
            Math.max(0, price - game.profile()!.walletBalance);
          return (
            <div>
              <p>
                {free()
                  ? "Монет пока не хватает — домашняя забота поможет бесплатно."
                  : fromSavings()
                    ? `Часть цены — ${fromSavings()} монет — возьмём из копилки.`
                    : ""}
              </p>
              <Button
                disabled={game.busy()}
                onClick={() =>
                  game.perform((service) =>
                    service.careBetweenDays(
                      need,
                      crypto.randomUUID(),
                      new Date().toISOString(),
                    ),
                  )
                }
              >
                {title} · {free() ? "бесплатно" : `${price} монет`}
              </Button>
            </div>
          );
        }}
      </For>
      <GameError />
    </section>
  );
}
