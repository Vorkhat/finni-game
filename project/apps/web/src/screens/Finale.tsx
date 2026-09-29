import { playGameSound } from "../application/sounds";
import { createSignal, For, Show, onMount } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { profileGoals, programTasks, situations } from "@finni/content";
import { useGame } from "../application/game-context";
import { PetImage } from "../components/game";
import { GameScreen, GameError } from "../components/gameplay";
import { Button, Modal } from "../components/ui";

export function Finale() {
  const game = useGame();
  const navigate = useNavigate();
  onMount(() => playGameSound("milestone"));
  const [confirmNew, setConfirmNew] = createSignal(false);
  const stay = async () => {
    if (
      await game.perform((service) =>
        service.continueTogether(new Date().toISOString()),
      )
    )
      navigate("/home", { replace: true });
  };
  const dreams = () =>
    profileGoals(game.profile()).filter(
      (goal) =>
        game.profile()?.achievedGoalIds.includes(goal.id) ||
        (game.profile()?.selectedGoalId === goal.id &&
          game.profile()!.savingsBalance >= goal.cost),
    );
  return (
    <GameScreen title="Вы справились!" focused>
      <Show when={game.profile()}>
        {(p) => (
          <>
            <section class="evolution-celebration">
              <span class="eyebrow">Десять дней большой дружбы</span>
              <h1>Вы выросли вместе! ✨</h1>
              <PetImage
                {...p().pet.appearance}
                stage={p().pet.stage}
                name={p().pet.name}
                emotion="determined"
                class="finale-pet"
              />
              <h2>Ты молодец!</h2>
              <p>
                Ты помог питомцу вырасти, заботился о нём и учился распоряжаться
                монетами.
              </p>
              <p>
                Выполнено заданий:{" "}
                {
                  programTasks.filter((t) =>
                    p().completedTasks.some(
                      (r) => r.taskId === t.id && r.successful,
                    ),
                  ).length
                }{" "}
                из 20. Решено ситуаций:{" "}
                {
                  situations.filter((s) =>
                    p().completedSituationIds.includes(s.id),
                  ).length
                }{" "}
                из 60.
              </p>
              <Show
                when={dreams().length}
                fallback={
                  <p>Твоя мечта ещё впереди — к ней можно продолжить копить!</p>
                }
              >
                <p>
                  Вы накопили на мечты:{" "}
                  {dreams()
                    .map((g) => g.title)
                    .join(", ")}
                  .
                </p>
              </Show>
              <p>
                Можно остаться вместе: заботиться о питомце, получать монеты в
                новые дни и придумать собственную мечту для копилки.
              </p>
              <GameError />
              <Button disabled={game.busy()} onClick={stay}>
                Остаться вместе
              </Button>
              <Button class="secondary" onClick={() => setConfirmNew(true)}>
                Выбрать нового питомца
              </Button>
            </section>
            <Modal
              open={confirmNew()}
              title="Начать новую историю?"
              onClose={() => setConfirmNew(false)}
            >
              <p>
                Этот питомец и ваши достижения останутся в альбоме. С новым
                другом начнутся десять дней с самого начала, с новым кошельком и
                копилкой.
              </p>
              <A class="button" href="/pet/new">
                Выбрать нового друга
              </A>
              <Button class="secondary" onClick={() => setConfirmNew(false)}>
                Остаться здесь
              </Button>
            </Modal>
          </>
        )}
      </Show>
    </GameScreen>
  );
}
export function PetAlbum() {
  const game = useGame();
  return (
    <GameScreen title="Альбом друзей">
      <h1>Ваши истории</h1>
      <Show
        when={game.profile()?.petAlbum.length}
        fallback={
          <p>
            Здесь появятся воспоминания о питомцах, когда начнёшь новую историю.
          </p>
        }
      >
        <For each={[...(game.profile()?.petAlbum ?? [])].reverse()}>
          {(memory) => (
            <section class="card">
              <PetImage
                {...memory.pet.appearance}
                stage={memory.pet.stage}
                name={memory.pet.name}
                emotion="happy"
                class="finale-pet"
              />
              <h2>{memory.pet.name}</h2>
              <p>
                Вместе дней: {memory.daysCompleted}. Заданий: {memory.taskCount}
                . Ситуаций: {memory.situationCount}.
              </p>
              <Show when={memory.dreams.length}>
                <p>Мечты: {memory.dreams.map((d) => d.title).join(", ")}.</p>
              </Show>
            </section>
          )}
        </For>
      </Show>
      <A class="button" href="/home">
        К своему питомцу
      </A>
    </GameScreen>
  );
}
