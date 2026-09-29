import { createEffect, createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { PetNameSchema } from "@finni/shared";
import { petSpecies } from "../assets/registry";
import { useGame } from "../application/game-context";
import { PetImage } from "../components/game";
import { Button, ScreenHeader } from "../components/ui";

import {
  readPetDraft,
  savePetDraft,
  clearPetDraft,
} from "../application/pet-draft";

export function PetCreate(props: { newStory?: boolean } = {}) {
  const draft = readPetDraft();
  const game = useGame();
  const navigate = useNavigate();
  const [species, setSpecies] = createSignal<(typeof petSpecies)[number]>(
    draft.species,
  );
  const [color, setColor] = createSignal<{
    colorVariant: string;
    colorLabel: string;
  }>(draft.color);
  const selectSpecies = (next: (typeof petSpecies)[number]) => {
    setSpecies(next);
    setColor(next.colors[0]);
  };
  const [name, setName] = createSignal(draft.name);
  const [nameError, setNameError] = createSignal("");
  createEffect(() =>
    savePetDraft(species().species, color().colorVariant, name()),
  );
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const validated = PetNameSchema.safeParse(name());
    if (!validated.success) {
      setNameError(
        "Имя должно содержать от 2 до 16 символов. Одних пробелов недостаточно.",
      );
      return;
    }
    setNameError("");
    const ok = await game.perform((service) =>
      (props.newStory
        ? service.startNewAdventure.bind(service)
        : service.createProfile.bind(service))({
        id: crypto.randomUUID(),
        petId: crypto.randomUUID(),
        playerNickname: "Гость",
        petName: validated.data,
        appearance: {
          species: species().species,
          colorVariant: color().colorVariant,
          accessoryVariant: species().accessoryVariant,
        },
        now: new Date().toISOString(),
      }),
    );
    if (ok) {
      clearPetDraft();
      navigate("/goal/select", { replace: true });
    }
  };
  return (
    <main class="setup-page">
      <ScreenHeader back={props.newStory ? "/finale" : "/onboarding"} />
      <form class="setup-content create-form" onSubmit={submit}>
        <span class="eyebrow">Твой новый друг</span>
        <h1>Выбери своего Финни</h1>
        <Show when={props.newStory}>
          <p>Начнём новую историю. Предыдущий друг останется в альбоме.</p>
        </Show>
        <div class="creation-preview">
          <PetImage
            species={species().species}
            colorVariant={color().colorVariant}
            stage="BABY"
            name={name().trim() || "Финни"}
          />
        </div>
        <div class="pet-choices" role="group" aria-label="Выбор персонажа">
          <For each={petSpecies}>
            {(pet) => (
              <button
                type="button"
                class="pet-choice"
                aria-pressed={species().species === pet.species}
                onClick={() => selectSpecies(pet)}
              >
                <PetImage
                  species={pet.species}
                  colorVariant={pet.colors[0].colorVariant}
                  stage="BABY"
                  name={pet.label}
                />
                <span>{pet.label}</span>
                <span class="choice-check" aria-hidden="true">
                  {species().species === pet.species ? "✓" : ""}
                </span>
              </button>
            )}
          </For>
        </div>
        <div class="appearance-choice" role="group" aria-label="Выбор цвета">
          <For each={species().colors}>
            {(option) => (
              <button
                type="button"
                class="appearance-option"
                aria-pressed={color().colorVariant === option.colorVariant}
                aria-label={`Цвет: ${option.colorLabel}`}
                onClick={() => setColor(option)}
              >
                <span class={`color-dot ${option.colorVariant}`} />
                <span>{option.colorLabel}</span>
                <Show when={color().colorVariant === option.colorVariant}>
                  <span aria-hidden="true">✓</span>
                </Show>
              </button>
            )}
          </For>
        </div>
        <label class="field-label" for="pet-name">
          Как назовём питомца?
        </label>
        <input
          id="pet-name"
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          autocomplete="off"
          spellcheck={false}
          aria-invalid={Boolean(nameError())}
          aria-describedby="pet-name-hint"
        />
        <span class="field-hint" id="pet-name-hint">
          Имя друга, а не твоё. От 2 до 16 символов.
        </span>
        <Show when={nameError() || game.error()}>
          <p class="error-message" role="alert">
            {nameError() || game.error()}
          </p>
        </Show>
        <Button type="submit" disabled={game.busy()}>
          {game.busy() ? "Сохраняем…" : "Готово"}{" "}
          <span aria-hidden="true">→</span>
        </Button>
      </form>
    </main>
  );
}
