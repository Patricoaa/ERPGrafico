import { PageSectionHeader } from "@/components/shared"
import SalesInvoicesPageClient from "./SalesInvoicesPageClient"

export default function SalesInvoicesPage() {
    return (
        <>
            <PageSectionHeader title="Facturas de Venta" description="Documentos tributarios electrónicos de venta" />
            <SalesInvoicesPageClient />
        </>)
}
