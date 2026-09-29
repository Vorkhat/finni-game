import type { GameProfile } from "@finni/shared";

export function bootDestination(profile: GameProfile | null): string {
  return !profile
    ? "/onboarding"
    : !profile.selectedGoalId
      ? "/goal/select"
      : "/home";
}
