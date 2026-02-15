"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { AlertCircle, Paintbrush, Edit, CheckCircle2 } from "lucide-react"
import { AdvancedManufacturingDialog } from "../forms/AdvancedManufacturingDialog"

interface Step2_ManufacturingDetailsProps {
    orderLines: any[]
    setOrderLines: (lines: any[]) => void
}

export function Step2_ManufacturingDetails({ orderLines, setOrderLines }: Step2_ManufacturingDetailsProps) {
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

    // Filter to show only items that require advanced manufacturing
    const manufacturableItems = orderLines
        .map((line, index) => ({ ...line, originalIndex: index }))
        .filter(line =>
            (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing) ||
            (line.product_type === 'MANUFACTURABLE' && !line.has_bom)
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
                                            <span className="font-medium text-xs leading-tight">{item.name || item.product_name || item.description}</span>
                                            <div className="flex flex-wrap gap-1">
                                                {item.internal_code && (
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                                                        {item.internal_code}
                                                    </Badge>
                                                )}
                                                {item.code && item.code !== item.internal_code && (
                                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                                                        {item.code}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.qty || item.quantity}</TableCell>
                                    <TableCell>
                                        {hasConfig ? (
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-fit">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Configurado
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full w-fit">
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
                        // Ensure required flags are present for the dialog logic
                        requires_advanced_manufacturing: true, // If we are here, it is true or implied
                        mfg_enable_prepress: editingLine.mfg_enable_prepress ?? true, // Default to enabled if not set, or let dialog handle defaults
                        mfg_enable_press: editingLine.mfg_enable_press ?? true,
                        mfg_enable_postpress: editingLine.mfg_enable_postpress ?? true
                    }}
                    onConfirm={handleConfirmManufacturing}
                />
            )}
        </div>
    )
}
