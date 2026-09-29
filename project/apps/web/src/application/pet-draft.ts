import { petSpecies } from "../assets/registry";
const key = "finni.pet-draft";
export function readPetDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "{}");
    const species =
      petSpecies.find((p) => p.species === raw.species) ?? petSpecies[0];
    const color =
      species.colors.find((c) => c.colorVariant === raw.color) ??
      species.colors[0];
    return {
      species,
      color,
      name: typeof raw.name === "string" ? raw.name.slice(0, 64) : "Финни",
    };
  } catch {
    return {
      species: petSpecies[0],
      color: petSpecies[0].colors[0],
      name: "Финни",
    };
  }
}
export function savePetDraft(species: string, color: string, name: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ species, color, name }));
  } catch {
    /* Final profile save reports storage errors. */
  }
}
export function clearPetDraft() {
  try {
    localStorage.removeItem(key);
  } catch {
    /* An obsolete draft never replaces a saved profile. */
  }
}
