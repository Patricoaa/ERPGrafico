import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import DeliveriesPageClient from "./DeliveriesPageClient"

export const metadata: Metadata = {
    title: "Despachos | ERPGrafico",
}

export default function SalesDeliveriesPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader title="Despachos" description="Gestión de envíos y entregas a clientes" />
            <DeliveriesPageClient />
        </div>)
}
