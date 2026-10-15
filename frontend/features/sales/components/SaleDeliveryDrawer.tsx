"use client"

import { useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable } from "@/components/shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { useSaleDelivery } from "../hooks/useSaleDeliveries"
import { saleDeliveryLineFields } from "../saleDeliveryLineFields"

interface SaleDeliveryDrawerProps {
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

type Row = Record<string, unknown>

/**
 * Ficha documental del despacho (GAP-06, ADR-0083): contexto (cliente, fecha, bodega, OV)
 * + productos con su movimiento de stock + relaciones.
 */
export function SaleDeliveryDrawer({ id, open, onOpenChange }: SaleDeliveryDrawerProps) {
    const { data: delivery, isLoading, isError } = useSaleDelivery(open ? id ?? null : null)
    const columns = useMemo(() => saleDeliveryLineFields.toColumns(), [])
    const lines = (delivery?.lines as Row[] | undefined) ?? []

    return (
        <DocumentSheet
            label="sales.saledelivery"
            open={open}
            onOpenChange={onOpenChange}
            document={delivery ? { id: Number(delivery.id), display_id: delivery.display_id as string | undefined } : null}
            isLoading={isLoading}
            error={isError ? new Error("No se pudo cargar el despacho.") : undefined}
            loadingLabel="Cargando despacho"
            status={delivery ? String(delivery.status) : null}
            auditType="sale_delivery"
            context={delivery ? [
                { label: "Cliente", value: String(delivery.customer_name ?? "") },
                { label: "Fecha", value: delivery.delivery_date ? <DataCell.Date value={String(delivery.delivery_date)} size="xs" className={SHEET_LEFT} /> : null },
                { label: "Bodega", value: String(delivery.warehouse_name ?? "") },
                {
                    label: "Orden de venta",
                    value: delivery.sale_order ? (
                        <DocumentRefLink
                            label="sales.saleorder"
                            id={Number(delivery.sale_order)}
                            display={formatEntityDisplay("sales.saleorder", { number: delivery.sale_order_number })}
                        />
                    ) : null,
                },
            ] : []}
            sections={[{
                title: "Productos",
                icon: Package,
                content: (
                    <DataTable
                        columns={columns}
                        data={lines}
                        variant="minimal"
                        hidePagination
                        emptyState={{ title: "No hay líneas", description: "El despacho no tiene líneas." }}
                    />
                ),
            }]}
        />
    )
}
