import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { InventoryHeader } from "./InventoryHeader"

export const metadata: Metadata = {
    title: "Módulo de Inventario | ERPGrafico",
    description: "Gestión centralizada de productos, existencias, almacenes y configuración.",
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer>
            <InventoryHeader />
            <div className="pt-2">
                {children}
            </div>
        </PageContainer>
    )
}
