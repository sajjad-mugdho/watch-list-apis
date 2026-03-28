export const NOTIFICATION_CATEGORY_VALUES = [
  "buying",
  "selling",
  "social",
  "system",
] as const;

export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORY_VALUES)[number];

// Canonical category mapping for known networks notification types.
export const NETWORKS_NOTIFICATION_TYPE_CATEGORY: Record<
  string,
  NotificationCategory
> = {
  offer_received: "selling",
  offer_accepted: "buying",
  offer_rejected: "buying",
  offer_expired: "buying",
  counter_offer: "buying",
  order_created: "selling",
  order_shipped: "buying",
  order_delivered: "buying",
  order_update: "system",
  iso_match: "buying",
  listing_favorited: "selling",
  friend_request_received: "social",
  friend_request_accepted: "social",
  follow_received: "social",
  new_message: "social",
};

export const resolveNotificationCategory = (
  type: string,
): NotificationCategory => {
  return NETWORKS_NOTIFICATION_TYPE_CATEGORY[type] || "system";
};
