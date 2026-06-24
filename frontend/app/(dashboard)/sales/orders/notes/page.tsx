import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import NotesPageClient from "./NotesPageClient"

export const metadata: Metadata = {
    title: "Notas de Venta | ERPGrafico",
}

export default function SalesOrdersNotesPage() {
    return (
        <>
            <PageSectionHeader title="Notas de Venta" description="Notas de crédito y débito asociadas a ventas" />
            <NotesPageClient />
        </>)
}