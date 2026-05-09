import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { TaxPeriodDetailClient } from "@/features/tax/components/TaxPeriodDetailClient"

export const metadata: Metadata = {
    title: "Periodo Tributario | ERP Gráfico",
    description: "Detalle de periodo tributario.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function TaxPeriodDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <TaxPeriodDetailClient periodId={id} />
        </Suspense>
    )
}
