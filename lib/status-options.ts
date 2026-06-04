import { DEFAULT_PURCHASE_STATUSES, DEFAULT_STATUSES } from "@/lib/constants";

export type StatusLists = {
  repair: string[];
  purchase: string[];
};

export const DEFAULT_STATUS_LISTS: StatusLists = {
  repair: [...DEFAULT_STATUSES],
  purchase: [...DEFAULT_PURCHASE_STATUSES],
};

export function isPurchaseServiceType(serviceType: string | undefined | null) {
  return String(serviceType ?? "").includes("買取");
}

export function statusOptionsForService(lists: StatusLists, serviceType: string | undefined | null, currentStatus?: string) {
  const base = isPurchaseServiceType(serviceType) ? lists.purchase : lists.repair;
  const current = String(currentStatus ?? "").trim();
  return current && !base.includes(current) ? [current, ...base] : base;
}

export function combinedStatusOptions(lists: StatusLists) {
  return Array.from(new Set([...lists.repair, ...lists.purchase]));
}

export function initialStatusForService(serviceType: string | undefined | null) {
  return isPurchaseServiceType(serviceType) ? DEFAULT_STATUS_LISTS.purchase[0] : DEFAULT_STATUS_LISTS.repair[0];
}

export function completedStatusForService(serviceType: string | undefined | null) {
  return isPurchaseServiceType(serviceType) ? DEFAULT_STATUS_LISTS.purchase[1] : DEFAULT_STATUS_LISTS.repair[1];
}
