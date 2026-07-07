"use client"

import React, { use } from "react"
import { PageSectionHeader } from "@/components/shared"
import { PayrollDetailView } from "@/features/hr"

interface Props {
    params: Promise<{ id: string }>
}

export default function PayrollDetailPage({ params }: Props) {
    const resolvedParams = use(params)
    const payrollId = parseInt(resolvedParams.id)

    return (
        <div className="flex-1 space-y-6">
            <PageSectionHeader title="Detalle de Remuneración" description="Visualización completa de la liquidación" />
            <PayrollDetailView payrollId={payrollId} />
        </div>
    )
}
