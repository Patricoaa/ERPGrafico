"use client"

import React, { useRef } from "react"
import { Drawer, SkeletonShell, StatusBadge } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Printer, Undo2 } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { usePurchaseReturn } from "../hooks/usePurchasing"

interface PurchaseReturnDrawerProps {
    returnId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function PurchaseReturnDrawer({ returnId, open, onOpenChange }: PurchaseReturnDrawerProps) {
    const { returnData, isLoading } = usePurchaseReturn(returnId, open)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

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
                defaultSize="50%"
                title={<><span>{returnData ? `Devolución ${(returnData as any).number}` : "Devolución de Compra"}</span><Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button></>}
                subtitle={(returnData as any)?.supplier_name}
                icon={Undo2}

            >
                {isLoading ? (
                    <SkeletonShell isLoading={true} ariaLabel="Cargando devolución" />
                ) : returnData ? (
                    (() => {
                        const r = returnData as any
                        return (
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Número</span>
                                        <p className="font-medium">{r.number}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Estado</span>
                                        <p><StatusBadge status={r.status} /></p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Proveedor</span>
                                        <p className="font-medium">{r.supplier_name}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Bodega</span>
                                        <p className="font-medium">{r.warehouse_name}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Orden de Compra</span>
                                        <p className="font-medium">{r.purchase_order_number}</p>
                                    </div>
                                </div>
                                {r.lines?.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium mb-2">Líneas</h4>
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted">
                                                    <tr>
                                                        <th className="p-2 text-left">Producto</th>
                                                        <th className="p-2 text-right">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {r.lines.map((line: any, idx: number) => (
                                                        <tr key={idx} className="border-t">
                                                            <td className="p-2">{String(line.product_name)}</td>
                                                            <td className="p-2 text-right">{String(line.quantity_returned)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
