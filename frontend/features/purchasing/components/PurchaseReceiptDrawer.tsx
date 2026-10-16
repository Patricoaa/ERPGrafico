"use client"

import { useEffect, useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable } from "@/components/shared"
import { PrintableLayout, usePrintableDrawer } from "@/features/_shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
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
    const { printRef, handlePrint } = usePrintableDrawer()
    const { setEntityDisplay } = useGlobalModalActions()
    const columns = useMemo(() => purchaseReceiptLineFields.toColumns(), [])
    const lines = (receipt?.lines as Row[] | undefined) ?? []

    useEffect(() => {
        if (receipt?.id && receipt.display_id) {
            setEntityDisplay('purchasing.purchasereceipt', Number(receipt.id), String(receipt.display_id))
        }
    }, [receipt?.id, receipt?.display_id, setEntityDisplay])

    return (
        <>
            <PrintableLayout ref={printRef} title="Recepción de Compra" displayId={String(receipt?.display_id ?? `#${id}`)} subtitle={String(receipt?.supplier_name ?? '')}>
                {receipt && (
                    <>
                        <div className="text-4xs space-y-1 mb-2 border-b pb-2">
                            <div className="flex justify-between"><span>Proveedor:</span><span>{String(receipt.supplier_name ?? '-')}</span></div>
                            <div className="flex justify-between"><span>Bodega:</span><span>{String(receipt.warehouse_name ?? '-')}</span></div>
                        </div>
                        {lines.map((line, idx) => (
                            <div key={idx} className="flex justify-between text-3xs">
                                <span className="flex-1">{String(line.product_name ?? '-')}</span>
                                <span className="w-12 text-right">{String(line.quantity_received ?? '-')}</span>
                            </div>
                        ))}
                    </>
                )}
            </PrintableLayout>

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
            onPrint={handlePrint}
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
        </>
    )
}
