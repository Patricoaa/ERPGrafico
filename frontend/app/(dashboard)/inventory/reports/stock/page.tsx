import { type Metadata } from "next"
import { StockReport } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Stock e Inventario | ERPGrafico",
    description: "Gestión de existencias, almacenes y reabastecimiento.",
}

// El título (incluido `product_name`) lo publica InventoryHeader en la topbar.
export default function StockReportPage() {
    return <StockReport />
}
