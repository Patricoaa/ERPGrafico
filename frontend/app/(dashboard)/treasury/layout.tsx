import { Suspense } from "react"
import { Metadata } from "next"
import { PageContainer, Skeleton } from "@/components/shared"
import { TreasuryHeader } from "./TreasuryHeader"

export const metadata: Metadata = {
    title: "Módulo de Tesorería | ERPGrafico",
    description: "Gestión centralizada de cuentas, movimientos y conciliación bancaria.",
}

function TreasuryFallback() {
    return (
        <div className="space-y-4 p-4">
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
        </div>
    )
}

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <TreasuryHeader />
            <div className="h-full flex flex-col">
                <Suspense fallback={<TreasuryFallback />}>
                    {children}
                </Suspense>
            </div>
        </PageContainer>
    )
}
