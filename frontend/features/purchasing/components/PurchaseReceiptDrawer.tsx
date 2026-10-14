"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DocumentDrawerShell, StatusBadge, DataTable, DataCell, SourceDocumentLink } from "@/components/shared"
import { DocumentRelationsSection } from "@/features/documents"
import { useDrawerIdentity } from "@/features/_shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { usePurchaseReceipt } from "../hooks/usePurchasing"

interface PurchaseReceiptDrawerProps {
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

type Row = Record<string, unknown>

/**
 * Read-only detail of a PurchaseReceipt (GAP-06, document audit).
 * Replaces the previous wiring that opened InventoryDocumentDrawer with a receipt id.
 */
export function PurchaseReceiptDrawer({ id, open, onOpenChange }: PurchaseReceiptDrawerProps) {
    const { receipt, isLoading } = usePurchaseReceipt(id ?? null, open)
    const identity = useDrawerIdentity('purchasing.purchasereceipt', 'view', receipt)

    const columns = useMemo<ColumnDef<Row>[]>(() => [
        { id: "product", header: "Producto", cell: ({ row }) => String(row.original.product_name ?? '-') },
        {
            id: "quantity",
            header: "Cantidad",
            cell: ({ row }) => <DataCell.Number value={String(row.original.quantity_received)} decimals={2} />,
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

    const lines = (receipt?.lines as Row[] | undefined) ?? []

    return (
        <DocumentDrawerShell
            open={open}
            onOpenChange={onOpenChange}
            title={identity.title}
            subtitle={identity.subtitle}
            icon={identity.icon}
            headerActions={identity.headerActions}
            isLoading={isLoading}
            error={!isLoading && !receipt ? new Error("No se pudo cargar la recepción.") : undefined}
            loadingLabel="Cargando recepción"
            summary={receipt && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">Estado</span>
                        <p><StatusBadge status={String(receipt.status)} variant="badge" /></p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Fecha</span>
                        <p className="font-medium"><DataCell.Date value={String(receipt.receipt_date ?? '')} /></p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Proveedor</span>
                        <p className="font-medium">{String(receipt.supplier_name ?? '-')}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Bodega</span>
                        <p className="font-medium">{String(receipt.warehouse_name ?? '-')}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Orden de compra</span>
                        <p className="font-medium">
                            {receipt.purchase_order ? (
                                <SourceDocumentLink doc={{
                                    type: 'purchasing.purchaseorder',
                                    id: Number(receipt.purchase_order),
                                    display: formatEntityDisplay('purchasing.purchaseorder', { number: receipt.purchase_order_number }),
                                }} />
                            ) : '-'}
                        </p>
                    </div>
                </div>
            )}
            related={receipt ? <DocumentRelationsSection label="purchasing.purchasereceipt" id={Number(receipt.id)} /> : null}
        >
            <div>
                <h4 className="text-sm font-medium mb-2">Líneas</h4>
                <div className="border rounded-md overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={lines}
                        variant="minimal"
                        hidePagination
                        noBorder
                        emptyState={{ title: "No hay líneas", description: "La recepción no tiene líneas." }}
                    />
                </div>
            </div>
        </DocumentDrawerShell>
    )
}
