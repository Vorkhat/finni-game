import { usePetText } from "../application/game-context";
import { playGameSound } from "../application/sounds";
import { BeforeDayCare } from "../components/BeforeDayCare";
import { createSignal, Show, createEffect, on } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
  adjustBudgetAllocation,
  emptyBudgetValues,
  summarizeBudget,
  type BudgetValues,
} from "@finni/shared";
import { economyConfig, periodNeeds, periodContent } from "@finni/content";
import { useGame } from "../application/game-context";
import { errorMessage } from "../application/error-messages";
import { Art, Button, Modal } from "../components/ui";
import { EventCard } from "../components/PeriodExtras";
import {
  BudgetControls,
  GameError,
  GameScreen,
  PlanPreview,
  WalletRow,
} from "../components/gameplay";

export function DayStart() {
  const game = useGame();
  const navigate = useNavigate();
  createEffect(on(() => !!game.profile() && !game.profile()!.currentPeriod && Object.values(game.profile()!.pet.state).every(value => value > 20), ready => {if (ready) playGameSound("milestone");}));
  const begin = async () => {
    if (game.profile()?.currentPeriod) {
      navigate("/budget");
      return;
    }
    if (
      await game.perform((service) =>
        service.startPeriod({
          periodId: crypto.randomUUID(),
          income: economyConfig.periodIncome,
          startedAt: new Date().toISOString(),
          transactionId: crypto.randomUUID(),
          mandatoryNeeds: periodNeeds(game.profile()!.periodHistory.length + 1),
        }),
      )
    ) {
      navigate("/budget", { replace: true });
    }
  };
  return (
    <GameScreen title="Новый день">
      <Show
        when={
          !game.profile()?.currentPeriod &&
          Object.values(game.profile()?.pet.state ?? {}).some(
            (value) => value <= 20,
          )
        }
        fallback={
          <section class="day-intro">
            <Art id="icon-coin" />
            <h1>Новый день!</h1>
            <p>Сегодня у нас</p>
            <strong>{economyConfig.periodIncome} монет</strong>
            <p>
              Плюс остаток в кошельке: {game.profile()?.walletBalance ?? 0}{" "}
              монет.
            </p>
            <p>
              Сначала решим,
              <br />
              как ими распорядиться.
            </p>
            <GameError />
            <Button disabled={game.busy()} onClick={begin}>
              Составить план
            </Button>
          </section>
        }
      >
        <BeforeDayCare />
      </Show>
    </GameScreen>
  );
}
export function Budget() {
 const petText = usePetText();
  const game = useGame();
  const navigate = useNavigate();
  const [confirm, setConfirm] = createSignal(false);
  const [feedback, setFeedback] = createSignal("");
  const period = () => game.profile()?.currentPeriod;
  const values = () => period()?.budgetPlan ?? emptyBudgetValues();
  const summary = () => summarizeBudget(period()?.income ?? 0, values());
  const change = async (field: keyof BudgetValues, delta: number) => {
    setFeedback("");
    try {
      const next = adjustBudgetAllocation(
        period()!.income,
        values(),
        field,
        delta,
      );
      await game.perform((service) =>
        service.setPlan(next, new Date().toISOString()),
      );
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  };
  const ready = async () => {
    if (
      !period()?.budgetPlan &&
      !(await game.perform((service) =>
        service.setPlan(values(), new Date().toISOString()),
      ))
    )
      return;
    setConfirm(true);
  };
  const activate = async () => {
    if (
      await game.perform((service) =>
        service.confirmPlan(new Date().toISOString()),
      )
    ) {
      setConfirm(false);
      navigate("/home", { replace: true });
    }
  };
  return (
    <Show when={period()} fallback={<DayStart />}>
      <GameScreen title="План на день">
        <Show
          when={period()?.status === "PLANNING"}
          fallback={
            <>
              <h1>День идёт</h1>
              <p>
                План уже готов. Теперь можно выбирать покупки и приближать
                мечту.
              </p>
              <WalletRow />
              <PlanPreview profile={game.profile()!} />
              <EventCard />
              <A class="button" href="/shop">
                В магазин
              </A>
              <A class="button secondary" href="/day/result">
                Завершить день
              </A>
            </>
          }
        >
          <h1>Как распорядимся монетками сегодня?</h1>
          <p>{petText(periodContent.needsText)}</p>
          <div class="budget-totals">
            <span>
              Доступно<strong>{summary().income}</strong>
            </span>
            <span>
              Распределено<strong>{summary().allocated}</strong>
            </span>
            <span>
              Осталось<strong>{summary().unallocated}</strong>
            </span>
          </div>
          <BudgetControls
            values={values()}
            step={economyConfig.budgetStep}
            disabled={game.busy()}
            onChange={change}
          />
          <p class="hint">
            План — это пока намерение. Монетки в копилку отложим отдельно.
          </p>
          <Show when={feedback()}>
            <p role="alert" class="game-error">
              {feedback()}
            </p>
          </Show>
          <GameError />
          <Button onClick={ready} disabled={game.busy()}>
            Готово
          </Button>
          <Modal
            open={confirm()}
            title="Наш план на сегодня"
            onClose={() => setConfirm(false)}
          >
            <div class="plan-confirm">
              <p>
                Нужно <strong>{values().plannedMandatory}</strong>
              </p>
              <p>
                Хочу <strong>{values().plannedOptional}</strong>
              </p>
              <p>
                Коплю <strong>{values().plannedSavings}</strong>
              </p>
              <p>
                Всего <strong>{summary().allocated}</strong>
              </p>
              <p>Ещё {summary().unallocated} монет дохода не распределены по плану.</p>
            </div>
            <p>После начала дня план не меняется. Но решения принимаешь ты.</p>
            <GameError />
            <Button onClick={activate} disabled={game.busy()}>
              Начать день
            </Button>
            <Button
              class="secondary"
              onClick={() => setConfirm(false)}
              disabled={game.busy()}
            >
              Изменить
            </Button>
          </Modal>
        </Show>
      </GameScreen>
    </Show>
  );
}
