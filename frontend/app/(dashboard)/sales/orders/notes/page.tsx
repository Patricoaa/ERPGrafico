import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import NotesPageClient from "./NotesPageClient"

export const metadata: Metadata = {
    title: "Notas de Venta | ERPGrafico",
}

export default function SalesOrdersNotesPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader title="Notas de Venta" description="Notas de crédito y débito asociadas a ventas" />
            <NotesPageClient />
        </div>)
}