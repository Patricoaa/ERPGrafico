import { PageSectionHeader } from "@/components/shared"
import PurchasesPageClient from "./PurchasesPageClient"

export default function PurchasesPage() {
    return (
        <>
            <PageSectionHeader title="Facturas de Compra" description="Documentos tributarios electrónicos de compra" />
            <PurchasesPageClient />
        </>)
}
