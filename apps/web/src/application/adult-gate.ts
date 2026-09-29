export interface AdultLockPort {
  lockAdult: () => void;
}

/**
 * Entering the adult gate always revokes previously granted access so the hold
 * gesture must be repeated; the unlock state is runtime-only and never persisted.
 */
export function enterAdultGate(lock: AdultLockPort): void {
  lock.lockAdult();
}

export interface AdultHoldKey {
  key: string;
  repeat: boolean;
}

/**
 * Only the first Space/Enter press starts the 3-second hold. Auto-repeat events
 * are ignored so `preventDefault()` never fires for the whole duration of a held
 * key and assistive tech is not flooded with repeated activations.
 */
export function startsAdultHold(event: AdultHoldKey): boolean {
  return (event.key === " " || event.key === "Enter") && !event.repeat;
}
