import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { F29DeclarationDetailClient } from "@/features/tax/components/F29DeclarationDetailClient"

export const metadata: Metadata = {
    title: "Declaración F29 | ERP Gráfico",
    description: "Detalle de declaración F29.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function F29DeclarationDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <F29DeclarationDetailClient f29Id={id} />
        </Suspense>
    )
}
