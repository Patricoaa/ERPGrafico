import { defineEntity } from "@/components/entity-view"
import { getDtePrefix } from "@/lib/entity-registry"
import { isInvoiceCompleted } from "@/lib/workflow-status"
import { FileText, Receipt, FileMinus, FilePlus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Invoice } from "../types"

/** Purchase invoices/notes list (ADR-0087 oleada B1). Same hub and `total` convention as `salesInvoiceEntity`. */

/** Strip leading zeros from a boleta/sequence number stored with padding (e.g. "000042" → "42"). */
function stripLeadingZeros(n: string): string {
    return n.replace(/^0+/, "") || "0"
}

const DTE_ICON: Record<string, LucideIcon> = {
    FACTURA: FileText,
    FACTURA_EXENTA: FileText,
    PURCHASE_INV: FileText,
    BOLETA: Receipt,
    BOLETA_EXENTA: Receipt,
    NOTA_CREDITO: FileMinus,
    NOTA_DEBITO: FilePlus,
}

type DteTone = "primary" | "info" | "destructive" | "warning" | "default"

const DTE_TONE: Record<string, DteTone> = {
    FACTURA: "primary",
    FACTURA_EXENTA: "primary",
    PURCHASE_INV: "primary",
    BOLETA: "info",
    BOLETA_EXENTA: "info",
    NOTA_CREDITO: "destructive",
    NOTA_DEBITO: "warning",
}

export const purchaseInvoiceEntity = defineEntity<Invoice>()((f) => ({
    label: "billing.invoice",
    fields: {
        folio: f.code((inv) => {
            // display_id already carries the prefix (e.g. "FACC-42"); use it directly when present.
            if (inv.display_id) return inv.display_id
            if (!inv.number) return null
            // number may be zero-padded (e.g. "000005" from SequenceService); normalise.
            const raw = stripLeadingZeros(inv.number)
            return `${getDtePrefix(inv.dte_type)}-${raw}`
        }, { label: "Folio" }),
        date: f.date("date", { label: "Fecha Emisión" }),
        supplier: f.contact((inv) => (inv.partner_name ? { id: inv.partner_id ?? inv.supplier ?? 0, name: inv.partner_name } : null), { label: "Proveedor" }),
        dteType: f.status((inv) => ({
            status: inv.dte_type,
            label: inv.dte_type_display,
            intent: (() => {
                switch (inv.dte_type) {
                    case "FACTURA":
                    case "FACTURA_EXENTA":
                    case "PURCHASE_INV": return "primary"
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
    // ADR-0158 §3. Free text goes to `search` (contact name / RUT). No `sort`: the invoices endpoint has no
    // server ordering.
    query: {
        search: { placeholder: "Buscar por proveedor o RUT…", scopes: [{ field: "folio", param: "number" }] },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_from", paramTo: "date_to" },
            status: { label: "Estado", control: "single", options: [{ value: "DRAFT", label: "Borrador (folio pendiente)" }, { value: "POSTED", label: "Emitido" }, { value: "CANCELLED", label: "Anulado" }] },
            payment_status: { label: "Pago", control: "single", options: [{ value: "UNPAID", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "PAID", label: "Pagado" }] },
            total: { field: "total", control: "range", paramFrom: "total_min", paramTo: "total_max" },
        },
        groupBy: { fields: ["date", "hub"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "unpaid", label: "Por pagar", filters: { status: "POSTED", payment_status: "UNPAID" } },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" } },
        ],
    },
}))

export const purchaseInvoiceViews = purchaseInvoiceEntity.views({
    table: { columns: ["folio", "date", "supplier", "dteType", "hub", "total"], primary: "folio" },
    card: {
        rail: { status: (r) => (r.status === "CANCELLED" ? "CANCELLED" : r.status === "DRAFT" ? "DRAFT" : isInvoiceCompleted(r) ? "SUCCESS" : "CONFIRMED") },
        title: "folio",
        subtitle: ["dteType", "supplier", "date"],
        trailing: ["hub"],
        footer: { value: "total", align: "end" },
        media: {
            iconFor: (inv) => DTE_ICON[inv.dte_type] ?? FileText,
            tone: (inv) => DTE_TONE[inv.dte_type] ?? "default",
        },
    },
})
