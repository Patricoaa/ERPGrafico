"use client"

import { useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable } from "@/components/shared"
import { PrintableLayout, usePrintableDrawer } from "@/features/_shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { usePurchaseReturn } from "../hooks/usePurchasing"
import { purchaseReturnLineFields } from "../purchaseReturnLineFields"

interface PurchaseReturnDrawerProps {
    returnId?: number | null
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

type Row = Record<string, unknown>

/**
 * Ficha documental de la devolución de compra (ADR-0083): contexto (proveedor, fecha,
 * bodega, OC) + productos devueltos + relaciones (OC, nota de crédito, movimientos).
 */
export function PurchaseReturnDrawer({ returnId, id, open, onOpenChange }: PurchaseReturnDrawerProps) {
    const entityId = returnId ?? id ?? null
    const { returnData, isLoading } = usePurchaseReturn(entityId, open)
    const { printRef, handlePrint } = usePrintableDrawer()
    const columns = useMemo(() => purchaseReturnLineFields.toColumns(), [])
    const r = returnData as Row | undefined
    const lines = (r?.lines as Row[] | undefined) ?? []

    return (
        <>
            <PrintableLayout ref={printRef} title="Devolución de Compra" displayId={String(r?.number ?? `#${entityId}`)} subtitle={String(r?.supplier_name ?? '')}>
                {r && (
                    <>
                        <div className="text-4xs space-y-1 mb-2 border-b pb-2">
                            <div className="flex justify-between"><span>Proveedor:</span><span>{String(r.supplier_name ?? '-')}</span></div>
                            <div className="flex justify-between"><span>Bodega:</span><span>{String(r.warehouse_name ?? '-')}</span></div>
                            <div className="flex justify-between"><span>OC:</span><span>{String(r.purchase_order_number ?? '-')}</span></div>
                        </div>
                        {lines.map((line, idx) => (
                            <div key={idx} className="flex justify-between text-3xs">
                                <span className="flex-1">{String(line.product_name)}</span>
                                <span className="w-12 text-right">{String(line.quantity_returned)}</span>
                            </div>
                        ))}
                    </>
                )}
            </PrintableLayout>

            <DocumentSheet
                label="purchasing.purchasereturn"
                open={open}
                onOpenChange={onOpenChange}
                document={r ? { id: Number(r.id), display_id: r.display_id as string | undefined } : null}
                title={r ? String(r.display_id ?? `Devolución ${String(r.number)}`) : undefined}
                isLoading={isLoading}
                error={!isLoading && !r ? new Error("No se pudo cargar la devolución.") : undefined}
                loadingLabel="Cargando devolución"
                status={r ? String(r.status) : null}
                onPrint={handlePrint}
                context={r ? [
                    { label: "Proveedor", value: String(r.supplier_name ?? "") },
                    { label: "Fecha", value: r.return_date ? <DataCell.Date value={String(r.return_date)} size="xs" className={SHEET_LEFT} /> : null },
                    { label: "Bodega", value: String(r.warehouse_name ?? "") },
                    {
                        label: "Orden de compra",
                        value: r.purchase_order ? (
                            <DocumentRefLink
                                label="purchasing.purchaseorder"
                                id={Number(r.purchase_order)}
                                display={String(r.purchase_order_number ?? formatEntityDisplay("purchasing.purchaseorder", { number: r.purchase_order_number }))}
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
                            emptyState={{ title: "No hay líneas", description: "La devolución no tiene líneas." }}
                        />
                    ),
                }]}
            />
        </>
    )
}
