import type { Metadata } from "next"
import NotesPageClient from "./NotesPageClient"

export const metadata: Metadata = {
    title: "Ordenes de Venta | ERPGrafico",
}

export default function SalesOrdersNotesPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <NotesPageClient />
        </div>)
}