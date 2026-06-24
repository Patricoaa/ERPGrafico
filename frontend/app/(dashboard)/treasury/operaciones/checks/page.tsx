import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { ChecksClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Cheques Recibidos | ERPGrafico",
}

export default async function OperacionesChecksPage() {
    return (
        <>
            <PageSectionHeader title="Cheques Recibidos" description="Gestión de cheques de clientes y terceros" />
            <ChecksClientView direction="RECEIVED" />
        </>)
}
