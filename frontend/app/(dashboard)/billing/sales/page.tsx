import { Metadata } from "next"
import { SalesInvoicesClientView } from "@/features/billing/components/SalesInvoicesClientView"

export const metadata: Metadata = {
    title: "Documentos Emitidos | ERPGrafico",
    description: "Gestión de facturas y boletas de venta.",
}

export default function SalesInvoicesPage() {
    return <SalesInvoicesClientView />
}

