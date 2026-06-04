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
  return initialStatusFromLists(DEFAULT_STATUS_LISTS, serviceType);
}

export function completedStatusForService(serviceType: string | undefined | null) {
  return completedStatusFromLists(DEFAULT_STATUS_LISTS, serviceType);
}

export function initialStatusFromLists(lists: StatusLists, serviceType: string | undefined | null) {
  const options = isPurchaseServiceType(serviceType) ? lists.purchase : lists.repair;
  return options[0] ?? "";
}

export function completedStatusFromLists(lists: StatusLists, serviceType: string | undefined | null) {
  const options = isPurchaseServiceType(serviceType) ? lists.purchase : lists.repair;
  return options[1] ?? options[0] ?? "";
}

export function isInitialStatusForService(lists: StatusLists, serviceType: string | undefined | null, status: string | undefined | null) {
  return String(status ?? "") === initialStatusFromLists(lists, serviceType);
}
