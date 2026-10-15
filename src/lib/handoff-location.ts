/** Pickup / drop-off location is empty when the customer did not avail the
 * pick-up or delivery service — they hand over / collect the bags themselves. */
export const PERSONAL_HANDOFF_LABEL = "Personal";

export function displayHandoffLocation(value: string | null | undefined): string {
  return value && value.trim() ? value : PERSONAL_HANDOFF_LABEL;
}

export function isPersonalHandoff(value: string | null | undefined): boolean {
  return !value || !value.trim();
}
