import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { SalesHeader } from "./SalesHeader"

export const metadata: Metadata = {
    title: "Módulo de Ventas | ERPGrafico",
    description: "Gestión integral de pedidos, terminales, cobranza y puntos de venta.",
}

export default function SalesLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <SalesHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
