"use client";

import { usePermission } from "@/hooks/usePermission";
import React from "react";

interface PermissionGuardProps extends React.HTMLAttributes<HTMLDivElement> {
    permission?: string | null;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
    if (!permission) {
        return <>{children}</>;
    }

    const hasAccess = usePermission(permission);

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
