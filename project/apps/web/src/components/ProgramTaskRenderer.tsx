import { usePetText } from "../application/game-context";
import { playGameSound } from "../application/sounds";
import { createMemo, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import {
  evaluateProgramTask,
  type ProgramAnswer,
  type ProgramTask,
} from "@finni/shared";
import { useGame } from "../application/game-context";
import { programAsset } from "../assets/registry";
import { AnswerReaction, ResultCelebration } from "./Celebration";
import { Button } from "./ui";
import { GameError } from "./gameplay";
import "./program-task.css";

export function ProgramTaskRenderer(props: { task: ProgramTask }) {
  const petText = usePetText();
  const game = useGame();
  const task = props.task;
  const [answer, setAnswer] = createSignal<ProgramAnswer>({});
  const [selectedToken, setSelectedToken] = createSignal<string>();
  const [reaction, setReaction] = createSignal(false);
  const [hint, setHint] = createSignal(false);
  const [rewarded, setRewarded] = createSignal(false);
  const successful = () => evaluateProgramTask(task, answer());
  const done = () =>
    game
      .profile()
      ?.completedTasks.some((t) => t.taskId === task.id && t.successful);
  const replay = () => game.profile()?.taskReplays[task.id];
  const replaying = () => !!replay() && !replay()!.claimed;
  const canReplay = () => (game.profile()?.periodHistory.length ?? 0) >= 10;
  const beginReplay = async () => {
    if(game.busy()) return;
    if(await game.perform(service=>service.startTaskReplay(task.id,crypto.randomUUID(),new Date().toISOString()))) {reset();setRewarded(false);setReaction(false);}
  };
  const available = () =>
    task.day <= (game.profile()?.currentPeriod?.index ?? 0);
  const choices = task.board.choices ?? task.board.rows ?? [];
  const tokens =
    task.board.tokens?.map((t) => ({
      id: t.id,
      label: `${t.value} монет`,
      asset: "coin",
      value: t.value,
    })) ??
    task.board.items?.map((t) => ({ ...t, value: 0 })) ??
    [];
  const selectedChoice = () => choices.find((c) => c.id === answer().choice);
  const cartTotal = () =>
    (task.board.items ?? [])
      .filter((item) => answer().selected?.includes(item.id))
      .reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const zoneTotal = (zone: string) =>
    tokens
      .filter((t) => answer().mapping?.[t.id] === zone)
      .reduce((sum, t) => sum + t.value, 0);
  const outcome = createMemo(() => {
    let wallet = task.board.wallet ?? 0,
      saved = task.board.saved ?? 0;
    const choice = selectedChoice();
    if (choice && (choice.cost ?? choice.amount ?? 0) <= wallet) {
      wallet -= choice.cost ?? choice.amount ?? 0;
      saved += choice.amount ?? 0;
    }
    if (task.type === "cart") wallet = Math.max(0, wallet - cartTotal());
    if (task.type === "buy_then_save" && answer().transferred) {
      saved += wallet;
      wallet = 0;
    }
    if (task.type === "transfer" && task.board.wallet) {
      const amount = zoneTotal("Копилка");
      wallet -= amount;
      saved += amount;
    }
    return { wallet, saved };
  });
  const choose = (id: string) => {
    setAnswer({ choice: id });
    if (task.type !== "buy_then_save") setReaction(true);
  };
  const place = (zone: string, id = selectedToken()) => {
    if (!id || !tokens.some((t) => t.id === id)) return;
    setAnswer((a) => ({ ...a, mapping: { ...a.mapping, [id]: zone } }));
    setSelectedToken(undefined);
  };
  const claim = async () => {
    if (game.busy()) return;
    if (
      await game.perform((service) =>
        service.completeProgramTask(
          task.id,
          answer(),
          crypto.randomUUID(),
          new Date().toISOString(),
          replaying() ? replay()!.id : undefined,
        ),
      )
    ) {
      if (!rewarded()) playGameSound("coins");
      setRewarded(true);
      setReaction(false);
    }
  };
  const reset = () => {
    setAnswer({});
    setSelectedToken(undefined);
  };
  const choiceImage = (asset: string) => (
    <img src={programAsset(asset)} alt="" draggable={false} />
  );
  return (
    <section
      class="task-renderer program-task"
      data-task-id={task.id}
      data-task-type={task.type}
    >
      <AnswerReaction
        open={reaction()}
        actionSound={successful()}
        success={successful()}
        text={
          successful() ? task.explanation : `Пока не получилось. ${petText(task.hint)}`
        }
        actionLabel={
          successful()
            ? `Забрать награду · +${task.reward.coins} монет`
            : "Попробовать ещё раз"
        }
        onAction={() => {
          if (successful()) void claim();
          else setReaction(false);
        }}
        onClose={() => setReaction(false)}
        busy={game.busy()}
        error={game.error()}
      />
      <Show
        when={!done() || replaying()}
        fallback={
          <div class="task-result">
            <ResultCelebration success={true} />
            <h1>Задание выполнено!</h1>
            <p>
              {rewarded()
                ? `+${task.reward.coins} монет`
                : "Награда уже получена."}
            </p>
            <p>Теперь у тебя {game.profile()?.walletBalance} монет.</p>
            <p>{petText(task.explanation)}</p>
            <Show when={canReplay()}><Button disabled={game.busy()} onClick={beginReplay}>Пройти ещё раз · +10 монет</Button><GameError /></Show>
            <A class="button" href="/tasks">
              К заданиям
            </A>
            <A class="button secondary" href="/situations">
              К ситуациям
            </A>
            <A class="button secondary" href="/home">
              {petText("К Финни")}</A>
          </div>
        }
      >
        <Show
          when={available()}
          fallback={
            <>
              <h1>Задание откроется в день {task.day}</h1>
              <A class="button" href="/tasks">
                К заданиям
              </A>
            </>
          }
        >
          <span class="simulation-label">
            День {task.day} · {task.petStage} · учебные монетки
          </span>
          <h1>{task.title}</h1>
          <p>{petText(task.question)}</p>
          <div
            class="simulation-scene"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer?.getData("text/plain");
              if (id && choices.some((c) => c.id === id)) choose(id);
            }}
          >
            {choiceImage(task.hero)}
            <div>
              <Show when={task.board.wallet !== undefined}>
                <strong>В истории: {outcome().wallet} монет</strong>
              </Show>
              <Show
                when={
                  task.board.saved !== undefined ||
                  task.type === "buy_then_save"
                }
              >
                <p>
                  В копилке: {outcome().saved}
                  {task.board.goal ? ` / ${task.board.goal}` : ""}
                </p>
              </Show>
              <Show when={task.type === "cart"}>
                <p>В корзине: {cartTotal()} монет</p>
                <Show when={cartTotal() > (task.board.wallet ?? 0)}>
                  <p>Монет пока не хватает. Убери лишнюю покупку.</p>
                </Show>
              </Show>
              <Show when={task.type === "find_extra"}>
                <p>
                  В чеке: {task.board.displayedTotal} монет. Куплено: одно мыло.
                </p>
              </Show>
            </div>
          </div>
          <Show when={choices.length}>
            <p class="hint">
              Нажми на свой вариант или перетащи его к картинке сверху.
            </p>
            <div class="decision-choices">
              <For each={choices}>
                {(choice, i) => (
                  <Button
                    data-sound={task.type !== "buy_then_save" ? "replace" : undefined}
                    class="secondary decision-choice"
                    draggable="true"
                    onDragStart={(event) =>
                      event.dataTransfer?.setData("text/plain", choice.id)
                    }
                    aria-pressed={answer().choice === choice.id}
                    onClick={() => choose(choice.id)}
                  >
                    {choiceImage(choice.asset)}
                    <span>
                      {task.type === "find_extra" ? `${i() + 1}. ` : ""}
                      {choice.label}
                    </span>
                  </Button>
                )}
              </For>
            </div>
          </Show>
          <Show when={task.type === "buy_then_save" && answer().choice}>
            <Button
              data-sound="replace"
              disabled={answer().transferred}
              onClick={() => {
                setAnswer((a) => ({ ...a, transferred: true }));
                setReaction(true);
              }}
            >
              {answer().transferred
                ? "Сдача в копилке ✓"
                : `В копилку оставшиеся ${outcome().wallet} монет`}
            </Button>
          </Show>
          <Show when={task.type === "cart"}>
            <div class="simulation-cart">
              <For each={task.board.items}>
                {(item) => (
                  <button
                    class="cart-item"
                    aria-pressed={answer().selected?.includes(item.id) ?? false}
                    onClick={() =>
                      setAnswer((a) => ({
                        selected: a.selected?.includes(item.id)
                          ? a.selected.filter((id) => id !== item.id)
                          : [...(a.selected ?? []), item.id],
                      }))
                    }
                  >
                    {choiceImage(item.asset)}
                    <span>
                      {item.label} · {item.cost} монет
                    </span>
                    <span>
                      {answer().selected?.includes(item.id) ? "✓" : "+"}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={["sort", "allocate", "transfer"].includes(task.type)}>
            <p class="hint">
              Выбери картинку или монетки, затем нажми на нужную область. Можно
              и перетащить.
            </p>
            <div class="program-tokens">
              <For each={tokens}>
                {(token) => (
                  <button
                    class="button secondary program-token"
                    draggable="true"
                    aria-pressed={selectedToken() === token.id}
                    onClick={() => setSelectedToken(token.id)}
                    onDragStart={(event) => {
                      setSelectedToken(token.id);
                      event.dataTransfer?.setData("text/plain", token.id);
                    }}
                  >
                    {choiceImage(token.asset)}
                    <span>
                      {token.label}
                      <small>
                        {answer().mapping?.[token.id] ??
                          task.board.initialZone ??
                          "Выбери область"}
                      </small>
                    </span>
                  </button>
                )}
              </For>
            </div>
            <div class="program-zones">
              <For each={task.board.zones}>
                {(zone) => (
                  <button
                    class="program-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      place(zone, e.dataTransfer?.getData("text/plain"));
                    }}
                    onClick={() => place(zone)}
                  >
                    <strong>{zone}</strong>
                    <Show when={task.board.tokens}>
                      <span>{zoneTotal(zone)} монет</span>
                    </Show>
                    <For
                      each={tokens.filter(
                        (token) => answer().mapping?.[token.id] === zone,
                      )}
                    >
                      {(token) => (
                        <span class="program-placed">
                          {choiceImage(token.asset)}
                          {token.label}
                        </span>
                      )}
                    </For>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={task.type === "order"}>
            <p class="hint">
              Нажми на шаги в нужном порядке. Чтобы убрать шаг, нажми на него
              ещё раз.
            </p>
            <For each={task.board.items}>
              {(item) => (
                <Button
                  class="secondary decision-choice"
                  aria-pressed={answer().order?.includes(item.id) ?? false}
                  onClick={() =>
                    setAnswer((a) => ({
                      order: a.order?.includes(item.id)
                        ? a.order.filter((id) => id !== item.id)
                        : [...(a.order ?? []), item.id],
                    }))
                  }
                >
                  {choiceImage(item.asset)}
                  <span>
                    {answer().order?.includes(item.id)
                      ? `${answer().order!.indexOf(item.id) + 1}. `
                      : ""}
                    {item.label}
                  </span>
                </Button>
              )}
            </For>
            <ol class="program-order">
              <For each={answer().order}>
                {(id) => (
                  <li>
                    {task.board.items?.find((item) => item.id === id)?.label}
                  </li>
                )}
              </For>
            </ol>
          </Show>
          <Show
            when={
              !["select", "find_extra", "buy_then_save"].includes(task.type) ||
              (successful() && !reaction())
            }
          >
            <Button data-sound="replace" onClick={() => setReaction(true)}>Проверить ответ</Button>
          </Show>
          <Button class="secondary" onClick={reset}>
            Начать заново
          </Button>
          <Button
            class="secondary task-hint-toggle"
            onClick={() => setHint(!hint())}
          >
            Подсказка 💡
          </Button>
          <Show when={hint()}>
            <p class="task-hint">{task.hint}</p>
          </Show>
          <GameError />
        </Show>
      </Show>
    </section>
  );
}
