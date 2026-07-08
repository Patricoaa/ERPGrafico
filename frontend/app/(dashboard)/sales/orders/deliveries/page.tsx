import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import DeliveriesPageClient from "./DeliveriesPageClient"

export const metadata: Metadata = {
    title: "Despachos por Orden | ERPGrafico",
}

export default function SalesOrdersDeliveriesPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader title="Despachos por Orden" description="Gestión de envíos y entregas asociados a órdenes de venta" />
            <DeliveriesPageClient />
        </div>)
}
