import type { Metadata } from "next"
import { ChecksView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Cheques Recibidos | ERPGrafico",
}

export default async function OperacionesChecksPage() {
    return <ChecksView direction="RECEIVED" />
}
