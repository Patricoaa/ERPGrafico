import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { TreasuryAccountDetailClient } from "@/features/treasury/components/TreasuryAccountDetailClient"

export const metadata: Metadata = {
    title: "Cuenta de Tesorería | ERP Gráfico",
    description: "Ficha y edición de una cuenta de tesorería.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function TreasuryAccountDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <TreasuryAccountDetailClient accountId={id} />
        </Suspense>
    )
}
