"use client"

import React, { useRef } from "react"
import { Drawer, SkeletonShell, StatusBadge, DataTable } from "@/components/shared"
import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useDrawerIdentity } from "@/features/_shared/drawer"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { usePurchaseReturn } from "../hooks/usePurchasing"
import { formDrawerWidth } from "@/lib/form-widths"

interface PurchaseReturnDrawerProps {
    returnId?: number | null
    id?: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function PurchaseReturnDrawer({ returnId, id, open, onOpenChange }: PurchaseReturnDrawerProps) {
    const entityId = returnId ?? id ?? null
    const { returnData, isLoading } = usePurchaseReturn(entityId, open)
    const identity = useDrawerIdentity('purchasing.purchasereturn', 'view', returnData as Record<string, unknown> | undefined, {
        overrideTitle: returnData ? `Devolución ${String((returnData as Record<string, unknown>).number)}` : "Devolución de Compra",
    })
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => [
        {
            id: "product",
            header: "Producto",
            cell: ({ row }) => String(row.original.product_name)
        },
        {
            id: "quantity",
            header: "Cantidad",
            cell: ({ row }) => String(row.original.quantity_returned),
            meta: { align: "right" }
        }
    ], [])

    return (
        <>
            <PrintableLayout
                ref={printRef}
                title="Devolución de Compra"
                displayId={String(returnData?.number ?? `#${returnId}`)}
                subtitle={String(returnData?.supplier_name ?? '')}
            >
                {(() => {
                    const r = returnData as Record<string, unknown> | undefined
                    if (!r) return null
                    const lines = r.lines as Array<Record<string, unknown>> | undefined
                    return (
                        <>
                            <div className="text-[9px] space-y-1 mb-2 border-b pb-2">
                                <div className="flex justify-between">
                                    <span>Proveedor:</span>
                                    <span>{String(r.supplier_name ?? '-')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Bodega:</span>
                                    <span>{String(r.warehouse_name ?? '-')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>OC:</span>
                                    <span>{String(r.purchase_order_number ?? '-')}</span>
                                </div>
                            </div>
                            {lines?.map((line: Record<string, unknown>, idx: number) => (
                                <div key={idx} className="flex justify-between text-[10px]">
                                    <span className="flex-1">{String(line.product_name)}</span>
                                    <span className="w-12 text-right">{String(line.quantity_returned)}</span>
                                </div>
                            ))}
                        </>
                    )
                })()}
            </PrintableLayout>

            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                boundary="embedded"
                defaultSize={formDrawerWidth("master", false)}
                title={identity.title}
                headerActions={<Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={identity.subtitle}
                icon={identity.icon}

            >
                {isLoading ? (
                    <SkeletonShell isLoading={true} ariaLabel="Cargando devolución" />
                ) : returnData ? (
                    (() => {
                        const r = returnData as Record<string, unknown>
                        const lines = r.lines as Array<Record<string, unknown>> | undefined
                        return (
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Número</span>
                                        <p className="font-medium">{String(r.number)}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Estado</span>
                                        <p><StatusBadge status={String(r.status)} /></p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Proveedor</span>
                                        <p className="font-medium">{String(r.supplier_name)}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Bodega</span>
                                        <p className="font-medium">{String(r.warehouse_name)}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Orden de Compra</span>
                                        <p className="font-medium">{String(r.purchase_order_number)}</p>
                                    </div>
                                </div>
                                {lines && lines.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium mb-2">Líneas</h4>
                                        <div className="border rounded-md overflow-hidden">
                                            <DataTable
                                                columns={columns}
                                                data={lines}
                                                variant="minimal"
                                                hidePagination
                                                noBorder
                                                emptyState={{
                                                    title: "No hay líneas",
                                                    description: "No se encontraron líneas."
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })()
                ) : null}
            </Drawer>
        </>
    )
}
