export interface ClosestHost {
  closest?: (selector: string) => unknown;
}

/**
 * Heading focus is only suppressed while focus lives inside an open dialog.
 * Bottom-navigation and other SPA transitions must still announce `main h1`.
 */
export function focusIsInsideDialog(active: ClosestHost | null): boolean {
  return typeof active?.closest === "function"
    ? !!active.closest("[role='dialog'], [role='alertdialog']")
    : false;
}
