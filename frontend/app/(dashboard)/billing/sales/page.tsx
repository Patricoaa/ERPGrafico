import { PageSectionHeader } from "@/components/shared"
import SalesInvoicesPageClient from "./SalesInvoicesPageClient"

export default function SalesInvoicesPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="DTE Emitidos" description="Documentos tributarios electrónicos emitidos" />
            <SalesInvoicesPageClient />
        </>)
}
