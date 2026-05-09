import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { ProductionOrderDetailClient } from "@/features/production/components/ProductionOrderDetailClient"

export const metadata: Metadata = {
    title: "Orden de Trabajo | ERP Gráfico",
    description: "Detalle de Orden de Trabajo.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ProductionOrderDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <ProductionOrderDetailClient orderId={id} />
        </Suspense>
    )
}
