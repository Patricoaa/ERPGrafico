import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import ReturnsPageClient from "./ReturnsPageClient"

export const metadata: Metadata = {
    title: "Devoluciones | ERPGrafico",
}

export default function SalesReturnsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader title="Devoluciones" description="Gestión de devoluciones de ventas" />
            <ReturnsPageClient />
        </div>)
}
