import { usePetText } from "../application/game-context";
import { For, Show, onMount, type ParentProps } from "solid-js";
import { A } from "@solidjs/router";
import {
  activeDayPreview,
  type BudgetValues,
  type GameProfile,
} from "@finni/shared";
import { interfaceContent } from "@finni/content";
import { useGame } from "../application/game-context";
import { Art, BalanceBadge, Button, ScreenHeader } from "./ui";
import { BottomNavigation, PetImage } from "./game";
import { DemoGuide } from "./demo";

export const budgetCategories = [
  {
    field: "plannedMandatory",
    simulation: "mandatory",
    ...interfaceContent.concepts[0]!,
  },
  {
    field: "plannedOptional",
    simulation: "optional",
    ...interfaceContent.concepts[1]!,
  },
  {
    field: "plannedSavings",
    simulation: "savings",
    ...interfaceContent.concepts[2]!,
  },
] as const;
export function GameScreen(
  props: ParentProps<{ title: string; back?: string; focused?: boolean }>,
) {
  const game = useGame();
  onMount(game.clearError);
  return (
    <main class="game-screen">
      <ScreenHeader title={props.title} back={props.back} />
      <div class="game-content">
        <DemoGuide />
        {props.children}
      </div>
      <Show when={!props.focused}>
        <BottomNavigation />
      </Show>
    </main>
  );
}
export function GameError() {
  const game = useGame();
  return (
    <Show when={game.error()}>
      <p class="game-error" role="alert">
        {game.error()}
      </p>
    </Show>
  );
}
export function ActiveDayGate(props: ParentProps) {
  const game = useGame();
  return (
    <Show
      when={game.profile()?.currentPeriod?.status === "ACTIVE"}
      fallback={
        <section class="day-gate">
          <Art id="icon-coin" />
          <h1>Сначала составим план</h1>
          <p>Решим, на что пойдут монетки. А потом — к покупкам и историям!</p>
          <A
            class="button"
            href={game.profile()?.currentPeriod ? "/budget" : "/day/start"}
          >
            Составить план
          </A>
        </section>
      }
    >
      {props.children}
    </Show>
  );
}
export function WalletRow() {
  const game = useGame();
  return (
    <div class="wallet-row">
      <span>В кошельке</span>
      <BalanceBadge amount={game.profile()?.walletBalance ?? 0} />
    </div>
  );
}
export function AmountControl(props: {
  label: string;
  value: number;
  step?: number;
  disabled?: boolean;
  onChange: (delta: number) => void;
}) {
  return (
    <div class="amount-control" role="group" aria-label={props.label}>
      <Button
        class="secondary"
        aria-label={`${props.label}: уменьшить`}
        disabled={props.disabled || props.value === 0}
        onClick={() => props.onChange(-(props.step ?? 1))}
      >
        −
      </Button>
      <output aria-label={`${props.label}: сумма`}>{props.value}</output>
      <Button
        aria-label={`${props.label}: увеличить`}
        disabled={props.disabled}
        onClick={() => props.onChange(props.step ?? 1)}
      >
        +
      </Button>
    </div>
  );
}
export function BudgetControls(props: {
  values: BudgetValues;
  step: number;
  disabled?: boolean;
  onChange: (field: keyof BudgetValues, delta: number) => void;
}) {
  const petText = usePetText();
  return (
    <div class="budget-controls">
      <For each={budgetCategories}>
        {(category) => (
          <section class="allocation-card">
            <Art id={category.assetId} />
            <div>
              <h2>{category.title}</h2>
              <p>{petText(category.text)}</p>
            </div>
            <AmountControl
              label={category.title}
              value={props.values[category.field]}
              step={props.step}
              disabled={props.disabled}
              onChange={(delta) => props.onChange(category.field, delta)}
            />
          </section>
        )}
      </For>
    </div>
  );
}
export function PlanPreview(props: {
  profile: GameProfile;
  compact?: boolean;
}) {
  const preview = () => activeDayPreview(props.profile);
  return (
    <Show when={preview()}>
      {(value) => (
        <section
          class={`plan-preview ${props.compact ? "compact" : ""}`}
          aria-label="План и факт сегодня"
        >
          <Show when={!props.compact}>
            <h2>Сегодня</h2>
            <p>План — что задумали. Факт — что уже сделали.</p>
          </Show>
          <For each={budgetCategories}>
            {(category) => (
              <div>
                <span>{category.title}</span>
                <strong>
                  {value()[category.simulation].planned} /{" "}
                  {value()[category.simulation].actual}
                </strong>
                <small>план / факт</small>
              </div>
            )}
          </For>
        </section>
      )}
    </Show>
  );
}
export function HappyPet() {
  const game = useGame();
  return (
    <Show when={game.profile()}>
      {(profile) => (
        <PetImage
          {...profile().pet.appearance}
          stage={profile().pet.stage}
          name={profile().pet.name}
          emotion="happy"
          class="reaction-pet"
        />
      )}
    </Show>
  );
}
