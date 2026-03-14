import { Metadata } from "next"
import { Suspense, lazy } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

const CreditPortfolioView = lazy(() =>
    import("@/features/credits").then(m => ({ default: m.CreditPortfolioView }))
)

export const metadata: Metadata = {
    title: "Cartera de Créditos | ERPGrafico",
    description: "Gestión de cartera crediticia, clasificación de deuda por antigüedad y control de deudores.",
}

export default function CreditsPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Cartera de Créditos"
                description="Saldo por cliente, clasificación por antigüedad y estado de cobro."
                iconName="credit-card"
            />
            <Suspense fallback={<LoadingFallback />}>
                <CreditPortfolioView />
            </Suspense>
        </div>
    )
}
