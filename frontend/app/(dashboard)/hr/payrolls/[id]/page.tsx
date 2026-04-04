"use client"

import React, { use } from "react"
import { PayrollDetailContent } from "@/features/hr/components/payrolls/PayrollDetailContent"

interface Props {
    params: Promise<{ id: string }>
}

export default function PayrollDetailPage({ params }: Props) {
    const resolvedParams = use(params)
    const payrollId = parseInt(resolvedParams.id)

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PayrollDetailContent payrollId={payrollId} />
        </div>
    )
}
