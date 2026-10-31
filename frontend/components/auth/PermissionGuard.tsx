"use client";

import React from "react";
import { Can } from "./Can";

interface PermissionGuardProps extends React.HTMLAttributes<HTMLDivElement> {
    permission?: string | null;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
    return <Can permission={permission ?? null} fallback={fallback}>{children}</Can>;
}
