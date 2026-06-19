"use client"

import type { Payroll } from "@/types/hr"
import { PayrollListView } from "@/features/hr"

interface PayrollsPageClientProps {
    initialPayrolls?: Payroll[]
}

export default function PayrollsPageClient({ initialPayrolls }: PayrollsPageClientProps) {
    return <PayrollListView initialPayrolls={initialPayrolls} />
}
