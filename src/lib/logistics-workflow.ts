export const LOGISTICS_ACTION_META = {
  "start-pickup": { label: "Start Pickup" },
  "arrive-pickup": { label: "Arrived at Location" },
  "complete-pickup": { label: "Complete Pickup" },
  "start-delivery": { label: "Start Delivery" },
  "arrive-delivery": { label: "Arrived at Location" },
  "complete-delivery": { label: "Complete Delivery" },
} as const;

/**
 * Statuses that start a new logistics phase. Live tracking is per-phase and must be
 * started by the assigned employee, so entering one of these clears any leftover
 * tracking state from the previous phase (set when scanner/staff moved the booking
 * without the employee tapping Complete).
 */
export function trackingResetForStatus(status: string): { pickupStartedAt: null; deliveryArrivedAt: null } | Record<string, never> {
  return ["IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "NO_SHOW"].includes(status)
    ? { pickupStartedAt: null, deliveryArrivedAt: null }
    : {};
}

export type LogisticsAction = keyof typeof LOGISTICS_ACTION_META;
export type LogisticsTaskType = "pickup" | "delivery";

export const LOGISTICS_ACTION_STATUS = {
  "start-pickup": "CONFIRMED",
  "arrive-pickup": "CONFIRMED",
  // Warehouse intake, not transport completion, owns IN_STORAGE.
  "complete-pickup": "RECEIVED",
  "start-delivery": "OUT_FOR_DELIVERY",
  "arrive-delivery": "OUT_FOR_DELIVERY",
  "complete-delivery": "DELIVERED",
} as const satisfies Record<LogisticsAction, string>;

export function logisticsTaskType(status: string): LogisticsTaskType {
  return status === "IN_STORAGE" || status === "OUT_FOR_DELIVERY" ? "delivery" : "pickup";
}

/** Valid next actions for the booking's current persisted workflow state. */
export function availableLogisticsActions(
  status: string,
  trackingStarted: boolean,
  deliveryArrived = false,
  pickupArrived = false,
  pickupCompleted = false,
): LogisticsAction[] {
  switch (status) {
    case "CONFIRMED":
      return trackingStarted ? (pickupArrived ? [] : ["arrive-pickup"]) : ["start-pickup"];
    case "RECEIVED":
      return pickupCompleted ? [] : ["complete-pickup"];
    case "IN_STORAGE":
      return ["start-delivery"];
    case "OUT_FOR_DELIVERY":
      // Support older records that reached this status without starting live tracking.
      if (!trackingStarted) return ["start-delivery"];
      return deliveryArrived ? ["complete-delivery"] : ["arrive-delivery"];
    default:
      return [];
  }
}

export interface TaskAssignmentLike {
  userId: string;
  phase: string;
}

/**
 * Picks the assignment a viewer should see for a booking. Admin/staff always see the
 * active-phase assignee. An employee assigned only to a later phase (e.g. drop-off while
 * the booking is still being picked up) sees it as an upcoming task with no actions.
 */
export function resolveTaskAssignment<T extends TaskAssignmentLike>(
  assignments: T[],
  status: string,
  viewerId: string,
  viewerIsOperator: boolean
): { assignment: T | null; taskType: LogisticsTaskType; isUpcoming: boolean } {
  const taskType = logisticsTaskType(status);
  const activePhase = taskType === "delivery" ? "DROPOFF" : "PICKUP";
  const active = assignments.find((a) => a.phase === activePhase) || null;
  if (viewerIsOperator || active?.userId === viewerId) return { assignment: active, taskType, isUpcoming: false };
  // Only a LATER phase is upcoming. An earlier phase the viewer already finished (e.g. their
  // pick-up while the booking is now in delivery) is history, not a task to show.
  const upcoming = activePhase === "PICKUP"
    ? assignments.find((a) => a.userId === viewerId && a.phase === "DROPOFF") || null
    : null;
  if (!upcoming) return { assignment: active, taskType, isUpcoming: false };
  return { assignment: upcoming, taskType: upcoming.phase === "DROPOFF" ? "delivery" : "pickup", isUpcoming: true };
}
