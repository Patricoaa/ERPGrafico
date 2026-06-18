import type { Metadata } from "next"
import NotesPageClient from "./NotesPageClient"

export const metadata: Metadata = {
    title: "Notas de Venta | ERPGrafico",
}

export default function SalesOrdersNotesPage() {
    return <NotesPageClient />
}