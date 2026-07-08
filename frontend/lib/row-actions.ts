/**
 * ROW_ACTIONS — closed registry of CRUD-style row/card actions.
 *
 * Contract: docs/20-contracts/component-row-actions.md
 *
 * Single source of truth for icon, label, variant and destructiveness of every
 * action that can appear in a DataTable row, EntityCard footer, or Kanban card.
 *
 * Adding a key here is a contract change — requires an ADR.
 *
 * Canonical order:
 *   Read:      detail → hub → history → report → download → print → share
 *   Write:     edit → duplicate → pay → deliver → receive → archive → restore → lock → unlock → toggle_active
 *   Destructive: annul → delete → reverse
 */

import {
    Archive,
    ArchiveRestore,
    Ban,
    Banknote,
    Copy,
    Download,
    Eye,
    FileText,
    History,
    LayoutDashboard,
    Lock,
    type LucideIcon,
    PackageCheck,
    Pencil,
    Power,
    Printer,
    RotateCcw,
    Share2,
    Trash2,
    Truck,
    Unlock,
} from "lucide-react"

export type RowActionKey =
    | "detail"
    | "hub"
    | "history"
    | "edit"
    | "duplicate"
    | "pay"
    | "deliver"
    | "receive"
    | "report"
    | "download"
    | "print"
    | "share"
    | "archive"
    | "restore"
    | "lock"
    | "unlock"
    | "toggle_active"
    | "annul"
    | "delete"
    | "reverse"

export type RowActionIntent = "read" | "write" | "destructive"

export interface RowActionDef {
    icon: LucideIcon
    /** Tooltip text — es-CL */
    label: string
    intent: RowActionIntent
    /**
     * Optional semantic color token applied to the icon. Only used for actions
     * whose intent should hint at a semantic color (e.g. destructive → on hover).
     * MUST be a semantic token (text-destructive, text-warning, etc).
     */
    iconColorClass?: string
}

export const ROW_ACTIONS: Record<RowActionKey, RowActionDef> = {
    detail:    { icon: Eye,              label: "Ver detalle",          intent: "read"  },
    hub:       { icon: LayoutDashboard,  label: "Abrir HUB",            intent: "read"  },
    history:   { icon: History,          label: "Ver historial",        intent: "read"  },
    edit:      { icon: Pencil,           label: "Editar",               intent: "write" },
    duplicate: { icon: Copy,             label: "Duplicar",             intent: "write" },
    pay:       { icon: Banknote,         label: "Pagar",                intent: "write" },
    deliver:   { icon: Truck,            label: "Entregar",             intent: "write" },
    receive:   { icon: PackageCheck,     label: "Recibir",              intent: "write" },
    report:    { icon: FileText,         label: "Generar reporte",      intent: "read"  },
    download:  { icon: Download,         label: "Descargar",            intent: "read"  },
    print:     { icon: Printer,          label: "Imprimir",             intent: "read"  },
    share:     { icon: Share2,           label: "Compartir",            intent: "read"  },
    archive:   { icon: Archive,          label: "Archivar",             intent: "write" },
    restore:   { icon: ArchiveRestore,   label: "Restaurar",            intent: "write" },
    lock:      { icon: Lock,             label: "Bloquear",             intent: "write" },
    unlock:    { icon: Unlock,           label: "Desbloquear",          intent: "write" },
    toggle_active: { icon: Power,        label: "Activar/Desactivar",   intent: "write" },
    annul:     { icon: Ban,              label: "Anular",               intent: "destructive", iconColorClass: "text-destructive" },
    delete:    { icon: Trash2,           label: "Eliminar",             intent: "destructive", iconColorClass: "text-destructive" },
    reverse:   { icon: RotateCcw,        label: "Reversar",             intent: "destructive", iconColorClass: "text-warning" },
}

/**
 * Canonical order — see component-row-actions.md §3.
 * Use as a stable sort key when rendering arbitrary mixed actions.
 *
 * Convention for the two destructive verbs:
 *  - `annul`  → transactional documents (invoice, sale order, payment) — keeps the record for audit
 *  - `delete` → masters / config (category, warehouse, tag)             — removes the record
 */
export const ROW_ACTION_ORDER: RowActionKey[] = [
    "detail",
    "hub",
    "history",
    "edit",
    "duplicate",
    "pay",
    "deliver",
    "receive",
    "report",
    "download",
    "print",
    "share",
    "archive",
    "restore",
    "lock",
    "unlock",
    "toggle_active",
    "annul",
    "delete",
    "reverse",
]
