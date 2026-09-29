import { usePetText } from "../application/game-context";
import { playGameSound } from "../application/sounds";
import { profileGoals } from "@finni/content";
import { createSignal, For, Show, createEffect, on } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { events, goals, periodEventId, purchases } from "@finni/content";
import { calculateGoalRemaining } from "@finni/shared";
import { useGame } from "../application/game-context";
import { Art, Button, Modal } from "./ui";
import { GameError, WalletRow } from "./gameplay";

export function EventCard() {
  const game = useGame();
  const [open, setOpen] = createSignal(false);
  const event = () =>
    events.find(
      (e) => e.id === periodEventId(game.profile()?.currentPeriod?.index ?? 0),
    );
  return (
    <Show when={game.profile()?.currentPeriod?.status === "ACTIVE" && event()}>
      <button class="event-card" onClick={() => setOpen(true)}>
        <Art id={event()!.assetId} />
        <div>
          <span class="eyebrow">Событие дня</span>
          <strong>{event()!.title}</strong>
          <span>Посмотреть ›</span>
        </div>
      </button>
      <Modal
        open={open()}
        title={event()?.title ?? "Событие дня"}
        onClose={() => {
          if (!game.busy()) setOpen(false);
        }}
      >
        <EventDetails onClose={() => setOpen(false)} />
      </Modal>
    </Show>
  );
}

/** Shared contents: Home owns the only dialog; /budget uses EventCard's dialog. */
export function EventDetails(props: { onClose: () => void }) {
  const petText = usePetText();
  const game = useGame();
  const [message, setMessage] = createSignal("");
  const event = () =>
    events.find(
      (e) => e.id === periodEventId(game.profile()?.currentPeriod?.index ?? 0),
    );
  const decision = () =>
    game
      .profile()
      ?.currentPeriod?.eventDecisions.find((d) => d.eventId === event()?.id);
  const regularPrice = () =>
    purchases.find((p) => p.id === event()?.context.itemId)?.price;
  const choose = async (id: string) => {
    const e = event()!;
    if (
      await game.perform((service) =>
        service.decideEvent(
          e.id,
          id,
          crypto.randomUUID(),
          new Date().toISOString(),
        ),
      )
    ) {
      const choice = e.choices.find((c) => c.id === id)!;
      if ((choice.outcome === "income" || choice.outcome === "purchase")) playGameSound("coins");
      setMessage(choice.feedback);
    }
  };
  const close = () => {
    if (!game.busy()) {
      props.onClose();
      setMessage("");
      game.clearError();
    }
  };
  return (
    <Show when={game.profile()?.currentPeriod?.status === "ACTIVE" && event()}>
      {(_event) => (
        <>
          <Art id={event()!.assetId} class="event-art" />
          <p>{petText(event()!.intro)}</p>
          <WalletRow />
          <Show when={event()!.eventType === "discount"}>
            <p>
              Сегодня {event()!.context.amount} вместо {regularPrice()} монет.
            </p>
          </Show>
          <Show when={event()!.eventType === "required_expense"}>
            <p>
              Дополнительный уход: {event()!.context.amount} монет.
              Подтверждённый план останется прежним — сравним его с решением в
              конце дня.
            </p>
          </Show>
          <GameError />
          <Show
            when={!decision()}
            fallback={
              <>
                <p role="status">
                  {message() ||
                    event()!.choices.find((c) => c.id === decision()?.choiceId)
                      ?.feedback}
                </p>
                <Button onClick={close}>Готово</Button>
              </>
            }
          >
            <For each={event()!.choices}>
              {(choice) => (
                <Button
                  disabled={game.busy()}
                  data-sound={(choice.outcome === "income" || choice.outcome === "purchase") ? "replace" : undefined}
                  class={choice.outcome === "skip" ? "secondary" : ""}
                  onClick={() => choose(choice.id)}
                >
                  {choice.outcome === "purchase"
                    ? `Купить за ${event()!.context.amount} монет`
                    : choice.label}
                </Button>
              )}
            </For>
          </Show>
        </>
      )}
    </Show>
  );
}

export function GoalAchievement(props: { sound?: boolean } = {}) {
  const game = useGame();
  const navigate = useNavigate();
  const goal = () => profileGoals(game.profile()).find((g) => g.id === game.profile()?.selectedGoalId);
  const reached = () =>
    goal() && calculateGoalRemaining(game.profile()!, goal()!) === 0;
  createEffect(on(() => reached() ? goal()?.id : undefined, id => {
    if (props.sound !== false && id && !game.profile()!.achievedGoalIds.includes(id)) playGameSound("milestone");
  }));
  const acknowledge = async (choose: boolean) => {
    if (
      await game.perform((service) =>
        service.seeGoal(goal()!.id, new Date().toISOString()),
      )
    ) {
      if (choose) navigate("/goal/select");
    }
  };
  return (
    <Show when={reached()}>
      <section class="goal-celebration" aria-label="Мечта сбылась">
        <span aria-hidden="true">✦</span>
        <Art id={goal()!.assetId} />
        <h2>Мечта сбылась! 🎉</h2>
        <p>Молодец! Ты накопил на мечту «{goal()!.title}»!</p>
        <strong>
          В копилке: {game.profile()!.savingsBalance} / {goal()!.cost} монет
        </strong>
        <Show
          when={!game.profile()!.achievedGoalIds.includes(goal()!.id)}
          fallback={
            <A class="button secondary" href="/goal/select">
              Придумать следующую мечту
            </A>
          }
        >
          <p>
            При выборе следующей мечты потратим {goal()!.cost} монет на эту.
            Остаток вернётся в кошелёк, а новая копилка начнётся с нуля.
          </p>
          <GameError />
          <Button disabled={game.busy()} onClick={() => acknowledge(true)}>
            Выбрать новую мечту
          </Button>
          <Button
            class="secondary"
            disabled={game.busy()}
            onClick={() => acknowledge(false)}
          >
            Продолжить копить
          </Button>
        </Show>
      </section>
    </Show>
  );
}
