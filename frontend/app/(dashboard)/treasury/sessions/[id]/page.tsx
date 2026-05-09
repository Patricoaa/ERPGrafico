import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { POSSessionDetailClient } from "@/features/treasury/components/POSSessionDetailClient"

export const metadata: Metadata = {
    title: "Sesión de Caja | ERP Gráfico",
    description: "Detalle de una sesión de caja POS.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function POSSessionDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <POSSessionDetailClient sessionId={id} />
        </Suspense>
    )
}
