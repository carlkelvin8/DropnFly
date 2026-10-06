export const LOGISTICS_ACTION_META = {
  "start-pickup": { label: "Start Pickup" },
  "arrive-pickup": { label: "Arrived at Location" },
  "complete-pickup": { label: "Complete Pickup" },
  "start-delivery": { label: "Start Delivery" },
  "arrive-delivery": { label: "Arrived at Location" },
  "complete-delivery": { label: "Complete Delivery" },
} as const;

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
