import { playGameSound } from "../application/sounds";
import { profileGoals } from "@finni/content";
import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { goals, economyConfig } from "@finni/content";
import { GoalAchievement } from "../components/PeriodExtras";
import {
  adjustMoneyAmount,
  calculateGoalProgress,
  calculateGoalRemaining,
  goalRemainingForBalance,
  previewSavingsDeposit,
} from "@finni/shared";
import { useGame } from "../application/game-context";
import { errorMessage } from "../application/error-messages";
import {
  Art,
  BalanceBadge,
  Button,
  Modal,
  ProgressBar,
} from "../components/ui";
import {
  ActiveDayGate,
  AmountControl,
  GameError,
  GameScreen,
  HappyPet,
  WalletRow,
} from "../components/gameplay";

export function Savings() {
  const game = useGame();
  const goal = () =>
    profileGoals(game.profile()).find((goal) => goal.id === game.profile()?.selectedGoalId);
  const [mode, setMode] = createSignal<"deposit" | "withdraw" | null>(null);
  const [amount, setAmount] = createSignal(0);
  const [preview, setPreview] = createSignal<{
    savingsAfter: number;
    walletAfter: number;
    amount: number;
  } | null>(null);
  const [success, setSuccess] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const close = () => {
    if (game.busy()) return;
    setMode(null);
    setPreview(null);
    setSuccess(false);
    game.clearError();
    setMessage("");
  };
  const open = (kind: "deposit" | "withdraw") => {
    close();
    setAmount(0);
    setMode(kind);
  };
  const available = () =>
    mode() === "deposit"
      ? game.profile()!.walletBalance
      : game.profile()!.savingsBalance;
  const change = (delta: number) => {
    setAmount(adjustMoneyAmount(amount(), delta, available()));
    setMessage("");
  };
  const review = () => {
    try {
      setPreview(
        mode() === "deposit"
          ? previewSavingsDeposit(game.profile()!, amount())
          : game.previewWithdrawal(amount()),
      );
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };
  const confirm = async () => {
    if (!preview() || success()) return;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const done = await game.perform((service) =>
      mode() === "deposit"
        ? service.deposit(preview()!.amount, id, now)
        : service.withdraw(preview()!.amount, id, now, true),
    );
    if (done) {
      if (mode() === "deposit") {
        const reached = goal() && calculateGoalRemaining(game.profile()!, goal()!) === 0 && !game.profile()!.achievedGoalIds.includes(goal()!.id);
        playGameSound("coins", reached ? "milestone" : undefined);
      }
      setSuccess(true);
    }
  };
  return (
    <GameScreen title="Копилка">
      <ActiveDayGate>
        <Show
          when={goal()}
          fallback={
            <>
              <h1>Выберем мечту</h1>
              <A class="button" href="/goal/select">
                Выбрать цель
              </A>
            </>
          }
        >
          {(goal) => (
            <>
              <section class="savings-hero">
                <span class="eyebrow">Моя мечта</span>
                <Art id={goal().assetId} alt={goal().title} />
                <h1>{goal().title}</h1>
                <p>Накоплено</p>
                <strong data-testid="goal-balance">
                  {game.profile()!.savingsBalance} / {goal().cost}
                </strong>
                <ProgressBar
                  value={calculateGoalProgress(game.profile()!, goal())}
                  label="Прогресс цели"
                />
                <p>
                  Осталось:{" "}
                  <strong>
                    {calculateGoalRemaining(game.profile()!, goal())}
                  </strong>
                </p>
              </section>
              <WalletRow />
              <div class="wallet-row">
                <span>В копилке</span>
                <BalanceBadge amount={game.profile()!.savingsBalance} savings />
              </div>
              <p class="hint">В кошельке — на сегодня. В копилке — на мечту.</p>
              <Button onClick={() => open("deposit")}>Отложить монетки</Button>
              <Button class="secondary" onClick={() => open("withdraw")}>
                Забрать из копилки
              </Button>
              <Modal
                open={mode() !== null}
                title={
                  success()
                    ? mode() === "deposit"
                      ? "Ещё ближе к мечте!"
                      : "Монетки в кошельке"
                    : preview()
                      ? `${mode() === "deposit" ? "Отложить" : "Забрать"} ${preview()!.amount} монет?`
                      : mode() === "deposit"
                        ? "Сколько отложим?"
                        : "Сколько заберём?"
                }
                onClose={close}
              >
                <Show
                  when={!success()}
                  fallback={
                    <>
                      <HappyPet />
                      <GoalAchievement sound={mode() !== "deposit"} />
                      <p class="big-number">
                        {mode() === "deposit" ? "+" : "−"}
                        {preview()?.amount} в копилке
                      </p>
                      <p>
                        До цели осталось{" "}
                        {calculateGoalRemaining(game.profile()!, goal())}.
                      </p>
                      <ProgressBar
                        value={calculateGoalProgress(game.profile()!, goal())}
                        label="Новый прогресс цели"
                      />
                      <Button onClick={close}>Готово</Button>
                    </>
                  }
                >
                  <Show
                    when={preview()}
                    fallback={
                      <>
                        <p>Доступно: {available()} монет</p>
                        <div class="quick-amounts">
                          <For each={economyConfig.quickAmounts}>
                            {(value) => (
                              <Button
                                class="secondary"
                                onClick={() => change(value)}
                              >
                                +{value}
                              </Button>
                            )}
                          </For>
                        </div>
                        <AmountControl
                          label="Сумма"
                          value={amount()}
                          onChange={change}
                        />
                        <Show when={message()}>
                          <p role="alert" class="game-error">
                            {message()}
                          </p>
                        </Show>
                        <Button onClick={review}>Продолжить</Button>
                      </>
                    }
                  >
                    {(preview) => (
                      <>
                        <p>
                          Сейчас в копилке: {game.profile()!.savingsBalance}
                        </p>
                        <p>
                          После: <strong>{preview().savingsAfter}</strong>
                        </p>
                        <p>
                          До цели {mode() === "withdraw" ? "снова " : ""}
                          останется:{" "}
                          <strong>
                            {goalRemainingForBalance(
                              preview().savingsAfter,
                              goal(),
                            )}
                          </strong>
                          .
                        </p>
                        <GameError />
                        <Button disabled={game.busy()} data-sound={mode() === "deposit" ? "replace" : undefined} onClick={confirm}>
                          {mode() === "deposit" ? "Отложить" : "Забрать"}
                        </Button>
                        <Button
                          class="secondary"
                          disabled={game.busy()}
                          onClick={close}
                        >
                          {mode() === "deposit"
                            ? "Не сейчас"
                            : "Оставить в копилке"}
                        </Button>
                      </>
                    )}
                  </Show>
                </Show>
              </Modal>
            </>
          )}
        </Show>
      </ActiveDayGate>
    </GameScreen>
  );
}
