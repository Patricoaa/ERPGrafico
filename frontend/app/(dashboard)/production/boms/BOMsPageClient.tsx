"use client"

import { BOMClientView } from "@/features/production"
import type { BOM } from "@/features/production/types"

interface BOMsPageClientProps {
    initialBoms?: BOM[]
}

export default function BOMsPageClient({ initialBoms }: BOMsPageClientProps) {
    return <BOMClientView initialBoms={initialBoms} />
}
