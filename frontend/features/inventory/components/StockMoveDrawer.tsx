'use client'

import React from 'react'
import { DataCell } from '@/components/shared'
import { PrintableLayout, usePrintableDrawer, type TransactionDrawerProps } from '@/features/_shared'
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from '@/features/documents'
import { useStockMove } from '@/features/inventory/hooks/useStockMoves'

interface StockMoveDrawerProps extends TransactionDrawerProps {
    stockMoveId?: number
}

/**
 * Ficha documental del movimiento de stock (ADR-0083): contexto (producto, cantidad,
 * origen → destino, fecha, descripción) + relaciones (documento que lo originó, asiento).
 */
export function StockMoveDrawer({ id, open, onOpenChange, stockMoveId }: StockMoveDrawerProps) {
    const entityId = id ?? stockMoveId ?? null
    const { data: move, isLoading, isError } = useStockMove(entityId)
    const { printRef, handlePrint } = usePrintableDrawer()
    const productId = Number((move as unknown as Record<string, unknown> | undefined)?.product) || null

    return (
        <>
            <PrintableLayout ref={printRef} title="Movimiento de Stock" displayId={move?.display_id ?? `#${entityId}`}>
                <div className="text-4xs space-y-1 mb-2">
                    <div className="flex justify-between"><span>Producto:</span><span>{move?.product_name ?? '-'}</span></div>
                    <div className="flex justify-between"><span>Cantidad:</span><span>{move?.quantity ?? '0'} {move?.uom_name ?? ''}</span></div>
                    <div className="flex justify-between"><span>Origen:</span><span>{move?.source_location_name ?? '-'}</span></div>
                    <div className="flex justify-between"><span>Destino:</span><span>{move?.destination_location_name ?? '-'}</span></div>
                </div>
            </PrintableLayout>

            <DocumentSheet
                label="inventory.stockmove"
                open={open}
                onOpenChange={onOpenChange}
                document={move ?? null}
                isLoading={isLoading}
                error={isError ? new Error("No se pudo cargar el movimiento.") : undefined}
                loadingLabel="Cargando movimiento de stock"
                onPrint={handlePrint}
                auditType="stock_move"
                context={move ? [
                    {
                        label: "Producto",
                        value: productId
                            ? <DocumentRefLink label="inventory.product" id={productId} display={move.product_name} mono={false} />
                            : move.product_name,
                    },
                    { label: "Cantidad", value: <span className="tabular-nums">{move.quantity} {move.uom_name ?? ''}</span> },
                    { label: "Origen → destino", value: `${move.source_location_name} → ${move.destination_location_name}` },
                    { label: "Fecha", value: move.date ? <DataCell.Date value={move.date} size="xs" className={SHEET_LEFT} /> : null },
                    { label: "Descripción", value: move.description || null, span: 4 },
                ] : []}
            />
        </>
    )
}
