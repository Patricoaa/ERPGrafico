"use client"

import { Button } from "@/components/ui/button"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { POSSessionActivityEvent, POSSessionSaleRow } from "../types"

/** Feature extension: enlace al documento relacionado de un evento (abre su ficha apilada). */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        sessionEventReference: { value: POSSessionActivityEvent["reference"]; options: Record<never, never> }
    }
}

function SessionEventReferenceCell({ value }: ValueRenderProps<"sessionEventReference">) {
    const { openEntity } = useGlobalModals()
    if (!value) return <span className="text-muted-foreground">—</span>
    return (
        <Button
            type="button"
            variant="link"
            className="h-auto p-0 font-mono text-xs"
            onClick={(e) => { e.stopPropagation(); openEntity(value.label, value.id) }}
        >
            {value.display_id}
        </Button>
    )
}

let registered = false
function registerSessionEventKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("sessionEventReference", {
        format: (ref) => ref?.display_id ?? "",
        render: SessionEventReferenceCell,
    })
}

// The entity owns its extension: loading this module registers it.
registerSessionEventKinds()

/**
 * Filas de la pestaña Ventas de la sesión POS (ADR-0087): ventas e devoluciones comparten tabla.
 * La devolución se distingue por su estado y su importe negativo, no solo por el color.
 */
export const posSessionSaleRowEntity = defineEntity<POSSessionSaleRow>()((f) => ({
    label: "treasury.possession",
    rowId: (r) => r.key,
    fields: {
        folio: f.code("display_id", { label: "Documento" }),
        date: f.date("occurred_at", { label: "Fecha", time: true }),
        customer: f.text((r) => (r.is_walk_in ? `${r.customer_name} · venta ocasional` : r.customer_name), { label: "Cliente" }),
        method: f.text("payment_method", { label: "Método de pago", tone: "secondary" }),
        amount: f.money("amount", { label: "Importe", sign: "always" }),
        collected: f.money((r) => (r.collected == null ? null : Number(r.collected)), { label: "Cobrado" }),
        pending: f.money((r) => (r.pending == null ? null : Number(r.pending)), { label: "Por cobrar" }),
        status: f.status((r) => {
            if (r.kind === "COLLECTION") return { status: "received", label: "Cobro en la sesión", intent: "info" }
            if (r.kind === "RETURN") return { status: "sent", label: `Devolución · ${r.status_display}`, intent: "warning" }
            if (r.status === "CANCELLED") return { status: "voided", label: r.status_display, intent: "neutral" }
            if (r.status === "PAYMENT_PENDING") return { status: "pending", label: r.status_display, intent: "warning" }
            return { status: "received", label: `Venta · ${r.status_display}`, intent: "success" }
        }, { label: "Estado" }),
    },
}))

export const posSessionSaleRowViews = posSessionSaleRowEntity.views({
    table: { columns: ["folio", "date", "customer", "method", "amount", "collected", "pending", "status"], primary: "folio" },
})

export const ACTIVITY_CATEGORY_LABEL: Record<POSSessionActivityEvent["category"], string> = {
    caja: "Caja",
    venta: "Venta",
    acceso: "Acceso",
    cierre: "Cierre",
    sistema: "Sistema",
}

/** Evento de la sesión con el responsable ya resuelto («Sistema» = origen automático). */
export type POSSessionActivityRow = POSSessionActivityEvent & { actor: string }

export function toActivityRow(event: POSSessionActivityEvent): POSSessionActivityRow {
    return { ...event, actor: event.actor_name ?? "Sistema" }
}

/** Historial de la sesión: solo lectura, el más reciente primero. */
export const posSessionActivityEntity = defineEntity<POSSessionActivityRow>()((f) => ({
    label: "treasury.possession",
    rowId: (e) => e.key,
    fields: {
        date: f.date("occurred_at", { label: "Fecha", time: true }),
        category: f.text((e) => ACTIVITY_CATEGORY_LABEL[e.category], { label: "Categoría", tone: "secondary" }),
        description: f.text("description", { label: "Descripción" }),
        actor: f.text("actor", { label: "Responsable" }),
        amount: f.money((e) => (e.amount == null ? null : Number(e.amount)), { label: "Importe", sign: "always" }),
        reference: f.value("sessionEventReference", (e) => e.reference, { label: "Referencia" }),
    },
}))

export const posSessionActivityViews = posSessionActivityEntity.views({
    table: { columns: ["date", "category", "description", "amount", "actor", "reference"], primary: "description" },
})
