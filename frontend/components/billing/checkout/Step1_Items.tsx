"use client"

import { useState, useImperativeHandle, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, ArrowRight, Loader2, Tag } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Step1_ItemsProps {
    workflow: any
    originalInvoice: any
    onSuccess: (updatedWorkflow: any) => void
}

export const Step1_Items = forwardRef(({
    workflow,
    originalInvoice,
    onSuccess
}: Step1_ItemsProps, ref) => {
    const [loading, setLoading] = useState(false)
    const [selectedItems, setSelectedItems] = useState<Record<number, any>>({})

    const isCreditNote = workflow.invoice.dte_type === 'NOTA_CREDITO'
    const lines = originalInvoice?.lines || []

    useImperativeHandle(ref, () => ({
        submit: handleSubmit,
        loading
    }))

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
            <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-black tracking-tighter text-foreground uppercase">
                    Selección de Productos
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                    Indique las cantidades a {isCreditNote ? 'devolver' : 'ajustar'} de la factura original.
                </p>
            </div>

            <div className="border-2 rounded-2xl overflow-hidden bg-card shadow-sm border-muted/20">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-b-2">
                            <TableHead className="w-14 text-center">
                                <Tag className="h-4 w-4 mx-auto text-muted-foreground" />
                            </TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Producto/Servicio</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest text-muted-foreground">Original</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest text-muted-foreground">Entregado</TableHead>
                            <TableHead className="w-40 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Cant. Corregir</TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Motivo / Razón</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lines.map((line: any) => {
                            const isSelected = !!selectedItems[line.id]
                            const maxQty = Math.floor(line.quantity_delivered || line.quantity)

                            return (
                                <TableRow key={line.id} className={cn(
                                    "transition-colors",
                                    isSelected ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-muted/5 border-l-4 border-l-transparent"
                                )}>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleItem(line.id)}
                                            className="h-5 w-5 rounded-md border-2 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-sm tracking-tight text-foreground leading-tight">
                                                {line.product_name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter tabular-nums">
                                                ID: {line.product_code || line.product}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-xs tabular-nums text-muted-foreground">
                                        {line.quantity} {line.uom_name}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-xs tabular-nums text-emerald-600 bg-emerald-500/5 px-3">
                                        {line.quantity_delivered || 0} {line.uom_name}
                                    </TableCell>
                                    <TableCell className="px-4">
                                        <div className="relative group">
                                            <Input
                                                type="number"
                                                step="1"
                                                disabled={!isSelected}
                                                value={selectedItems[line.id]?.quantity ?? ""}
                                                onChange={(e) => {
                                                    const val = e.target.value === "" ? "" : parseInt(e.target.value) || 0;
                                                    updateItem(line.id, 'quantity', val);
                                                }}
                                                className={cn(
                                                    "h-10 text-center font-black text-base transition-all rounded-xl border-2",
                                                    isSelected ? "bg-background border-primary shadow-sm" : "bg-muted/30 border-transparent opacity-50"
                                                )}
                                                max={isCreditNote ? maxQty : undefined}
                                                min={1}
                                            />
                                            {isSelected && isCreditNote && (
                                                <div className="absolute -top-2 -right-2">
                                                    <Badge className="h-5 min-w-5 flex items-center justify-center bg-primary text-[10px] font-black pointer-events-none">
                                                        MAX {maxQty}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            placeholder="Indique motivo del ajuste..."
                                            disabled={!isSelected}
                                            value={selectedItems[line.id]?.reason || ""}
                                            onChange={(e) => updateItem(line.id, 'reason', e.target.value)}
                                            className={cn(
                                                "h-10 text-xs font-semibold placeholder:font-medium placeholder:italic transition-all border-2",
                                                isSelected ? "bg-background border-muted shadow-sm focus:border-primary" : "bg-muted/30 border-transparent opacity-50"
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {isCreditNote && (
                <div className="bg-blue-50/50 border-2 border-blue-100 rounded-2xl p-5 flex gap-4 text-blue-900 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-2 bg-blue-100 rounded-xl shrink-0 h-fit">
                        <AlertCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight">Regla de Negocio: Devoluciones</p>
                        <p className="text-xs leading-relaxed font-semibold opacity-80">
                            Las Notas de Crédito solo permiten corregir hasta la cantidad que ya fue entregada logísticamente.
                            Use números enteros para las cantidades.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
})

Step1_Items.displayName = "Step1_Items"

