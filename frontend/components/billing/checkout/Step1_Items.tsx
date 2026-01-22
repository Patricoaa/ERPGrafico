"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

interface Step1_ItemsProps {
    workflow: any
    originalInvoice: any
    onSuccess: (updatedWorkflow: any) => void
}

export function Step1_Items({
    workflow,
    originalInvoice,
    onSuccess
}: Step1_ItemsProps) {
    const [loading, setLoading] = useState(false)
    const [selectedItems, setSelectedItems] = useState<Record<number, any>>({})

    const isCreditNote = workflow.invoice.dte_type === 'NOTA_CREDITO'
    const lines = originalInvoice?.lines || []

    const toggleItem = (lineId: number) => {
        const line = lines.find((l: any) => l.id === lineId)
        if (!line) return

        setSelectedItems(prev => {
            if (prev[lineId]) {
                const newState = { ...prev }
                delete newState[lineId]
                return newState
            }
            return {
                ...prev,
                [lineId]: {
                    product_id: line.product,
                    product_name: line.product_name,
                    quantity: line.quantity_delivered || line.quantity,
                    unit_price: line.unit_price,
                    tax_amount: (line.unit_price_gross - line.unit_price), // Approx tax per unit
                    reason: ""
                }
            }
        })
    }

    const updateItem = (lineId: number, field: string, value: any) => {
        setSelectedItems(prev => ({
            ...prev,
            [lineId]: { ...prev[lineId], [field]: value }
        }))
    }

    const handleSubmit = async () => {
        const itemsToSubmit = Object.values(selectedItems)
        if (itemsToSubmit.length === 0) {
            toast.error("Seleccione al menos un item para corregir.")
            return
        }

        try {
            setLoading(true)
            const res = await api.post(`/billing/note-workflows/${workflow.id}/select-items/`, {
                selected_items: itemsToSubmit
            })
            onSuccess(res.data)
        } catch (error: any) {
            console.error("Error selecting items:", error)
            toast.error(error.response?.data?.error || "Error al procesar los items.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Selección de Productos/Servicios</h3>
                <Badge variant="outline" className="text-[10px] font-bold">
                    {lines.length} Líneas Disponibles
                </Badge>
            </div>

            <div className="border rounded-xl overflow-hidden bg-muted/5">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Producto/Servicio</TableHead>
                            <TableHead className="text-right">Original</TableHead>
                            <TableHead className="text-right">Entregado</TableHead>
                            <TableHead className="w-32 text-center">Cant. Corregir</TableHead>
                            <TableHead>Motivo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lines.map((line: any) => {
                            const isSelected = !!selectedItems[line.id]
                            const maxQty = line.quantity_delivered || line.quantity

                            return (
                                <TableRow key={line.id} className={cn(isSelected && "bg-primary/5")}>
                                    <TableCell>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleItem(line.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm tracking-tight">{line.product_name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{line.product_code || line.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-xs">
                                        {line.quantity} {line.uom_name}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-xs text-green-600">
                                        {line.quantity_delivered || 0} {line.uom_name}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            disabled={!isSelected}
                                            value={selectedItems[line.id]?.quantity || ""}
                                            onChange={(e) => updateItem(line.id, 'quantity', e.target.value)}
                                            className="h-8 text-center font-bold"
                                            max={isCreditNote ? maxQty : undefined}
                                            min={0.0001}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            placeholder="Ej: Producto dañado"
                                            disabled={!isSelected}
                                            value={selectedItems[line.id]?.reason || ""}
                                            onChange={(e) => updateItem(line.id, 'reason', e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {isCreditNote && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex gap-3 text-amber-800">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-xs leading-relaxed font-medium">
                        <strong>Nota:</strong> Para Notas de Crédito, la cantidad a corregir no puede superar la cantidad efectivamente entregada de cada producto.
                    </p>
                </div>
            )}

            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSubmit}
                    disabled={loading || Object.keys(selectedItems).length === 0}
                    className="group px-8 py-6 rounded-xl font-bold transition-all hover:scale-[1.02]"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            Continuar
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ")
}
