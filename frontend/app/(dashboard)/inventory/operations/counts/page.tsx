import type { Metadata } from "next"
import { InventoryCountClientView } from "@/features/inventory"
import { PageSectionHeader } from "@/components/shared"

export const metadata: Metadata = {
    title: "Conteo de Inventario",
}

export default function InventoryCountsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader
                title="Conteo de Inventario"
                description="Compara el stock teórico con el stock real por almacén."
            />
            <InventoryCountClientView />
        </div>
    )
}
