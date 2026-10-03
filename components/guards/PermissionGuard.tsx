"use client";

import React from "react";
import { useHasPermission, useHasAnyPermission, useHasAllPermissions, usePermissions } from "@/lib/permissions/PermissionProvider";

// ============================================
// PERMISSION GUARD COMPONENT
// ============================================

interface PermissionGuardProps {
    children: React.ReactNode;
    permission?: string;               // Single permission to check
    permissions?: string[];            // Multiple permissions
    requireAll?: boolean;              // If true, requires all permissions; if false, requires any
    fallback?: React.ReactNode;        // What to render if permission denied
    showLoading?: boolean;             // Show loading state
    loadingFallback?: React.ReactNode; // Custom loading component
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * Usage:
 * ```tsx
 * // Single permission
 * <PermissionGuard permission="features.create_mission">
 *   <CreateMissionButton />
 * </PermissionGuard>
 * 
 * // Any of multiple permissions
 * <PermissionGuard permissions={["features.edit_mission", "features.delete_mission"]}>
 *   <MissionActions />
 * </PermissionGuard>
 * 
 * // All permissions required
 * <PermissionGuard permissions={["features.edit_mission", "features.assign_sdr"]} requireAll>
 *   <AdvancedMissionPanel />
 * </PermissionGuard>
 * 
 * // With fallback
 * <PermissionGuard permission="pages.analytics" fallback={<UpgradePrompt />}>
 *   <AnalyticsDashboard />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
    children,
    permission,
    permissions,
    requireAll = false,
    fallback = null,
    showLoading = false,
    loadingFallback,
}: PermissionGuardProps) {
    const { isLoading } = usePermissions();
    
    // Show loading state if requested
    if (isLoading && showLoading) {
        return loadingFallback ? <>{loadingFallback}</> : null;
    }

    // Check single permission
    if (permission) {
        return <SinglePermissionGuard permission={permission} fallback={fallback}>
            {children}
        </SinglePermissionGuard>;
    }

    // Check multiple permissions
    if (permissions && permissions.length > 0) {
        return requireAll ? (
            <AllPermissionsGuard permissions={permissions} fallback={fallback}>
                {children}
            </AllPermissionsGuard>
        ) : (
            <AnyPermissionGuard permissions={permissions} fallback={fallback}>
                {children}
            </AnyPermissionGuard>
        );
    }

    // No permissions specified, render children
    return <>{children}</>;
}

// ============================================
// INTERNAL GUARD COMPONENTS
// ============================================

function SinglePermissionGuard({
    permission,
    children,
    fallback,
}: {
    permission: string;
    children: React.ReactNode;
    fallback: React.ReactNode;
}) {
    const hasPermission = useHasPermission(permission);
    return hasPermission ? <>{children}</> : <>{fallback}</>;
}

function AnyPermissionGuard({
    permissions,
    children,
    fallback,
}: {
    permissions: string[];
    children: React.ReactNode;
    fallback: React.ReactNode;
}) {
    const hasAny = useHasAnyPermission(permissions);
    return hasAny ? <>{children}</> : <>{fallback}</>;
}

function AllPermissionsGuard({
    permissions,
    children,
    fallback,
}: {
    permissions: string[];
    children: React.ReactNode;
    fallback: React.ReactNode;
}) {
    const hasAll = useHasAllPermissions(permissions);
    return hasAll ? <>{children}</> : <>{fallback}</>;
}

// ============================================
// HIGHER-ORDER COMPONENT
// ============================================

/**
 * HOC to wrap a component with permission check
 */
export function withPermission<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    permission: string,
    FallbackComponent?: React.ComponentType
) {
    return function PermissionWrappedComponent(props: P) {
        return (
            <PermissionGuard 
                permission={permission} 
                fallback={FallbackComponent ? <FallbackComponent /> : null}
            >
                <WrappedComponent {...props} />
            </PermissionGuard>
        );
    };
}

export default PermissionGuard;
