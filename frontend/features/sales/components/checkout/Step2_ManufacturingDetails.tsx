"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DataTable, Chip } from "@/components/shared"
import { AlertCircle, Edit, CheckCircle2, Settings2, Zap, Package } from "lucide-react"
import { AdvancedManufacturingDrawer } from "../forms/AdvancedManufacturingDrawer"

import { type SaleOrderLine } from "../../types"

type ManufacturableLine = SaleOrderLine & { originalIndex: number }

interface Step2_ManufacturingDetailsProps {
    orderLines: SaleOrderLine[]
    setOrderLines: (lines: SaleOrderLine[]) => void
}

export function Step2_ManufacturingDetails({ orderLines, setOrderLines }: Step2_ManufacturingDetailsProps) {
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

    // Determine manufacturing sub-type
    const getMfgSubType = (line: SaleOrderLine): 'SIMPLE' | 'EXPRESS' | 'ADVANCED' => {
        if (line.requires_advanced_manufacturing) return 'ADVANCED'
        if (line.mfg_auto_finalize) return 'EXPRESS'
        return 'SIMPLE'
    }

    // Filter to show all manufacturable items
    const manufacturableItems: ManufacturableLine[] = orderLines
        .map((line, index) => ({ ...line, originalIndex: index }))
        .filter(line =>
            line.product_type === 'MANUFACTURABLE'
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

    const editingLineRaw = editingLineIndex !== null ? orderLines[editingLineIndex] : null
    const editingLine = editingLineRaw && getMfgSubType(editingLineRaw) === 'ADVANCED' ? editingLineRaw : null

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
                                                <Chip size="xs" intent="primary" className="font-mono">
                                                    {item.internal_code}
                                                </Chip>
                                            )}
                                            {item.code && item.code !== item.internal_code && (
                                                <Chip size="xs" intent="neutral" className="font-mono">
                                                    {item.code}
                                                </Chip>
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
                            header: "Tipo",
                            id: "subtype",
                            cell: ({ row }) => {
                                const subtype = getMfgSubType(row.original)
                                if (subtype === 'ADVANCED') {
                                    return (
                                        <Chip size="sm" intent="primary" icon={Settings2}>
                                            Avanzada
                                        </Chip>
                                    )
                                }
                                if (subtype === 'EXPRESS') {
                                    return (
                                        <Chip size="sm" intent="info" icon={Zap}>
                                            Express
                                        </Chip>
                                    )
                                }
                                return (
                                    <Chip size="sm" intent="neutral" icon={Package}>
                                        Simple
                                    </Chip>
                                )
                            },
                        },
                        {
                            header: "Estado",
                            id: "status",
                            cell: ({ row }) => {
                                const subtype = getMfgSubType(row.original)
                                if (subtype === 'ADVANCED') {
                                    const hasConfig = !!row.original.manufacturing_data
                                    return hasConfig ? (
                                        <Chip size="sm" intent="success" icon={CheckCircle2}>
                                            Configurado
                                        </Chip>
                                    ) : (
                                        <Chip size="sm" intent="warning" icon={AlertCircle}>
                                            Pendiente
                                        </Chip>
                                    )
                                }
                                if (subtype === 'EXPRESS') {
                                    return (
                                        <Chip size="sm" intent="info" icon={Zap}>
                                            Auto-Finalizado
                                        </Chip>
                                    )
                                }
                                return (
                                    <Chip size="sm" intent="success" icon={CheckCircle2}>
                                        Disponible
                                    </Chip>
                                )
                            },
                        },
                        {
                            header: "Acciones",
                            id: "actions",
                            cell: ({ row }) => {
                                const subtype = getMfgSubType(row.original)
                                if (subtype !== 'ADVANCED') return null
                                const hasConfig = !!row.original.manufacturing_data
                                return (
                                    <Button
                                        variant={hasConfig ? "outline" : "default"}
                                        size="sm"
                                        onClick={() => handleEditClick(row.original.originalIndex)}
                                        className={cn(
                                            "h-7 text-3xs font-medium uppercase tracking-tight",
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
                    emptyState={{ description: "No hay productos fabricables en esta orden" }}
                />
            </div>

            {editingLine && (
                <AdvancedManufacturingDrawer
                    open={editingLineIndex !== null}
                    onOpenChange={(open) => !open && setEditingLineIndex(null)}
                    product={{
                        ...editingLine,
                        id: editingLine.id as number,
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
