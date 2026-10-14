"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Drawer, SkeletonShell, StatusBadge, DataTable, DataCell, SourceDocumentLink } from "@/components/shared"
import { useDrawerIdentity } from "@/features/_shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { formDrawerWidth } from "@/lib/form-widths"
import { useSaleDelivery } from "../hooks/useSaleDeliveries"

interface SaleDeliveryDrawerProps {
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

type Row = Record<string, unknown>

/**
 * Read-only detail of a SaleDelivery (GAP-06, document audit).
 * Replaces the previous wiring that opened InventoryDocumentDrawer with a delivery id.
 */
export function SaleDeliveryDrawer({ id, open, onOpenChange }: SaleDeliveryDrawerProps) {
    const { data: delivery, isLoading, isError } = useSaleDelivery(open ? id ?? null : null)
    const identity = useDrawerIdentity('sales.saledelivery', 'view', delivery)

    const columns = useMemo<ColumnDef<Row>[]>(() => [
        { id: "product", header: "Producto", cell: ({ row }) => String(row.original.product_name ?? '-') },
        {
            id: "quantity",
            header: "Cantidad",
            cell: ({ row }) => <DataCell.Number value={String(row.original.quantity)} decimals={2} suffix={String(row.original.uom_name ?? '')} />,
            meta: { align: "right" },
        },
        {
            id: "stock_move",
            header: "Movimiento",
            cell: ({ row }) => row.original.stock_move
                ? <SourceDocumentLink doc={{
                    type: 'inventory.stockmove',
                    id: Number(row.original.stock_move),
                    display: formatEntityDisplay('inventory.stockmove', { id: row.original.stock_move }),
                }} />
                : <span className="text-muted-foreground">—</span>,
        },
    ], [])

    const lines = (delivery?.lines as Row[] | undefined) ?? []

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            defaultSize={formDrawerWidth("master", true)}
            title={identity.title}
            subtitle={identity.subtitle}
            icon={identity.icon}
            headerActions={identity.headerActions}
        >
            {isLoading ? (
                <SkeletonShell isLoading={true} ariaLabel="Cargando despacho" />
            ) : isError || !delivery ? (
                <p className="p-4 text-sm text-muted-foreground">No se pudo cargar el despacho.</p>
            ) : (
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Estado</span>
                            <p><StatusBadge status={String(delivery.status)} variant="badge" /></p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Fecha</span>
                            <p className="font-medium"><DataCell.Date value={String(delivery.delivery_date ?? '')} /></p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Cliente</span>
                            <p className="font-medium">{String(delivery.customer_name ?? '-')}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Bodega</span>
                            <p className="font-medium">{String(delivery.warehouse_name ?? '-')}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Orden de venta</span>
                            <p className="font-medium">
                                {delivery.sale_order ? (
                                    <SourceDocumentLink doc={{
                                        type: 'sales.saleorder',
                                        id: Number(delivery.sale_order),
                                        display: formatEntityDisplay('sales.saleorder', { number: delivery.sale_order_number }),
                                    }} />
                                ) : '-'}
                            </p>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-medium mb-2">Líneas</h4>
                        <div className="border rounded-md overflow-hidden">
                            <DataTable
                                columns={columns}
                                data={lines}
                                variant="minimal"
                                hidePagination
                                noBorder
                                emptyState={{ title: "No hay líneas", description: "El despacho no tiene líneas." }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </Drawer>
    )
}
