import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { BillingHeader } from "./BillingHeader"

export const metadata: Metadata = {
    title: "Módulo de Facturación | ERPGrafico",
    description: "Gestión centralizada de documentos electrónicos emitidos y recibidos.",
}

export default function BillingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <BillingHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
