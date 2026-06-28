'use client'

import React, { useRef } from 'react'
import { Drawer, StatusBadge, SkeletonShell, FormSplitLayout } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { getEntityIcon } from "@/lib/entity-registry"
import { useReactToPrint } from 'react-to-print'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared'
import { useStockMove } from '@/features/inventory/hooks/useStockMoves'
import { ActivitySidebar } from '@/features/audit'
import type { TransactionDrawerProps } from '@/features/_shared'

interface StockMoveDrawerProps extends TransactionDrawerProps {
    stockMoveId?: number
}

export function StockMoveDrawer({ id, open, onOpenChange, stockMoveId }: StockMoveDrawerProps) {
    const entityId = id ?? stockMoveId ?? null
    const { data: move, isLoading } = useStockMove(entityId)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const displayId = move?.display_id ?? `#${entityId}`

    return (
        <>
            <PrintableLayout
                ref={printRef}
                title="Movimiento de Stock"
                displayId={displayId}
            >
                <div className="text-[9px] space-y-1 mb-2">
                    <div className="flex justify-between">
                        <span>Producto:</span>
                        <span>{move?.product_name ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Cantidad:</span>
                        <span>{move?.quantity ?? '0'} {move?.uom_name ?? ''}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Bodega:</span>
                        <span>{move?.warehouse_name ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Tipo:</span>
                        <span>{move?.move_type ?? '-'}</span>
                    </div>
                </div>
            </PrintableLayout>

            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize="50%"
                icon={getEntityIcon('inventory.stockmove')}
                title={<span>{displayId}</span>}
                headerActions={<Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={move?.product_name}
                description={`${move?.move_type ?? ''} · ${formatPlainDate(move?.date)}`}
            >
                <FormSplitLayout sidebar={entityId ? <ActivitySidebar entityType="stock_move" entityId={entityId} /> : undefined} showSidebar={!!entityId}>
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando movimiento de stock">
                    {move && (
                        <div className="p-4 space-y-4">
                            <StatusBadge status={move.move_type} />

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-xs text-muted-foreground">Producto</span>
                                    <p className="font-bold">{move.product_name}</p>
                                    {move.product_code && (
                                        <p className="text-xs text-muted-foreground font-mono">{move.product_code}</p>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Cantidad</span>
                                    <p className="font-bold text-lg">{move.quantity} {move.uom_name ?? ''}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Bodega</span>
                                    <p className="font-medium">{move.warehouse_name}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Tipo de Movimiento</span>
                                    <p className="font-medium">{move.move_type}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-xs text-muted-foreground">Descripción</span>
                                    <p className="text-sm">{move.description || '-'}</p>
                                </div>
                                {move.related_documents && move.related_documents.length > 0 && (
                                    <div className="col-span-2">
                                        <span className="text-xs text-muted-foreground">Documentos Relacionados</span>
                                        <div className="space-y-1 mt-1">
                                            {move.related_documents.map((doc, idx) => (
                                                <p key={idx} className="text-sm">
                                                    {doc.type}: {doc.name ?? `#${doc.id}`}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </SkeletonShell>
                </FormSplitLayout>
            </Drawer>
        </>
    )
}
