import { usePetText } from "../application/game-context";
import { createSignal, For, Match, Show, Switch, onCleanup } from "solid-js";
import { A } from "@solidjs/router";
import { purchases, economyConfig } from "@finni/content";
import {
  adjustBudgetAllocation,
  emptyBudgetValues,
  evaluateTask,
  type BudgetValues,
  type InteractiveLearningTaskDefinition,
  type TaskSubmission,
} from "@finni/shared";
import { useGame } from "../application/game-context";
import { errorMessage } from "../application/error-messages";
import { Art, Button, ProgressBar } from "./ui";
import { BudgetControls, GameError } from "./gameplay";
import { ResultCelebration, AnswerReaction } from "./Celebration";

type Task = InteractiveLearningTaskDefinition;
type SubmissionHandler = (submission: TaskSubmission) => void;
import { readTaskDraft, saveTaskDraft } from "../application/task-draft";

function AllocateBudgetTask(props: {
  initial?: TaskSubmission | null;
  task: Task;
  onSubmit: SubmissionHandler;
}) {
  const initial = props.initial?.allocations;
  const [values, setValues] = createSignal<BudgetValues>(
    initial
      ? {
          plannedMandatory: initial.mandatory,
          plannedOptional: initial.optional,
          plannedSavings: initial.savings,
        }
      : emptyBudgetValues(),
  );
  const [error, setError] = createSignal("");
  const change = (field: keyof BudgetValues, delta: number) => {
    try {
      const next = adjustBudgetAllocation(
        props.task.initialState.wallet,
        values(),
        field,
        delta,
      );
      setValues(next);
      setError("");
      props.onSubmit({
        actionId: props.task.actions[0]!.id,
        allocations: {
          mandatory: next.plannedMandatory,
          optional: next.plannedOptional,
          savings: next.plannedSavings,
        },
      });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <>
      <BudgetControls
        values={values()}
        step={economyConfig.budgetStep}
        onChange={change}
      />
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
    </>
  );
}
function ShoppingCartTask(props: {
  task: Task;
  initial?: TaskSubmission | null;
  onSubmit: SubmissionHandler;
}) {
  const [chosen, setChosen] = createSignal<string[]>(
    props.initial?.selectedItemIds ?? [],
  );
  const toggle = (id: string) => {
    const next = chosen().includes(id)
      ? chosen().filter((item) => item !== id)
      : [...chosen(), id];
    setChosen(next);
    props.onSubmit({
      actionId: props.task.actions[0]!.id,
      selectedItemIds: next,
    });
  };
  return (
    <div class="simulation-cart">
      <For each={props.task.initialState.items}>
        {(item) => {
          const product = purchases.find(
            (product) => product.id === item.itemId,
          )!;
          return (
            <button
              class="cart-item"
              aria-pressed={chosen().includes(item.itemId)}
              onClick={() => toggle(item.itemId)}
              aria-label={product.title}
            >
              <Art id={product.assetId} />
              <span>
                <strong>{product.title}</strong>
                <span>
                  {item.price} монет ·{" "}
                  {item.kind === "mandatory" ? "Нужно" : "Хочу"}
                </span>
              </span>
              <span aria-hidden="true">
                {chosen().includes(item.itemId) ? "✓" : "+"}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
function DecisionChoices(props: {
  task: Task;
  onSubmit: SubmissionHandler;
  reset: () => void;
}) {
  return (
    <div class="decision-choices">
      <For each={props.task.actions}>
        {(action) => {
          const product = purchases.find(
            (product) => product.id === action.itemId,
          );
          const scenarioItem = props.task.initialState.items.find(
            (item) => item.itemId === action.itemId,
          );
          return (
            <Button
              class="secondary decision-choice"
              onClick={() =>
                action.kind === "reorder"
                  ? props.reset()
                  : props.onSubmit({ actionId: action.id })
              }
            >
              <Show when={product}>
                <Art id={product!.assetId} />
              </Show>
              <span>
                {action.label}
                <Show when={scenarioItem}>
                  <small>{scenarioItem!.price} монет</small>
                </Show>
              </span>
            </Button>
          );
        }}
      </For>
    </div>
  );
}

export function TaskRenderer(props: { task: Task }) {
  const petText = usePetText();
  const game = useGame();
  const profile = game.profile()!;
  const draftKey = `finni.task-draft:${profile.demoMode ? "demo" : "normal"}:${profile.id}:${profile.createdAt}:${profile.currentPeriod!.id}:${props.task.id}`;
  const draft = readTaskDraft(draftKey, props.task);
  const [submission, setSubmission] = createSignal<TaskSubmission | null>(
    draft,
  );
  const [result, setResult] = createSignal<ReturnType<
    typeof evaluateTask
  > | null>(draft ? evaluateTask(props.task, draft) : null);
  const [error, setError] = createSignal("");
  const [generation, setGeneration] = createSignal(1);
  const [showHint, setShowHint] = createSignal(false);
  const [reactionOpen, setReactionOpen] = createSignal(false);
  const completed = () =>
    game
      .profile()
      ?.currentPeriod?.taskResults.some(
        (item) => item.taskId === props.task.id,
      );
  const [rewarded, setRewarded] = createSignal(false);
  const [settling, setSettling] = createSignal(false);
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(settleTimer));
  const submit: SubmissionHandler = (answer) => {
    try {
      setResult(evaluateTask(props.task, answer));
      if (!["allocate_budget", "shopping_cart"].includes(props.task.type))
        setReactionOpen(true);
      setSubmission(answer);
      saveTaskDraft(draftKey, answer);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const reset = () => {
    setSubmission(null);
    saveTaskDraft(draftKey, null);
    setResult(null);
    setError("");
    setGeneration((value) => value + 1);
  };
  const complete = async () => {
    if (!submission() || completed()) return;
    setSettling(true);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => setSettling(false), 500);
    if (
      await game.perform((service) =>
        service.completeTask(
          props.task,
          submission()!,
          crypto.randomUUID(),
          new Date().toISOString(),
        ),
      )
    ) {
      setRewarded(true);
      setReactionOpen(false);
      saveTaskDraft(draftKey, null);
    }
  };
  return (
    <section class="task-renderer" data-task-type={props.task.type}>
      <AnswerReaction
        open={reactionOpen()}
        success={!!result()?.successful}
        text={
          result()
            ? `${result()!.feedback.text} ${result()!.feedback.consequence}`
            : undefined
        }
        actionLabel={
          result()?.successful
            ? `Забрать награду · +${props.task.reward} монет`
            : "Попробовать ещё раз"
        }
        onAction={() => {
          if (result()?.successful) void complete();
          else {
            setReactionOpen(false);
            reset();
          }
        }}
        busy={game.busy()}
        error={game.error()}
        onClose={() => setReactionOpen(false)}
      />
      <Show
        when={!completed()}
        fallback={
          <div class="task-result">
            <ResultCelebration success={true} />
            <h1>
              {rewarded() ? "Задание выполнено!" : "Эта история уже пройдена"}
            </h1>
            <p>
              {rewarded()
                ? `+${props.task.reward} монет`
                : "Награда уже у тебя. Повторно монетки не начисляются."}
            </p>
            <p>Теперь у тебя {game.profile()?.walletBalance}.</p>
            <Show when={result()}>
              <p>{result()!.feedback.text}</p>
              <p>{result()!.feedback.consequence}</p>
            </Show>
            <A
              class="button"
              href="/tasks"
              aria-disabled={settling()}
              onClick={(event) => {
                if (settling()) event.preventDefault();
              }}
            >
              К заданиям
            </A>
            <A class="button secondary" href="/situations">К жизненным ситуациям →</A>
            <A
              class="button secondary"
              href="/home"
              aria-disabled={settling()}
              onClick={(event) => {
                if (settling()) event.preventDefault();
              }}
            >
              {petText("К Финни")}</A>
          </div>
        }
      >
        <span class="simulation-label">
          Учебная история · монетки здесь ненастоящие
        </span>
        <h1>{props.task.title}</h1>
        <p>{props.task.intro}</p>
        <Show when={props.task.hint}>
          <Show
            when={showHint()}
            fallback={
              <Button
                class="secondary task-hint-toggle"
                onClick={() => setShowHint(true)}
              >
                Подсказка 💡
              </Button>
            }
          >
            <p class="task-hint">{props.task.hint}</p>
          </Show>
        </Show>
        <div class="simulation-scene">
          <Art id={props.task.assetId} />
          <div>
            <strong>
              В истории: {result()?.wallet ?? props.task.initialState.wallet}{" "}
              монет
            </strong>
            <Show when={props.task.initialState.goalCost}>
              <p>
                В копилке:{" "}
                {result()?.savings ?? props.task.initialState.savings} /{" "}
                {props.task.initialState.goalCost}
              </p>
              <ProgressBar
                value={result()?.savings ?? props.task.initialState.savings}
                max={props.task.initialState.goalCost}
                label="Мечта в учебной истории"
              />
            </Show>
            <Show when={props.task.type === "shopping_cart"}>
              <p>
                Сумма: {result()?.cartTotal ?? 0} /{" "}
                {props.task.initialState.wallet}
              </p>
            </Show>
            <Show when={props.task.type === "allocate_budget"}>
              <p>Распределено: {result()?.totalAllocated ?? 0}</p>
              <p>
                Осталось:{" "}
                {result()?.unallocated ?? props.task.initialState.wallet}
              </p>
            </Show>
          </div>
        </div>
        <Show when={generation()} keyed>
          {(_generation) => (
            <Switch>
              <Match when={props.task.type === "allocate_budget"}>
                <AllocateBudgetTask
                  task={props.task}
                  initial={submission()}
                  onSubmit={submit}
                />
              </Match>
              <Match when={props.task.type === "shopping_cart"}>
                <ShoppingCartTask
                  task={props.task}
                  initial={submission()}
                  onSubmit={submit}
                />
              </Match>
              <Match
                when={[
                  "prioritize",
                  "savings_choice",
                  "unexpected_expense",
                  "goal_vs_want",
                ].includes(props.task.type)}
              >
                <DecisionChoices
                  task={props.task}
                  onSubmit={submit}
                  reset={reset}
                />
              </Match>
            </Switch>
          )}
        </Show>
        <Show
          when={
            ["allocate_budget", "shopping_cart"].includes(props.task.type) &&
            result()
          }
        >
          <Button onClick={() => setReactionOpen(true)}>Проверить ответ</Button>
        </Show>
        <Show when={error()}>
          <p role="alert">{error()}</p>
        </Show>
        <GameError />
        <Show when={result()?.successful && !reactionOpen()}>
          <Button onClick={() => setReactionOpen(true)}>
            Посмотреть результат
          </Button>
        </Show>
      </Show>
    </section>
  );
}
