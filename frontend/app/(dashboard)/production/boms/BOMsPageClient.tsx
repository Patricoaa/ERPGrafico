"use client"

import { BOMClientView, type BOM } from "@/features/production"

interface BOMsPageClientProps {
    initialBoms?: BOM[]
}

export default function BOMsPageClient({ initialBoms }: BOMsPageClientProps) {
    return <BOMClientView initialBoms={initialBoms} />
}
