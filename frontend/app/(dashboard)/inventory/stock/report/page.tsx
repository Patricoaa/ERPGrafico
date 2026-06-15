import { Metadata } from "next"
import { StockReport } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Stock e Inventario | ERPGrafico",
    description: "Gestión de existencias, almacenes y reabastecimiento.",
}

export default async function StockReportPage() {
    return <StockReport />
}
