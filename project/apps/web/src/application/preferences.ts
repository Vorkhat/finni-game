import { preloadGameSounds, stopGameSounds } from "./sounds";
import { onCleanup, onMount } from "solid-js";
import { preferencesKey, readPreferences, type Preferences } from "./preferences-storage";
export { readPreferences, type Preferences } from "./preferences-storage";
export function savePreferences(value: Preferences) {
  localStorage.setItem(preferencesKey, JSON.stringify(value));
  if (!value.sound) stopGameSounds();
  document.documentElement.dataset.animations = String(value.animations);
}
export function applyPreferences() {
  onMount(() => {
    document.documentElement.dataset.animations = String(
      readPreferences().animations,
    );
    preloadGameSounds();
    let audio: AudioContext | undefined;
    const replaced = new WeakSet<Event>();
    const captureSound = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('[data-sound="replace"], a[href="/day/evolution"], a[href="/day/start"], a[href="/finale"]')) replaced.add(event);
    };
    const clickSound = (event: MouseEvent) => {
      if (
        !readPreferences().sound || replaced.has(event) ||
        !(event.target as Element | null)?.closest("button, a.button") ||
        (event.target as Element | null)?.closest('[data-sound="replace"], a[href="/day/evolution"], a[href="/day/start"], a[href="/finale"]')
      )
        return;
      try {
        audio ??= new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 520;
        gain.gain.setValueAtTime(0.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.06);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.06);
      } catch {
        // Audio is optional; a blocked device audio context must not block play.
      }
    };
    document.addEventListener("click", captureSound, true);
    document.addEventListener("click", clickSound);
    onCleanup(() => {
      document.removeEventListener("click", captureSound, true);
      document.removeEventListener("click", clickSound);
      stopGameSounds();
      void audio?.close();
    });
  });
}
