import type { Metadata } from "next"
import { ChecksClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Cheques Recibidos | ERPGrafico",
}

export default async function OperacionesChecksPage() {
    return <ChecksClientView direction="RECEIVED" />
}
