import type { Metadata } from "next"
import DeliveriesPageClient from "./DeliveriesPageClient"

export const metadata: Metadata = {
    title: "Despachos por Orden | ERPGrafico",
}

export default function SalesOrdersDeliveriesPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <DeliveriesPageClient />
        </div>)
}
