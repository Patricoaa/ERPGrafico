import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { BankStatementDetailClient } from "@/features/treasury/components/BankStatementDetailClient"

export const metadata: Metadata = {
    title: "Cartola Bancaria | ERP Gráfico",
    description: "Detalle y estado de conciliación de una cartola bancaria.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function BankStatementDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <BankStatementDetailClient statementId={id} />
        </Suspense>
    )
}
