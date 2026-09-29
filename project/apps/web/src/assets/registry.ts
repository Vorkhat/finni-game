import type { PetStage } from "@finni/shared";

const base = "/assets/finni/";
export const itemAssets = Object.fromEntries(
  [
    "breakfast",
    "lunch",
    "care",
    "snack",
    "ball",
    "cap",
    "toy",
    "icecream",
    "game",
    "balloon",
  ].map((id) => [`item-${id}`, `${base}items/item-${id}.webp`]),
);
export const goalAssets = Object.fromEntries(
  ["scooter", "pet-house", "space-trip"].map((id) => [
    `goal-${id}`,
    `${base}goals/goal-${id}.webp`,
  ]),
);
export const statusAssets = Object.fromEntries(
  ["satiety", "mood", "care"].map((id) => [
    `icon-${id}`,
    `${base}icons/icon-${id}.webp`,
  ]),
);
export const navigationAssets = Object.fromEntries(
  ["home", "tasks", "shop", "savings", "goals"].map((id) => [
    `icon-${id}`,
    `${base}icons/icon-${id}.${id === "tasks" ? "png" : "webp"}`,
  ]),
);
export const uiAssets = {
  "icon-coin": `${base}icons/icon-coin.webp`,
  "icon-settings": `${base}icons/icon-settings.webp`,
  "logo-finni": `${base}branding/logo-finni.webp`,
};
export const backgroundAssets = { room: `${base}backgrounds/room-main.webp` };
export const assetRegistry: Readonly<Record<string, string>> = {
  ...itemAssets,
  ...goalAssets,
  "goal-custom": `${base}goals/goal-custom.svg`, 
  ...statusAssets,
  ...navigationAssets,
  ...uiAssets,
};
export function getAsset(id: string): string {
  const src = assetRegistry[id];
  if (!src) throw new Error(`Unknown production asset: ${id}`);
  return src;
}

/** Life-situation illustrations live in their own folder, keyed by image name. */
export function situationAsset(key: string): string {
  return `${base}program/${key}.webp`;
}

export const petSpecies = [
  {
    species: "cat",
    label: "Котик",
    accessoryVariant: "green-scarf",
    emotions: ["idle", "happy", "sad", "surprised", "determined"],
    colors: [
      { colorVariant: "ginger", colorLabel: "Рыжий" },
      { colorVariant: "white", colorLabel: "Белый" },
      { colorVariant: "black", colorLabel: "Чёрный" },
    ],
  },
  {
    species: "dragon",
    label: "Дракончик",
    accessoryVariant: "gold-medallion",
    emotions: ["idle", "sad", "surprised", "determined"],
    colors: [
      { colorVariant: "turquoise", colorLabel: "Бирюзовый" },
      { colorVariant: "green", colorLabel: "Зелёный" },
      { colorVariant: "purple", colorLabel: "Фиолетовый" },
    ],
  },
  {
    species: "dog",
    label: "Собачка",
    accessoryVariant: "green-scarf",
    emotions: ["idle", "happy", "sad", "surprised", "determined"],
    colors: [
      { colorVariant: "dalmatian", colorLabel: "Далматинец" },
      { colorVariant: "brown", colorLabel: "Коричневый" },
      { colorVariant: "husky", colorLabel: "Хаски" },
    ],
  },
] as const;

/** Flat species×colour list. `petOptions[0]` stays cat/ginger (default pick). */
export const petOptions = petSpecies.flatMap((species) =>
  species.colors.map((color) => ({
    species: species.species,
    label: species.label,
    colorVariant: color.colorVariant,
    colorLabel: color.colorLabel,
    accessoryVariant: species.accessoryVariant,
  })),
);

export const petAssets: Record<
  string,
  Record<string, Record<PetStage, Record<string, string>>>
> = {};
for (const species of petSpecies) {
  petAssets[species.species] = {};
  for (const color of species.colors) {
    const stages = {} as Record<PetStage, Record<string, string>>;
    for (const [stage, fileStage] of Object.entries({
      BABY: "baby",
      EXPLORER: "explorer",
      FINNI_PRO: "finni-pro",
    })) {
      stages[stage as PetStage] = Object.fromEntries(
        species.emotions.map((emotion) => [
          emotion,
          `${base}characters/pet-${species.species}-${color.colorVariant}-${fileStage}-${emotion}.webp`,
        ]),
      );
    }
    petAssets[species.species]![color.colorVariant] = stages;
  }
}

/** Fall back within the same species/colour, first to idle, then to an earlier stage. */
export function getPetAsset(options: {
  species: string;
  stage: PetStage;
  emotion: string;
  colorVariant: string;
}): string | null {
  const stages = petAssets[options.species]?.[options.colorVariant];
  const emotions = stages?.[options.stage];
  const exact = emotions?.[options.emotion];
  if (exact) return exact;
  const ordered: PetStage[] = ["BABY", "EXPLORER", "FINNI_PRO"];
  const previous = ordered.slice(0, ordered.indexOf(options.stage)).reverse();
  const fallback =
    emotions?.idle ??
    previous.map((stage) => stages?.[stage]?.idle).find(Boolean) ??
    null;
  if (
    (import.meta as ImportMeta & { env?: { DEV: boolean } }).env?.DEV &&
    !emotions?.idle
  )
    console.warn("Finni asset fallback", options.species, options.stage);
  return fallback;
}

export const programAsset = (key: string) => `/assets/finni/program/${key}.webp`;
