import type { Metadata } from "next"
import { InventoryCountClientView } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Ajuste de Inventario",
}

export default function InventoryCountsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <InventoryCountClientView />
        </div>
    )
}
