"use client"

import { useEffect, useState } from "react"
import { Activity, FileText, Link2, Monitor, ShoppingCart } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    DocumentDrawerShell,
    DocumentFieldGrid,
    StatusBadge,
    type DocumentField,
    type DocumentSheetTab,
} from "@/components/shared"
import { useDrawerIdentity } from "@/features/_shared"
import {
    DocumentRelationsTab,
    useDocumentRelations,
    type DocumentDomain,
} from "@/features/documents"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { saleOrderEntity, useSalesOrders } from "@/features/sales"
import { formatCurrency } from "@/lib/money"
import { format, parseISO } from "date-fns"
import { posSessionMovementViews, posSessionSalesViews } from "../entity-view/posSessionSheet.views"
import { treasuryMovementEntity } from "../entity-view/treasuryMovement.entity"
import { usePOSSession } from "../hooks/usePOSSession"
import type { POSSession } from "../types"

const LABEL = "treasury.possession"

export interface POSSessionSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
}

export function POSSessionSheet({ id, open, onOpenChange, embedded = false }: POSSessionSheetProps) {
    const { session, isLoading: loading, isError } = usePOSSession(id ?? null)
    const { data: relations } = useDocumentRelations(LABEL, id ?? null)
    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const displayId = session ? `SES-${session.id}` : `#${id}`
    const identity = useDrawerIdentity(LABEL, "view", session, { overrideTitle: displayId })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (session?.id && displayId) setEntityDisplay(LABEL, session.id, String(displayId))
    }, [session?.id, displayId, setEntityDisplay])

    const tabs: DocumentSheetTab[] = session ? [
        {
            value: "summary",
            label: "Resumen",
            icon: FileText,
            content: <POSSessionSummaryTab session={session} />,
        },
        {
            value: "sales",
            label: "Ventas",
            icon: ShoppingCart,
            content: <POSSessionSalesTab sessionId={session.id} />,
        },
        {
            value: "activity",
            label: "Actividad",
            icon: Activity,
            badge: session.cash_movements?.length,
            content: <POSSessionActivityTab session={session} />,
        },
        {
            value: "relations",
            label: "Relaciones",
            icon: Link2,
            badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={session.id}
                    sectionActions={{}}
                    rowActions={() => []}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    return (
        <DocumentDrawerShell
            open={open}
            onOpenChange={onOpenChange}
            embedded={embedded}
            title={identity.title}
            subtitle={identity.subtitle}
            icon={identity.icon ?? Monitor}
            isLoading={loading || (!session && !isError)}
            error={isError ? new Error("No se pudo cargar la sesión POS") : undefined}
            loadingLabel="Cargando sesión POS"
            tabs={tabs}
            tab={tab}
            onTabChange={setTab}
        />
    )
}

function POSSessionSummaryTab({ session }: { session: POSSession }) {
    const contextFields: DocumentField[] = [
        {
            label: "Estado",
            value: <StatusBadge status={session.status} variant="badge" />,
        },
        {
            label: "Terminal",
            value: session.terminal_name ?? session.terminal_details?.name ?? "—",
        },
        {
            label: "Cajero",
            value: session.user_name,
        },
        {
            label: "Cuenta de caja",
            value: session.treasury_account_name ?? "—",
        },
        {
            label: "Apertura",
            value: session.opened_at
                ? format(parseISO(session.opened_at), "dd/MM/yyyy HH:mm")
                : "—",
        },
        ...(session.closed_at ? [{
            label: "Cierre",
            value: format(parseISO(session.closed_at), "dd/MM/yyyy HH:mm") +
                (session.closed_by_name ? ` · ${session.closed_by_name}` : ""),
        }] : []),
    ]

    const totalSales =
        Number(session.total_cash_sales) +
        Number(session.total_card_sales) +
        Number(session.total_transfer_sales) +
        Number(session.total_credit_sales) +
        Number(session.total_check_sales)

    const totalsFields: DocumentField[] = [
        { label: "Fondo inicial", value: <AmountCell value={session.opening_balance} /> },
        { label: "Ventas efectivo", value: <AmountCell value={session.total_cash_sales} /> },
        { label: "Ventas tarjeta", value: <AmountCell value={session.total_card_sales} /> },
        { label: "Ventas transferencia", value: <AmountCell value={session.total_transfer_sales} /> },
        { label: "Ventas crédito", value: <AmountCell value={session.total_credit_sales} /> },
        { label: "Ventas cheque", value: <AmountCell value={session.total_check_sales} /> },
        { label: "Total ventas", value: <AmountCell value={totalSales} bold /> },
        { label: "Otros ingresos efectivo", value: <AmountCell value={session.total_other_cash_inflow} /> },
        { label: "Egresos efectivo", value: <AmountCell value={session.total_other_cash_outflow} isExpense /> },
        { label: "Efectivo esperado", value: <AmountCell value={session.expected_cash} bold /> },
    ]

    return (
        <div className="space-y-8">
            <section aria-label="Contexto">
                <DocumentFieldGrid fields={contextFields} className="w-auto justify-start text-left" />
            </section>
            <section aria-label="Totales" className="space-y-2">
                <h3 className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Totales</h3>
                <DocumentFieldGrid fields={totalsFields} className="w-auto justify-start text-left" />
            </section>
            {session.notes ? (
                <section aria-label="Notas" className="space-y-1">
                    <h3 className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Notas</h3>
                    <p className="whitespace-pre-line text-xs text-foreground">{session.notes}</p>
                </section>
            ) : null}
        </div>
    )
}

function AmountCell({ value, bold, isExpense }: { value: number | string; bold?: boolean; isExpense?: boolean }) {
    const amount = Number(value)
    return (
        <span className={`tabular-nums ${bold ? "font-bold" : ""} ${isExpense && amount > 0 ? "text-destructive" : ""}`}>
            {isExpense ? `-${formatCurrency(amount)}` : formatCurrency(amount)}
        </span>
    )
}

function POSSessionSalesTab({ sessionId }: { sessionId: number }) {
    const { orders, isLoading } = useSalesOrders({ filters: { pos_session: sessionId, page_size: 100 } })
    const collection = useEntityCollection(saleOrderEntity, { rows: orders }, { pagination: { mode: "none" } })

    if (isLoading) {
        return (
            <div className="space-y-2 p-4">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                ))}
            </div>
        )
    }

    if (!orders.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Sin ventas en esta sesión</p>
            </div>
        )
    }

    return (
        <Collection.Root collection={collection} label="Ventas de la sesión">
            <Collection.View table={posSessionSalesViews.table} />
        </Collection.Root>
    )
}

function POSSessionActivityTab({ session }: { session: POSSession }) {
    const movements = session.cash_movements ?? []
    const collection = useEntityCollection(treasuryMovementEntity, { rows: movements }, { pagination: { mode: "none" } })

    if (!movements.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Sin movimientos en esta sesión</p>
            </div>
        )
    }

    return (
        <Collection.Root collection={collection} label="Movimientos de la sesión">
            <Collection.View table={posSessionMovementViews.table} />
        </Collection.Root>
    )
}
