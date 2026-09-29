export interface Preferences {
  sound: boolean;
  animations: boolean;
}

export const preferencesKey = "finni.preferences";

export function readPreferences(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(preferencesKey) ?? "{}");
    return {
      sound: raw.sound === true,
      animations: typeof raw.animations === "boolean"
        ? raw.animations
        : !matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  } catch {
    return { sound: false, animations: false };
  }
}
