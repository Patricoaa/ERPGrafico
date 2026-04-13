"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { AlertCircle, Paintbrush, Edit, CheckCircle2 } from "lucide-react"
import { AdvancedManufacturingDialog } from "../forms/AdvancedManufacturingDialog"

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

    const handleConfirmManufacturing = (data: any) => {
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
            <Alert className="bg-primary/5 border-primary/20">
                <Paintbrush className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-bold">Detalles de Fabricación</AlertTitle>
                <AlertDescription>
                    Revise y confirme los detalles técnicos de los productos a fabricar.
                </AlertDescription>
            </Alert>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {manufacturableItems.map((item) => {
                            const hasConfig = !!item.manufacturing_data
                            return (
                                <TableRow key={item.originalIndex}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col gap-1 py-1">
                                            <span className="font-medium text-xs leading-tight">{item.product_name || item.description}</span>
                                            <div className="flex flex-wrap gap-1">
                                                {item.internal_code && (
                                                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/30 text-muted-foreground opacity-80 whitespace-nowrap">
                                                        {item.internal_code}
                                                    </span>
                                                )}
                                                {item.code && item.code !== item.internal_code && (
                                                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/60 text-muted-foreground opacity-80 whitespace-nowrap">
                                                        {item.code}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.qty || item.quantity}</TableCell>
                                    <TableCell>
                                        {hasConfig ? (
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full w-fit">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Configurado
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full w-fit">
                                                <AlertCircle className="h-3 w-3" />
                                                Pendiente
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditClick(item.originalIndex)}
                                        >
                                            <Edit className="mr-2 h-4 w-4" />
                                            {hasConfig ? "Editar" : "Configurar"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {editingLine && (
                <AdvancedManufacturingDialog
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
