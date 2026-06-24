"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DataTable } from "@/components/shared"
import { AlertCircle, Edit, CheckCircle2, Settings2 } from "lucide-react"
import { AdvancedManufacturingDrawer } from "../forms/AdvancedManufacturingDrawer"

import { type SaleOrderLine } from "../../types"

type ManufacturableLine = SaleOrderLine & { originalIndex: number }

interface Step2_ManufacturingDetailsProps {
    orderLines: SaleOrderLine[]
    setOrderLines: (lines: SaleOrderLine[]) => void
}

export function Step2_ManufacturingDetails({ orderLines, setOrderLines }: Step2_ManufacturingDetailsProps) {
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

    // Filter to show only items that require advanced manufacturing
    const manufacturableItems: ManufacturableLine[] = orderLines
        .map((line, index) => ({ ...line, originalIndex: index }))
        .filter(line =>
            line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing
        ) as ManufacturableLine[]

    const handleEditClick = (index: number) => {
        setEditingLineIndex(index)
    }

    const handleConfirmManufacturing = (data: Record<string, unknown>) => {
        if (editingLineIndex === null) return

        const newLines = [...orderLines]
        const line = newLines[editingLineIndex]

        newLines[editingLineIndex] = {
            ...line,
            manufacturing_data: data
        }

        setOrderLines(newLines)
        setEditingLineIndex(null)
    }

    const editingLine = editingLineIndex !== null ? orderLines[editingLineIndex] : null

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-2">
                    Revise y confirme los detalles técnicos de los productos a fabricar.
                </p>

                <DataTable
                    columns={[
                        {
                            header: "Producto",
                            id: "product",
                            cell: ({ row }) => {
                                const item = row.original
                                return (
                                    <div className="flex flex-col gap-1">
                                        <span className="font-bold text-xs leading-tight text-foreground/90">
                                            {item.product_name || item.description}
                                        </span>
                                        <div className="flex flex-wrap gap-1">
                                            {item.internal_code && (
                                                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary">
                                                    {item.internal_code}
                                                </span>
                                            )}
                                            {item.code && item.code !== item.internal_code && (
                                                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/30 text-muted-foreground">
                                                    {item.code}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            },
                        },
                        {
                            header: "Cantidad",
                            accessorKey: "qty",
                            cell: ({ row }) => (
                                <span className="font-mono text-xs font-bold">
                                    {row.original.qty || row.original.quantity}
                                </span>
                            ),
                        },
                        {
                            header: "Estado",
                            id: "status",
                            cell: ({ row }) => {
                                const hasConfig = !!row.original.manufacturing_data
                                return hasConfig ? (
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-success bg-success/10 border border-success/20 px-2 py-1 rounded-sm w-fit">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Configurado
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-sm w-fit">
                                        <AlertCircle className="h-3 w-3" />
                                        Pendiente
                                    </div>
                                )
                            },
                        },
                        {
                            header: "Acciones",
                            id: "actions",
                            cell: ({ row }) => {
                                const hasConfig = !!row.original.manufacturing_data
                                return (
                                    <Button
                                        variant={hasConfig ? "outline" : "default"}
                                        size="sm"
                                        onClick={() => handleEditClick(row.original.originalIndex)}
                                        className={cn(
                                            "h-7 text-[10px] font-bold uppercase tracking-tight",
                                            !hasConfig && "bg-primary hover:bg-primary/90 text-primary-foreground shadow-card"
                                        )}
                                    >
                                        {hasConfig ? (
                                            <Edit className="mr-1.5 h-3 w-3" />
                                        ) : (
                                            <Settings2 className="mr-1.5 h-3 w-3" />
                                        )}
                                        {hasConfig ? "Editar" : "Configurar"}
                                    </Button>
                                )
                            },
                            meta: { align: "right" as const },
                        },
                    ]}
                    data={manufacturableItems}
                    variant="embedded"
                    hidePagination
                    emptyState={{ description: "No hay productos fabricables pendientes de configuración" }}
                />
            </div>

            {editingLine && (
                <AdvancedManufacturingDrawer
                    open={editingLineIndex !== null}
                    onOpenChange={(open) => !open && setEditingLineIndex(null)}
                    product={{
                        ...editingLine,
                        id: editingLine.id!,
                        // Ensure required flags are present for the dialog logic
                        requires_advanced_manufacturing: true,
                        mfg_enable_prepress: editingLine.mfg_enable_prepress ?? true,
                        mfg_enable_press: editingLine.mfg_enable_press ?? true,
                        mfg_enable_postpress: editingLine.mfg_enable_postpress ?? true
                    }}
                    onConfirm={handleConfirmManufacturing}
                />
            )}
        </div>
    )
}
