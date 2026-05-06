import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { ProductionHeader } from "./ProductionHeader"

export const metadata: Metadata = {
    title: "Módulo de Producción | ERPGrafico",
    description: "Gestión centralizada de órdenes de trabajo, planificación y listas de materiales.",
}

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <ProductionHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
