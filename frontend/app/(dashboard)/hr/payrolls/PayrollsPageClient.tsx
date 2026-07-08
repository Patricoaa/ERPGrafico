"use client"

import type { Payroll } from "@/types/hr"
import { PayrollClientView } from "@/features/hr"

interface PayrollsPageClientProps {
    initialPayrolls?: Payroll[]
}

export default function PayrollsPageClient({ initialPayrolls }: PayrollsPageClientProps) {
    return <PayrollClientView initialPayrolls={initialPayrolls} />
}
