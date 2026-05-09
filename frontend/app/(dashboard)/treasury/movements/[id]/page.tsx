import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { TreasuryMovementDetailClient } from "@/features/treasury/components/TreasuryMovementDetailClient"

export const metadata: Metadata = {
    title: "Movimiento de Tesorería | ERP Gráfico",
    description: "Detalle de un movimiento de tesorería.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function TreasuryMovementDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <TreasuryMovementDetailClient movementId={id} />
        </Suspense>
    )
}
