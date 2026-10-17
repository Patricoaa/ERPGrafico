"use client"

import { useEffect, useMemo } from "react"
import { Package } from "lucide-react"
import { DataCell, DataTable } from "@/components/shared"
import { PrintableLayout, usePrintableDrawer } from "@/features/_shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useSaleDelivery } from "../hooks/useSaleDeliveries"
import { saleDeliveryLineFields } from "../saleDeliveryLineFields"
import { getDomainConceptTitle } from "@/lib/entity-registry"

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
    const { printRef, handlePrint } = usePrintableDrawer()
    const { setEntityDisplay } = useGlobalModalActions()
    const columns = useMemo(() => saleDeliveryLineFields.toColumns(), [])
    const lines = (delivery?.lines as Row[] | undefined) ?? []

    useEffect(() => {
        if (delivery?.id && delivery.display_id) {
            setEntityDisplay('sales.saledelivery', Number(delivery.id), String(delivery.display_id))
        }
    }, [delivery?.id, delivery?.display_id, setEntityDisplay])

    return (
        <>
            <PrintableLayout ref={printRef} title="Guía de Despacho" displayId={String(delivery?.display_id ?? `#${id}`)} subtitle={String(delivery?.customer_name ?? '')}>
                {delivery && (
                    <>
                        <div className="text-4xs space-y-1 mb-2 border-b pb-2">
                            <div className="flex justify-between"><span>Cliente:</span><span>{String(delivery.customer_name ?? '-')}</span></div>
                            <div className="flex justify-between"><span>Bodega:</span><span>{String(delivery.warehouse_name ?? '-')}</span></div>
                        </div>
                        {lines.map((line, idx) => (
                            <div key={idx} className="flex justify-between text-3xs">
                                <span className="flex-1">{String(line.product_name ?? '-')}</span>
                                <span className="w-12 text-right">{String(line.quantity ?? '-')}</span>
                            </div>
                        ))}
                    </>
                )}
            </PrintableLayout>

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
            onPrint={handlePrint}
            context={delivery ? [
                { label: "Cliente", value: String(delivery.customer_name ?? "") },
                { label: "Fecha", value: delivery.delivery_date ? <DataCell.Date value={String(delivery.delivery_date)} size="xs" className={SHEET_LEFT} /> : null },
                { label: "Bodega", value: String(delivery.warehouse_name ?? "") },
                {
                    label: getDomainConceptTitle('ov'),
                    value: delivery.sale_order ? (
                        <DocumentRefLink documentRef={delivery.sale_order_document} />
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
        </>
    )
}
