import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { PurchasingHeader } from "./PurchasingHeader"

export const metadata: Metadata = {
    title: "Módulo de Compras | ERPGrafico",
    description: "Gestión integral de órdenes de compra, notas y configuración.",
}

export default function PurchasingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PurchasingHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
