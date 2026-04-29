"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { AlertCircle, Paintbrush, Edit, CheckCircle2, Settings2 } from "lucide-react"
import { AdvancedManufacturingModal } from "../forms/AdvancedManufacturingModal"
import { LabeledContainer } from "@/components/shared/LabeledContainer"

import { SaleOrderLine } from "../../types"

interface Step2_ManufacturingDetailsProps {
    orderLines: SaleOrderLine[]
    setOrderLines: (lines: SaleOrderLine[]) => void
}

export function Step2_ManufacturingDetails({ orderLines, setOrderLines }: Step2_ManufacturingDetailsProps) {
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

    // Filter to show only items that require advanced manufacturing
    const manufacturableItems = orderLines
        .map((line, index) => ({ ...line, originalIndex: index }))
        .filter(line =>
            line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing
        )

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
            <LabeledContainer
                label="Detalles de Fabricación"
                icon={<Paintbrush className="h-4 w-4" />}
                className="bg-background"
            >
                <div className="p-4 space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Revise y confirme los detalles técnicos de los productos a fabricar.
                    </p>

                    <div className="rounded-sm border border-border/50 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent border-border/50">
                                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">Producto</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">Cantidad</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">Estado</TableHead>
                                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {manufacturableItems.map((item) => {
                                    const hasConfig = !!item.manufacturing_data
                                    return (
                                        <TableRow key={item.originalIndex} className="border-border/40 hover:bg-muted/20 transition-colors">
                                            <TableCell className="py-3">
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
                                            </TableCell>
                                            <TableCell className="py-3 font-mono text-xs font-bold">
                                                {item.qty || item.quantity}
                                            </TableCell>
                                            <TableCell className="py-3">
                                                {hasConfig ? (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-success bg-success/10 border border-success/20 px-2 py-1 rounded-sm w-fit">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Configurado
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-sm w-fit">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Pendiente
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 text-right">
                                                <Button
                                                    variant={hasConfig ? "outline" : "default"}
                                                    size="sm"
                                                    onClick={() => handleEditClick(item.originalIndex)}
                                                    className={cn(
                                                        "h-7 text-[10px] font-bold uppercase tracking-tight",
                                                        !hasConfig && "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                                    )}
                                                >
                                                    {hasConfig ? (
                                                        <Edit className="mr-1.5 h-3 w-3" />
                                                    ) : (
                                                        <Settings2 className="mr-1.5 h-3 w-3" />
                                                    )}
                                                    {hasConfig ? "Editar" : "Configurar"}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </LabeledContainer>

            {editingLine && (
                <AdvancedManufacturingModal
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
