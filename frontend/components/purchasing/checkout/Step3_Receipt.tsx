"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { FileText, Receipt, FileCheck } from "lucide-react"

interface Step3_ReceiptProps {
    receiptData: any
    setReceiptData: (data: any) => void
}

export function Step3_Receipt({ receiptData, setReceiptData }: Step3_ReceiptProps) {
    const receiptTypes = [
        {
            id: 'IMMEDIATE',
            label: 'Recepción Inmediata',
            description: 'Recibir toda la mercancía ahora',
            icon: Receipt,
            color: 'text-emerald-600'
        },
        {
            id: 'DEFERRED',
            label: 'Recepción Diferida',
            description: 'Registrar factura sin recibir mercancía',
            icon: FileText,
            color: 'text-amber-600'
        },
        {
            id: 'PARTIAL',
            label: 'Recepción Parcial',
            description: 'Recibir cantidades específicas',
            icon: FileCheck,
            color: 'text-blue-600'
        }
    ]

    return (
        <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <Label className="text-xs font-bold uppercase text-muted-foreground mb-3 block">
                    Tipo de Recepción
                </Label>
                <RadioGroup
                    value={receiptData.type}
                    onValueChange={(val) => setReceiptData({ ...receiptData, type: val })}
                    className="space-y-3"
                >
                    {receiptTypes.map((type) => (
                        <div key={type.id} className="relative">
                            <Label
                                htmlFor={`receipt-${type.id}`}
                                className={`flex items-start gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all ${receiptData.type === type.id ? 'border-primary bg-primary/5' : ''
                                    }`}
                            >
                                <RadioGroupItem value={type.id} id={`receipt-${type.id}`} className="mt-1" />
                                <div className={`p-2 rounded-lg bg-background border ${type.color}`}>
                                    <type.icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm font-semibold block">{type.label}</span>
                                    <span className="text-xs text-muted-foreground">{type.description}</span>
                                </div>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {receiptData.type !== 'DEFERRED' && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed animate-in fade-in">
                    <div className="space-y-2">
                        <Label htmlFor="delivery-ref" className="text-xs font-bold uppercase">
                            Referencia de Entrega (Opcional)
                        </Label>
                        <input
                            id="delivery-ref"
                            type="text"
                            placeholder="Ej: Guía de despacho #123"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={receiptData.deliveryReference || ''}
                            onChange={(e) => setReceiptData({ ...receiptData, deliveryReference: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="receipt-notes" className="text-xs font-bold uppercase">
                            Notas de Recepción (Opcional)
                        </Label>
                        <textarea
                            id="receipt-notes"
                            placeholder="Observaciones sobre la recepción..."
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={receiptData.notes || ''}
                            onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
                        />
                    </div>
                </div>
            )}

            {receiptData.type === 'DEFERRED' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Nota:</strong> La mercancía no será recibida en inventario. Podrá registrar la recepción más tarde desde la lista de órdenes de compra.
                    </p>
                </div>
            )}
        </div>
    )
}
