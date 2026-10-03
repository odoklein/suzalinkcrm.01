import type { UserRole } from "@prisma/client";

export type MissionStatusValue = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export type MissionStatusColor =
  | "slate"
  | "emerald"
  | "amber"
  | "blue"
  | "zinc";

export interface MissionStatusMeta {
  value: MissionStatusValue;
  label: string;
  color: MissionStatusColor;
  icon: "file-text" | "play-circle" | "pause-circle" | "check-circle-2" | "archive";
}

export const MISSION_STATUS_CONFIG: Record<MissionStatusValue, MissionStatusMeta> = {
  DRAFT: { value: "DRAFT", label: "Brouillon", color: "slate", icon: "file-text" },
  ACTIVE: { value: "ACTIVE", label: "Active", color: "emerald", icon: "play-circle" },
  PAUSED: { value: "PAUSED", label: "En pause", color: "amber", icon: "pause-circle" },
  COMPLETED: { value: "COMPLETED", label: "Terminée", color: "blue", icon: "check-circle-2" },
  ARCHIVED: { value: "ARCHIVED", label: "Archivée", color: "zinc", icon: "archive" },
};

export const MISSION_STATUS_ORDER: MissionStatusValue[] = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
];

export const MISSION_STATUS_TABS: Array<{ value: "all" | MissionStatusValue; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "ACTIVE", label: "Actives" },
  { value: "PAUSED", label: "En pause" },
  { value: "COMPLETED", label: "Terminées" },
  { value: "ARCHIVED", label: "Archivées" },
];

export const MISSION_STATUS_TRANSITIONS: Record<MissionStatusValue, MissionStatusValue[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "COMPLETED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["DRAFT", "ACTIVE"],
};

export const MISSION_STATUS_ROLE_PERMISSIONS: Record<UserRole, Partial<Record<MissionStatusValue, MissionStatusValue[]>>> = {
  MANAGER: MISSION_STATUS_TRANSITIONS,
  BUSINESS_DEVELOPER: {
    DRAFT: ["ACTIVE"],
    ACTIVE: ["PAUSED", "COMPLETED"],
    PAUSED: ["ACTIVE", "COMPLETED"],
    COMPLETED: ["ACTIVE"],
  },
  BOOKER: {
    ACTIVE: ["PAUSED"],
    PAUSED: ["ACTIVE"],
  },
  SDR: {},
  CLIENT: {},
  DEVELOPER: MISSION_STATUS_TRANSITIONS,
  COMMERCIAL: {},
};

export const SDR_VISIBLE_MISSION_STATUSES: MissionStatusValue[] = ["ACTIVE"];
export const WORKABLE_MISSION_STATUSES: MissionStatusValue[] = ["ACTIVE"];

export function getMissionStatusLabel(status: MissionStatusValue): string {
  return MISSION_STATUS_CONFIG[status].label;
}

export function isMissionWorkable(status: MissionStatusValue): boolean {
  return WORKABLE_MISSION_STATUSES.includes(status);
}

export function canTransitionMissionStatus(
  currentStatus: MissionStatusValue,
  nextStatus: MissionStatusValue,
  role: UserRole
): boolean {
  const allowedForRole = MISSION_STATUS_ROLE_PERMISSIONS[role]?.[currentStatus] ?? [];
  return allowedForRole.includes(nextStatus);
}
