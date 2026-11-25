import { defineEntity } from "@/components/entity-view"
import type { JournalEntry } from "../hooks/useJournalEntries"

/** Journal entries list (ADR-0087 oleada B2). No hub: a plain `status` (DRAFT/POSTED/CANCELLED/CLOSED). */
export const journalEntryEntity = defineEntity<JournalEntry>()((f) => ({
    label: "accounting.journalentry",
    fields: {
        folio: f.code("display_id", { label: "Folio" }),
        status: f.status((e) => ({ status: e.status }), { label: "Estado" }),
        // Same chip-with-intent logic as the legacy field; StatusBadge (invariant #7) instead of a plain Chip.
        origin: f.status((e) => ({
            status: e.is_manual ? "manual" : e.reversal_of ? "reversal" : "auto",
            label: e.is_manual ? "Manual" : e.reversal_of ? "Reversión" : "Automático",
            intent: e.is_manual ? "neutral" : e.reversal_of ? "warning" : "info",
        }), { label: "Origen" }),
        date: f.date("date", { label: "Fecha" }),
        description: f.text("description", { label: "Descripción", truncate: true }),
        totalDebit: f.money((e) => e.items?.reduce((sum, item) => sum + (Number(item.debit) || 0), 0) ?? 0, { label: "Total Débito" }),
    },
    // ADR-0158 §3. No `sort`: the entries endpoint has no server ordering.
    query: {
        search: { placeholder: "Buscar por descripción, número o contacto…" },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_after", paramTo: "date_before" },
            status: {
                field: "status",
                control: "single",
                options: [
                    { value: "DRAFT", label: "Borrador" },
                    { value: "POSTED", label: "Publicado" },
                    { value: "CLOSED", label: "Cerrado" },
                    { value: "REVERSAL", label: "Reversión" },
                    { value: "CANCELLED", label: "Anulado" },
                ],
            },
        },
        groupBy: { fields: ["status", "origin", "date"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" } },
            { id: "posted", label: "Publicados", filters: { status: "POSTED" } },
        ],
    },
}))

export const journalEntryViews = journalEntryEntity.views({
    table: { columns: ["folio", "status", "origin", "date", "description", "totalDebit"], primary: "folio" },
    card: {
        rail: { status: (r) => r.status },
        title: "folio",
        subtitle: ["origin", "date"],
        trailing: ["totalDebit"],
        media: { tone: (e) => (e.is_manual ? "info" : e.reversal_of ? "warning" : "success") },
    },
})
