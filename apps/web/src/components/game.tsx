import { usePetText } from "../application/game-context";
import { profileGoals } from "@finni/content";
import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import {
  calculateGoalProgress,
  type GameProfile,
  type PetState,
  type PetStage,
} from "@finni/shared";
import { goals, interfaceContent } from "@finni/content";
import { getPetAsset, petAssets } from "../assets/registry";
import { NeedMeter } from "./NeedMeter";
import { Art, ProgressBar } from "./ui";

export function PetImage(props: {
  species: string;
  colorVariant: string;
  stage: PetStage;
  name: string;
  emotion?: string;
  class?: string;
}) {
  const [failed, setFailed] = createSignal<string[]>([]);
  const source = () => {
    const stages = petAssets[props.species]?.[props.colorVariant];
    const order: PetStage[] = ["BABY", "EXPLORER", "FINNI_PRO"];
    const candidates = [
      getPetAsset({ ...props, emotion: props.emotion ?? "idle" }),
      stages?.[props.stage]?.idle,
      ...order
        .slice(0, order.indexOf(props.stage))
        .reverse()
        .map((stage) => stages?.[stage]?.idle),
    ];
    return candidates.find((src) => src && !failed().includes(src));
  };
  return (
    <Show
      when={source()}
      fallback={
        <p class="asset-unavailable">
          Образ «{props.name}» пока недоступен. Твой прогресс сохранён.
        </p>
      }
    >
      {(src) => (
        <img
          data-testid="pet-image"
          class={`pet-image ${props.class ?? ""}`}
          src={src()}
          onError={() => setFailed((paths) => [...paths, src()!])}
          alt={`Питомец ${props.name}`}
          draggable={false}
        />
      )}
    </Show>
  );
}
export function PetStatus(props: { state: PetState }) {
  const petText = usePetText();
  return (
    <section class="pet-status" aria-label={petText("Состояние Финни")}>
      <For each={interfaceContent.status}>
        {(status) => (
          <div class={`status status-${status.id}`}>
            <Art id={status.assetId} />
            <div>
              <NeedMeter
                stat={status.id as keyof PetState}
                value={props.state[status.id as keyof PetState]}
                title={status.title}
              />
            </div>
          </div>
        )}
      </For>
    </section>
  );
}
export function GoalCard(props: { profile: GameProfile }) {
  const goal = () =>
    profileGoals(props.profile).find((goal) => goal.id === props.profile.selectedGoalId);
  return (
    <Show
      when={goal()}
      fallback={
        <A class="goal-card" href="/goal/select">
          Выбрать новую мечту
        </A>
      }
    >
      {(goal) => (
        <A
          class="goal-card"
          href="/progress"
          aria-label={`Моя цель: ${goal().title}`}
        >
          <span class="eyebrow">Моя мечта</span>
          <Art id={goal().assetId} alt={goal().title} />
          <strong>{goal().title}</strong>
          <ProgressBar
            value={calculateGoalProgress(props.profile, goal())}
            label="Прогресс цели"
          />
          <span data-testid="goal-balance">
            {props.profile.savingsBalance} / {goal().cost}
          </span>
        </A>
      )}
    </Show>
  );
}
export function BottomNavigation() {
  return (
    <nav class="bottom-navigation" aria-label="Основные разделы">
      <For each={interfaceContent.navigation}>
        {(item) => (
          <A href={item.href} activeClass="selected" end>
            <Art id={item.assetId} />
            <span>{item.title}</span>
          </A>
        )}
      </For>
    </nav>
  );
}
