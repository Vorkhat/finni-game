import { usePetText } from "../application/game-context";
import { programCompletion } from "@finni/content";
import { profileGoals } from "@finni/content";
import { createEffect, createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { goals } from "@finni/content";
import { useGame } from "../application/game-context";
import { Art, Button, ScreenHeader } from "../components/ui";

export function GoalSelect() {
  const petText = usePetText();
  const game = useGame();
  const [dreamTitle, setDreamTitle] = createSignal("");
  const [dreamCost, setDreamCost] = createSignal(200);
  const createDream = async (event: SubmitEvent) => {
    event.preventDefault();
    if (
      await game.perform((service) =>
        service.createCustomGoal(
          dreamTitle(),
          dreamCost(),
          `custom:${crypto.randomUUID()}`,
          new Date().toISOString(),
        ),
      )
    )
      navigate("/home", { replace: true });
  };
  const navigate = useNavigate();
  const availableGoals = () =>
    profileGoals(game.profile()).filter(
      (g) => !game.profile()?.achievedGoalIds.includes(g.id),
    );
  const draftKey = `finni.goal-draft:${game.profile()?.id}`;
  let draft: string | null = null;
  try {
    draft = localStorage.getItem(draftKey);
  } catch {
    /* Optional draft. */
  }
  const [selected, setSelected] = createSignal(
    availableGoals().find((g) => g.id === draft)?.id ??
      availableGoals().find((g) => g.id === game.profile()?.selectedGoalId)
        ?.id ??
      availableGoals()[0]?.id ??
      goals[0]!.id,
  );
  createEffect(() => {
    try {
      localStorage.setItem(draftKey, selected());
    } catch {
      /* Final save reports errors. */
    }
  });
  const finish = async () => {
    if (!availableGoals().length) {
      navigate("/home", { replace: true });
      return;
    }
    if (
      await game.perform((service) =>
        service.selectGoal(selected(), new Date().toISOString()),
      )
    ) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* Optional draft. */
      }
      navigate("/home", { replace: true });
    }
  };
  return (
    <main class="setup-page">
      <ScreenHeader back="/home" />
      <div class="setup-content goal-select">
        <span class="eyebrow">Большая мечта, маленькие шаги</span>
        <h1>
          О чём будем
          <br />
          мечтать сначала?
        </h1>
        <p class="intro">Выбери цель для своей копилки.</p>
        <Show when={game.profile()?.selectedGoalId}>
          <p>
            Новая копилка начинается с нуля. Если на прошлую мечту уже накопили
            — оплатим её, а лишние монеты вернём в кошелёк. Если ещё не накопили
            — все сбережения вернутся в кошелёк.
          </p>
        </Show>
        <div class="goal-choices" role="group" aria-label="Первая цель">
          <Show when={availableGoals().length === 0}>
            <p>{petText("Все мечты уже достигнуты! Можно продолжить играть с Финни.")}</p>
          </Show>
          <For each={availableGoals()}>
            {(goal) => (
              <button
                class="goal-choice"
                aria-pressed={selected() === goal.id}
                onClick={() => setSelected(goal.id)}
              >
                <Art id={goal.assetId} alt={goal.title} />
                <div>
                  <Show when={goal.id === "scooter"}>
                    <span class="recommendation">Ближе всего</span>
                  </Show>
                  <strong>{goal.title}</strong>
                  <span class="goal-description">{goal.description}</span>
                  <span class="goal-price">
                    <Art id="icon-coin" />
                    {goal.cost} монет
                  </span>
                </div>
                <span class="choice-check" aria-hidden="true">
                  {selected() === goal.id ? "✓" : ""}
                </span>
              </button>
            )}
          </For>
        </div>
        <Show when={game.profile() && programCompletion(game.profile()!).complete}>
          <form class="custom-dream card" onSubmit={createDream}>
            <Art id="goal-custom" />
            <h2>Придумай свою мечту</h2>
            <label for="dream-title">О чём мечтаешь?</label>
            <input
              id="dream-title"
              required
              maxLength={40}
              value={dreamTitle()}
              onInput={(e) => setDreamTitle(e.currentTarget.value)}
              placeholder="Мой секретный подарок"
            />
            <label for="dream-cost">Сколько игровых монет накопим?</label>
            <input
              id="dream-cost"
              type="number"
              required
              min={10}
              max={10000}
              step={1}
              value={dreamCost()}
              onInput={(e) => setDreamCost(e.currentTarget.valueAsNumber)}
            />
            <Button type="submit" disabled={game.busy()}>
              Копить на свою мечту
            </Button>
          </form>
        </Show>
        <Show when={game.error()}>
          <p role="alert" class="error-message">
            {game.error()}
          </p>
        </Show>
        <Button onClick={finish} disabled={game.busy()}>
          {game.busy()
            ? "Сохраняем…"
            : availableGoals().length
              ? "К нашей мечте"
              : petText("К Финни")}{" "}
          <span aria-hidden="true">→</span>
        </Button>
      </div>
    </main>
  );
}
