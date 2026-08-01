import { type Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { StockReport } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Stock e Inventario | ERPGrafico",
    description: "Gestión de existencias, almacenes y reabastecimiento.",
}

export default async function StockReportPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const searchParams = await props.searchParams
    const productName = searchParams.product_name as string | undefined

    return (
        <>
            <PageSectionHeader 
                title={productName ?? "Existencias"} 
                description={productName ? "Insights y movimientos históricos del producto." : "Estado actual del inventario por almacén, valorizado en tiempo real."} 
            />
            <StockReport />
        </>)
}
