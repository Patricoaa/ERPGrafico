"use client"

import { useEffect, useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable } from "@/components/shared"
import { PrintableLayout, usePrintableDrawer } from "@/features/_shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useSaleReturn } from "../hooks/useSaleDeliveries"
import { saleReturnLineFields } from "../saleReturnLineFields"

interface SaleReturnDrawerProps {
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

type Row = Record<string, unknown>

/**
 * Ficha documental de la devolución de venta (ADR-0083): contexto (cliente, fecha, bodega,
 * OV) + productos devueltos + relaciones (OV, nota de crédito, movimientos).
 */
export function SaleReturnDrawer({ id, open, onOpenChange }: SaleReturnDrawerProps) {
    const { data: returnData, isLoading } = useSaleReturn(id ?? null, open)
    const { printRef, handlePrint } = usePrintableDrawer()
    const { setEntityDisplay } = useGlobalModalActions()
    const columns = useMemo(() => saleReturnLineFields.toColumns(), [])
    const r = returnData as Row | undefined

    useEffect(() => {
        if (r?.id && r.display_id) {
            setEntityDisplay('sales.salereturn', Number(r.id), String(r.display_id))
        }
    }, [r?.id, r?.display_id, setEntityDisplay])
    const lines = (r?.lines as Row[] | undefined) ?? []

    return (
        <>
            <PrintableLayout ref={printRef} title="Devolución de Venta" displayId={String(r?.display_id ?? `#${id}`)} subtitle={String(r?.customer_name ?? '')}>
                {r && (
                    <>
                        <div className="text-4xs space-y-1 mb-2 border-b pb-2">
                            <div className="flex justify-between"><span>Cliente:</span><span>{String(r.customer_name ?? '-')}</span></div>
                            <div className="flex justify-between"><span>Bodega:</span><span>{String(r.warehouse_name ?? '-')}</span></div>
                            <div className="flex justify-between"><span>OV:</span><span>{String(r.sale_order_number ?? '-')}</span></div>
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
                label="sales.salereturn"
                open={open}
                onOpenChange={onOpenChange}
                document={r ? { id: Number(r.id), display_id: r.display_id as string | undefined } : null}
                title={r ? String(r.display_id ?? `Devolución ${String(r.number)}`) : undefined}
                isLoading={isLoading}
                error={!isLoading && !r ? new Error("No se pudo cargar la devolución.") : undefined}
                loadingLabel="Cargando devolución"
                status={r ? String(r.status) : null}
                onPrint={handlePrint}
                auditType="sale_return"
                context={r ? [
                    { label: "Cliente", value: String(r.customer_name ?? "") },
                    { label: "Fecha", value: r.date ? <DataCell.Date value={String(r.date)} size="xs" className={SHEET_LEFT} /> : null },
                    { label: "Bodega", value: String(r.warehouse_name ?? "") },
                    {
                        label: "Orden de venta",
                        value: r.sale_order ? (
                            <DocumentRefLink documentRef={r.sale_order_document} />
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
