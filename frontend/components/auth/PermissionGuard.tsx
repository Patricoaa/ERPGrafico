"use client";

import { usePermission } from "@/hooks/usePermission";
import React from "react";

interface PermissionGuardProps {
    permission: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
    const hasAccess = usePermission(permission);

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
