import { type Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { InventoryHeader } from "./InventoryHeader"

export const metadata: Metadata = {
    title: "Módulo de Inventario | ERPGrafico",
    description: "Gestión centralizada de productos, existencias, almacenes y configuración.",
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <InventoryHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
