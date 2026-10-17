import type { Metadata } from "next"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import NotesPageClient from "./NotesPageClient"

export const metadata: Metadata = {
    title: `${getDomainConceptTitle('ov', true)} | ERPGrafico`,
}

export default function SalesOrdersNotesPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <NotesPageClient />
        </div>)
}