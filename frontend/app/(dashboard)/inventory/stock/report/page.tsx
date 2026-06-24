import { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { StockReport } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Stock e Inventario | ERPGrafico",
    description: "Gestión de existencias, almacenes y reabastecimiento.",
}

export default async function StockReportPage() {
    return (
        <>
            <PageSectionHeader title="Reporte de Stock" description="Informe detallado de existencias por almacén" />
            <StockReport />
        </>)
}
