import { Metadata } from "next"
import { Suspense } from "react"
import { FiscalYearDetailClient } from "@/features/accounting/components/closures/FiscalYearDetailClient"
import { FormSkeleton } from "@/components/shared"

export const metadata: Metadata = {
    title: "Año Fiscal | ERP Gráfico",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function FiscalYearDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <FiscalYearDetailClient fiscalYearId={id} />
        </Suspense>
    )
}
