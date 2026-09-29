import { usePetText } from "../application/game-context";
import { playGameSound } from "../application/sounds";
import { createSignal, For, Show } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { purchases, interfaceContent } from "@finni/content";
import { purchasePreview } from "@finni/shared";
import { useGame } from "../application/game-context";
import { Art, Button, Modal } from "../components/ui";
import {
  ActiveDayGate,
  GameScreen,
  GameError,
  HappyPet,
  WalletRow,
} from "../components/gameplay";

type Product = (typeof purchases)[number];
export function ProductEffect(props: { product: Product }) {
  return (
    <span class="product-effect">
      <For
        each={interfaceContent.status.filter(
          (state) => props.product.effect[state.id as keyof Product["effect"]],
        )}
      >
        {(state) => (
          <span>
            +{props.product.effect[state.id as keyof Product["effect"]]} ·{" "}
            {state.title}
          </span>
        )}
      </For>
    </span>
  );
}
export function Shop() {
  const petText = usePetText();
  const game = useGame();
  const [query] = useSearchParams();
  const helpsToday = (product: Product) => {
    const ids: Record<string, string[]> = {
      feed: ["breakfast", "lunch", "snack"],
      play: ["ball", "toy", "game", "balloon"],
      care: ["care"],
    };
    const selectedIds = ids[String(query.activity)];
    return selectedIds
      ? selectedIds.includes(product.id)
      : !!neededStat() && (product.effect[neededStat()!] ?? 0) > 0;
  };
  const neededStat = () =>
    ["satiety", "mood", "care"].includes(String(query.need))
      ? (String(query.need) as keyof Product["effect"])
      : undefined;
  const [selected, setSelected] = createSignal<Product | null>(null);
  const [mode, setMode] = createSignal<"confirm" | "success" | "shortage">(
    "confirm",
  );
  const close = () => {
    if (game.busy()) return;
    setSelected(null);
    game.clearError();
  };
  const choose = (product: Product) => {
    game.clearError();
    setMode("confirm");
    setSelected(product);
  };
  const buy = async () => {
    const item = selected();
    if (!item || mode() !== "confirm") return;
    if (
      await game.perform((service) =>
        service.purchase(item, crypto.randomUUID(), new Date().toISOString()),
      )
    ) {
      playGameSound("coins");
      setMode("success");
    }
    else if (game.errorCode() === "INSUFFICIENT_FUNDS") setMode("shortage");
  };
  const history = () =>
    game
      .profile()
      ?.currentPeriod?.transactions.filter(
        (entry) =>
          entry.type === "PURCHASE_MANDATORY" ||
          entry.type === "PURCHASE_OPTIONAL" ||
          (entry.type === "EVENT_EXPENSE" && !!entry.metadata.purchaseId),
      ) ?? [];
  return (
    <GameScreen title="Магазин">
      <ActiveDayGate>
        <h1>{petText("Что выберем для Финни?")}</h1>
        <Show when={neededStat()}>
          <p class="hint">
            {petText("Для заботы сейчас подойдут товары с отметкой «Поможет Финни».")}</p>
        </Show>
        <WalletRow />
        <For each={["mandatory", "optional"] as const}>
          {(kind) => (
            <section class="shop-category">
              <h2>
                <Art
                  id={kind === "mandatory" ? "item-breakfast" : "item-ball"}
                />
                {kind === "mandatory" ? "Нужно" : "Хочу"}
              </h2>
              <div class="shop-grid">
                <For
                  each={purchases.filter((product) => product.kind === kind)}
                >
                  {(product) => (
                    <article class="product-card" aria-label={product.title}>
                      <Show when={helpsToday(product)}>
                        <span class="recommendation">{petText("Поможет Финни")}</span>
                      </Show>
                      <Art id={product.assetId} alt={product.title} />
                      <h3>{product.title}</h3>
                      <strong>{product.price} монет</strong>
                      <span class="category-label">
                        {kind === "mandatory" ? "Нужно" : "Хочу"}
                      </span>
                      <ProductEffect product={product} />
                      <Button
                        onClick={() => choose(product)}
                        aria-label={`Купить: ${product.title}`}
                      >
                        Купить
                      </Button>
                    </article>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
        <details class="purchase-history">
          <summary>Покупки сегодня · {history().length}</summary>
          <For each={history()}>
            {(entry) => (
              <p>
                {purchases.find((item) => item.id === entry.metadata.purchaseId)
                  ?.title ?? "Покупка"}
                <strong>−{entry.amount}</strong>
              </p>
            )}
          </For>
        </details>
        <Show when={selected()}>
          {(product) => (
            <Modal
              open
              title={
                mode() === "confirm"
                  ? `Купить: ${product().title}?`
                  : mode() === "success"
                    ? petText("Покупка у Финни!")
                    : "Пока не хватает монет"
              }
              onClose={close}
            >
              <Show when={mode() === "confirm"}>
                <Art
                  id={product().assetId}
                  alt={product().title}
                  class="modal-product"
                />
                <p class="big-number">{product().price} монет</p>
                <ProductEffect product={product()} />
                <GameError />
                <Button disabled={game.busy()} data-sound="replace" onClick={buy}>
                  Купить
                </Button>
                <Button
                  class="secondary"
                  disabled={game.busy()}
                  onClick={close}
                >
                  Не сейчас
                </Button>
              </Show>
              <Show when={mode() === "success"}>
                <HappyPet />
                <p>{product().title} {petText("теперь у Финни.")}</p>
                <p class="big-number">−{product().price} монет</p>
                <ProductEffect product={product()} />
                <WalletRow />
                <Button onClick={close}>Здорово!</Button>
              </Show>
              <Show when={mode() === "shortage"}>
                <Art id="icon-coin" class="modal-product" />
                <div class="plan-confirm">
                  <p>
                    Цена{" "}
                    <strong>
                      {purchasePreview(game.profile()!, product()).price}
                    </strong>
                  </p>
                  <p>
                    У тебя{" "}
                    <strong>
                      {purchasePreview(game.profile()!, product()).available}
                    </strong>
                  </p>
                  <p>
                    Не хватает{" "}
                    <strong>
                      {purchasePreview(game.profile()!, product()).shortage}
                    </strong>
                  </p>
                </div>
                <p>Можно выполнить задание или отложить покупку.</p>
                <A class="button" href="/tasks">
                  К заданиям
                </A>
                <Button class="secondary" onClick={close}>
                  Не сейчас
                </Button>
              </Show>
            </Modal>
          )}
        </Show>
      </ActiveDayGate>
    </GameScreen>
  );
}
