"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FileText, Receipt, AlertCircle } from "lucide-react"

interface Step1_DTEProps {
    dteData: any
    setDteData: (data: any) => void
    isPurchase?: boolean
}

export function Step1_DTE({ dteData, setDteData, isPurchase = false }: Step1_DTEProps) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    Registro de Documento
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al DTE y adjunte el respaldo legal.
                </p>
            </div>
            <div className="space-y-4">
                <RadioGroup
                    value={dteData.type}
                    onValueChange={(val) => setDteData({ ...dteData, type: val })}
                    className="grid grid-cols-2 gap-4"
                >
                    <Label
                        htmlFor="type-boleta"
                        className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer ${dteData.type === 'BOLETA' ? 'border-primary' : ''}`}
                    >
                        <RadioGroupItem value="BOLETA" id="type-boleta" className="sr-only" />
                        <Receipt className="mb-3 h-6 w-6" />
                        <span className="text-sm font-medium">Boleta Electrónica</span>
                        <span className="text-[10px] text-muted-foreground mt-1 text-center">Folio auto-generado</span>
                    </Label>
                    <Label
                        htmlFor="type-factura"
                        className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer ${dteData.type === 'FACTURA' ? 'border-primary' : ''}`}
                    >
                        <RadioGroupItem value="FACTURA" id="type-factura" className="sr-only" />
                        <FileText className="mb-3 h-6 w-6" />
                        <span className="text-sm font-medium">Factura Electrónica</span>
                        <span className="text-[10px] text-muted-foreground mt-1 text-center">Requiere folio manual</span>
                    </Label>
                </RadioGroup>
            </div>

            {dteData.type === 'FACTURA' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                        <Checkbox
                            id="is-pending"
                            checked={dteData.isPending}
                            onCheckedChange={(checked) => setDteData({ ...dteData, isPending: !!checked })}
                        />
                        <Label htmlFor="is-pending" className="text-xs font-medium cursor-pointer">
                            {isPurchase ? "Aún no recibo el documento" : "Emitiré la factura luego"}
                        </Label>
                    </div>

                    {!dteData.isPending && (
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10">
                            <div className="space-y-2">
                                <Label htmlFor="folio" className="text-xs font-bold uppercase">N° de Folio</Label>
                                <Input
                                    id="folio"
                                    placeholder="Ej: 45223"
                                    value={dteData.number}
                                    onChange={(e) => setDteData({ ...dteData, number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-xs font-bold uppercase">Fecha Emisión</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={dteData.date}
                                    onChange={(e) => setDteData({ ...dteData, date: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="attachment" className="text-xs font-bold uppercase">Archivo Adjunto (Opcional)</Label>
                                <Input
                                    id="attachment"
                                    type="file"
                                    onChange={(e) => setDteData({ ...dteData, attachment: e.target.files?.[0] || null })}
                                    className="text-xs"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {dteData.type === 'BOLETA' && !isPurchase && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-xs leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>El sistema asignará el siguiente folio disponible automáticamente al finalizar la venta.</p>
                </div>
            )}
        </div>
    )
}
