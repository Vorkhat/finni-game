import { readPreferences } from "./preferences-storage";
export type GameSound = "correct" | "incorrect" | "milestone" | "coins";
const clips = new Map<GameSound, HTMLAudioElement>();
let active: HTMLAudioElement | undefined;
export function stopGameSounds() {
  if (active) {
    active.onended = null;
    active.pause();
    active.currentTime = 0;
    active = undefined;
  }
}
function clip(sound: GameSound) {
  let audio = clips.get(sound);
  if (!audio) {
    audio = new Audio(`/assets/finni/audio/${sound}.mp3`);
    audio.preload = "auto";
    audio.volume = 0.65;
    clips.set(sound, audio);
  }
  return audio;
}
export function preloadGameSounds() {
  try {
    for (const sound of ["correct", "incorrect", "milestone", "coins"] as const) clip(sound).load();
  } catch { /* Audio may be unavailable in a restricted webview. */ }
}
/** One effect at a time. A bundle's coin sound follows the correct-answer sound. */
export function playGameSound(sound: GameSound, followUp?: GameSound) {
  stopGameSounds();
  if (!readPreferences().sound) return;
  try {
    const audio = clip(sound);
    active = audio;
    audio.onended = () => {
      if (active !== audio) return;
      active = undefined;
      audio.onended = null;
      if (followUp) playGameSound(followUp);
    };
    void audio.play().catch(() => {
      if (active === audio) stopGameSounds();
    });
  } catch {
    // Sound restrictions or missing audio never block a game action.
  }
}
