"use client"

import { StatusBadge } from "@/components/shared"

export const BannerStatus = ({ status, type }: { status: string, type: string }) => {
    // BannerStatus is now a thin wrapper passing through to StatusBadge.
    // The visual density is handled by size="md" and shape="square" inside StatusBadge
    // if we needed to, but the unified Badge default is perfect for banners.
    return (
        <StatusBadge status={status} size="md" />
    )
}
