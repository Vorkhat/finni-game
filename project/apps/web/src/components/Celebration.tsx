import { usePetText } from "../application/game-context";
import { playGameSound } from "../application/sounds";
import { createEffect, on, For, Show, type JSX } from "solid-js";
import { useGame } from "../application/game-context";
import { PetImage } from "./game";
import { Modal, Button } from "./ui";

export function AnswerReaction(props: {
  open: boolean;
  success: boolean;
  text?: string;
  actionLabel?: string;
  rewardSound?: boolean;
  actionSound?: boolean;
  onAction?: () => void;
  busy?: boolean;
  error?: string;
  onClose: () => void;
}) {
  const petText = usePetText();
  createEffect(on(() => props.open, open => {
    if (open) playGameSound(props.success ? "correct" : "incorrect", props.success && props.rewardSound ? "coins" : undefined);
  }));
  return (
    <Modal
      open={props.open}
      title={
        props.success
          ? petText("Верно! Финни радуется!")
          : "Не совсем. Попробуй ещё раз!"
      }
      onClose={() => {
        if (!props.busy) props.onClose();
      }}
    >
      <ResultCelebration success={props.success}>
        <p>
          {(props.text ? petText(props.text) : undefined) ??
            (props.success
              ? "Отличное решение!"
              : petText("Финни загрустил. Ничего страшного — можно попробовать снова."))}
        </p>
        <Show when={props.error}>
          <p role="alert">{props.error}</p>
        </Show>
        <Button data-sound={props.actionSound ? "replace" : undefined} disabled={props.busy} onClick={props.onAction ?? props.onClose}>
          {props.actionLabel ??
            (props.success ? "Здорово!" : "Попробовать ещё раз")}
        </Button>
      </ResultCelebration>
    </Modal>
  );
}

/** Pet reacts to a result: happy on success, sad otherwise.
 *  Dragons use their smiling idle image for happy; sad has its own artwork. */
export function PetReaction(props: { mood: "happy" | "sad" }) {
  const game = useGame();
  return (
    <Show when={game.profile()}>
      {(profile) => (
        <PetImage
          {...profile().pet.appearance}
          stage={profile().pet.stage}
          name={profile().pet.name}
          emotion={props.mood}
          class={`reaction-pet mood-${props.mood}`}
        />
      )}
    </Show>
  );
}

/** Purely decorative CSS fireworks; suppressed when the player disabled animations. */
export function Fireworks() {
  return (
    <div class="fireworks" aria-hidden="true">
      <For each={[0, 1, 2, 3, 4]}>
        {(i) => <span class={`firework firework-${i}`} />}
      </For>
    </div>
  );
}

/** Result banner: fireworks + happy pet on success, a gentle sad pet otherwise. */
export function ResultCelebration(props: {
  success: boolean;
  children?: JSX.Element;
}) {
  return (
    <section
      class="result-celebration"
      classList={{ success: props.success, fail: !props.success }}
      role="status"
    >
      <div class="celebration-stage">
        <Show when={props.success}>
          <Fireworks />
        </Show>
        <PetReaction mood={props.success ? "happy" : "sad"} />
      </div>
      {props.children}
    </section>
  );
}
