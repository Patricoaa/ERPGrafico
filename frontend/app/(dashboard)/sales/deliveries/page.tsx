import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import DeliveriesPageClient from "./DeliveriesPageClient"

export const metadata: Metadata = {
    title: "Despachos | ERPGrafico",
}

export default function SalesDeliveriesPage() {
    return (
        <>
            <PageSectionHeader title="Despachos" description="Gestión de envíos y entregas a clientes" />
            <DeliveriesPageClient />
        </>)
}
