import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { InventoryHeader } from "./InventoryHeader"

export const metadata: Metadata = {
    title: "Módulo de Inventario | ERPGrafico",
    description: "Gestión centralizada de productos, existencias, almacenes y configuración.",
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <InventoryHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
