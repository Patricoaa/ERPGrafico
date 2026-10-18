import type { Metadata } from "next"
import NotesPageClient from "./NotesPageClient"
import { getSalesOrdersSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesOrdersSubTab("notes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Notas de Crédito y Débito | ERPGrafico" }

export default async function SalesNotesPage() {
  return <NotesPageClient />
}