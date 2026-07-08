"use client"

import type { SalaryAdvance } from "@/types/hr"
import { SalaryAdvanceClientView } from "@/features/hr"

interface AdvancesPageClientProps {
    initialAdvances?: SalaryAdvance[]
}

export default function AdvancesPageClient({ initialAdvances }: AdvancesPageClientProps) {
    return <SalaryAdvanceClientView initialAdvances={initialAdvances} />
}
