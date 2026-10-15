"use client"

import { useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable } from "@/components/shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { usePurchaseReceipt } from "../hooks/usePurchasing"
import { purchaseReceiptLineFields } from "../purchaseReceiptLineFields"

interface PurchaseReceiptDrawerProps {
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

type Row = Record<string, unknown>

/**
 * Ficha documental de la recepción (GAP-06, ADR-0083): contexto (proveedor, fecha, bodega,
 * OC) + productos con su movimiento de stock + relaciones.
 */
export function PurchaseReceiptDrawer({ id, open, onOpenChange }: PurchaseReceiptDrawerProps) {
    const { receipt, isLoading } = usePurchaseReceipt(id ?? null, open)
    const columns = useMemo(() => purchaseReceiptLineFields.toColumns(), [])
    const lines = (receipt?.lines as Row[] | undefined) ?? []

    return (
        <DocumentSheet
            label="purchasing.purchasereceipt"
            open={open}
            onOpenChange={onOpenChange}
            document={receipt ? { id: Number(receipt.id), display_id: receipt.display_id as string | undefined } : null}
            isLoading={isLoading}
            error={!isLoading && !receipt ? new Error("No se pudo cargar la recepción.") : undefined}
            loadingLabel="Cargando recepción"
            status={receipt ? String(receipt.status) : null}
            auditType="purchase_receipt"
            context={receipt ? [
                { label: "Proveedor", value: String(receipt.supplier_name ?? "") },
                { label: "Fecha", value: receipt.receipt_date ? <DataCell.Date value={String(receipt.receipt_date)} size="xs" className={SHEET_LEFT} /> : null },
                { label: "Bodega", value: String(receipt.warehouse_name ?? "") },
                {
                    label: "Orden de compra",
                    value: receipt.purchase_order ? (
                        <DocumentRefLink
                            label="purchasing.purchaseorder"
                            id={Number(receipt.purchase_order)}
                            display={formatEntityDisplay("purchasing.purchaseorder", { number: receipt.purchase_order_number })}
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
                        emptyState={{ title: "No hay líneas", description: "La recepción no tiene líneas." }}
                    />
                ),
            }]}
        />
    )
}
