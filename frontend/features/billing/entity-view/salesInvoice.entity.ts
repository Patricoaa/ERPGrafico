import { defineEntity } from "@/components/entity-view"
import { getDtePrefix } from "@/lib/entity-registry"
import { FileText, Receipt, FileMinus, FilePlus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Invoice } from "../types"

/**
 * Sales invoices/notes list (ADR-0087 oleada B1). Same hub ("billing.invoice") already in
 * production in `saleNoteEntity` (sales orders screen, "notes" mode); here without the flow
 * sign on `total` — this list, unlike that one, shows the document's own total (`02` §3 #3).
 */

/** Strip leading zeros from a boleta/sequence number stored with padding (e.g. "000042" → "42"). */
function stripLeadingZeros(n: string): string {
    return n.replace(/^0+/, "") || "0"
}

const DTE_ICON: Record<string, LucideIcon> = {
    FACTURA: FileText,
    FACTURA_EXENTA: FileText,
    BOLETA: Receipt,
    BOLETA_EXENTA: Receipt,
    NOTA_CREDITO: FileMinus,
    NOTA_DEBITO: FilePlus,
}

type DteTone = "primary" | "info" | "destructive" | "warning" | "default"

const DTE_TONE: Record<string, DteTone> = {
    FACTURA: "primary",
    FACTURA_EXENTA: "primary",
    BOLETA: "info",
    BOLETA_EXENTA: "info",
    NOTA_CREDITO: "destructive",
    NOTA_DEBITO: "warning",
}

export const salesInvoiceEntity = defineEntity<Invoice>()((f) => ({
    label: "billing.invoice",
    fields: {
        folio: f.code((inv) => {
            // display_id already carries the prefix (e.g. "FACV-42"); use it directly when present.
            if (inv.display_id) return inv.display_id
            if (!inv.number) return null
            // number may be zero-padded (e.g. "000005" from SequenceService); normalise.
            const raw = stripLeadingZeros(inv.number)
            return `${getDtePrefix(inv.dte_type)}-${raw}`
        }, { label: "Folio" }),
        date: f.date("date", { label: "Fecha" }),
        customer: f.contact((inv) => (inv.partner_name ? { id: inv.partner_id ?? 0, name: inv.partner_name } : null), { label: "Cliente" }),
        dteType: f.status((inv) => ({
            status: inv.dte_type,
            label: inv.dte_type_display,
            intent: (() => {
                switch (inv.dte_type) {
                    case "FACTURA":
                    case "FACTURA_EXENTA": return "primary"
                    case "BOLETA":
                    case "BOLETA_EXENTA": return "info"
                    case "NOTA_CREDITO": return "destructive"
                    case "NOTA_DEBITO": return "warning"
                    default: return "neutral"
                }
            })(),
        }), { label: "Tipo DTE" }),
        hub: f.hubStatus((inv) => inv, { label: "Estado", entity: "billing.invoice", caption: (inv) => ({ status: inv.status, label: inv.status_display }) }),
        total: f.money("total", { label: "Total" }),
    },
}))

export const salesInvoiceViews = salesInvoiceEntity.views({
    table: { columns: ["folio", "date", "customer", "dteType", "hub", "total"], primary: "folio" },
    card: {
        rail: { status: (r) => r.status },
        title: "folio",
        subtitle: ["dteType", "customer", "date"],
        trailing: ["hub", "total"],
        media: {
            iconFor: (inv) => DTE_ICON[inv.dte_type] ?? FileText,
            tone: (inv) => DTE_TONE[inv.dte_type] ?? "default",
        },
    },
})
