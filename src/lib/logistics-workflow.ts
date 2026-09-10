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

export function logisticsTaskType(status: string): LogisticsTaskType {
  return status === "IN_STORAGE" || status === "OUT_FOR_DELIVERY" ? "delivery" : "pickup";
}

/** Valid next actions for the booking's current persisted workflow state. */
export function availableLogisticsActions(status: string, trackingStarted: boolean): LogisticsAction[] {
  switch (status) {
    case "CONFIRMED":
      return trackingStarted ? ["arrive-pickup"] : ["start-pickup"];
    case "RECEIVED":
      return ["complete-pickup"];
    case "IN_STORAGE":
      return ["start-delivery"];
    case "OUT_FOR_DELIVERY":
      // Support older records that reached this status without starting live tracking.
      return trackingStarted ? ["arrive-delivery", "complete-delivery"] : ["start-delivery"];
    default:
      return [];
  }
}
