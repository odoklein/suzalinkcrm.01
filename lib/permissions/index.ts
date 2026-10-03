// Permission types
export * from "./types";

// Permission provider and hooks
export {
    PermissionProvider,
    usePermissions,
    useHasPermission,
    useHasAnyPermission,
    useHasAllPermissions,
} from "./PermissionProvider";

// Re-export guard component
export { PermissionGuard, withPermission } from "@/components/guards/PermissionGuard";
