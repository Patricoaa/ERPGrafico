import { PageSectionHeader } from "@/components/shared"
import SalesInvoicesPageClient from "./SalesInvoicesPageClient"

export default function SalesInvoicesPage() {
    return (
        <>
            <PageSectionHeader title="DTE Emitidos" description="Documentos tributarios electrónicos emitidos" />
            <SalesInvoicesPageClient />
        </>)
}
