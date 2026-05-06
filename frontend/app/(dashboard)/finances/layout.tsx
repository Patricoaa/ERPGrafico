import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { FinancesHeader } from "./FinancesHeader"

export const metadata: Metadata = {
    title: "Finanzas | ERPGrafico",
    description: "Análisis financiero, presupuestos y estados de resultados.",
}

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <FinancesHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
