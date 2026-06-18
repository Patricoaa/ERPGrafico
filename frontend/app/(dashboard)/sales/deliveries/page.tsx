import type { Metadata } from "next"
import DeliveriesPageClient from "./DeliveriesPageClient"

export const metadata: Metadata = {
    title: "Despachos | ERPGrafico",
}

export default function SalesDeliveriesPage() {
    return <DeliveriesPageClient />
}
