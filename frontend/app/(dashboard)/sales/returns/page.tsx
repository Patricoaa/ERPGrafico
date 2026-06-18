import type { Metadata } from "next"
import ReturnsPageClient from "./ReturnsPageClient"

export const metadata: Metadata = {
    title: "Notas de Venta | ERPGrafico",
}

export default function SalesReturnsPage() {
    return <ReturnsPageClient />
}
