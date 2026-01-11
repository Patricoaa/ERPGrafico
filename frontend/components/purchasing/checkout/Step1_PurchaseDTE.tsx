"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FileText, Receipt, AlertCircle } from "lucide-react"

interface Step1_PurchaseDTEProps {
    dteData: any
    setDteData: (data: any) => void
}

export function Step1_PurchaseDTE({ dteData, setDteData }: Step1_PurchaseDTEProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <Label className="text-sm font-semibold">Tipo de Documento</Label>
                <RadioGroup
                    value={dteData.type}
                    onValueChange={(val) => setDteData({ ...dteData, type: val })}
                    className="grid grid-cols-2 gap-4"
                >
                    <Label
                        htmlFor="type-boleta"
                        className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [\u0026:has([data-state=checked])]:border-primary cursor-pointer ${dteData.type === 'BOLETA' ? 'border-primary' : ''}`}
                    >
                        <RadioGroupItem value="BOLETA" id="type-boleta" className="sr-only" />
                        <Receipt className="mb-3 h-6 w-6" />
                        <span className="text-sm font-medium">Boleta</span>
                        <span className="text-[10px] text-muted-foreground mt-1 text-center">Folio requerido</span>
                    </Label>
                    <Label
                        htmlFor="type-factura"
                        className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [\u0026:has([data-state=checked])]:border-primary cursor-pointer ${dteData.type === 'FACTURA' ? 'border-primary' : ''}`}
                    >
                        <RadioGroupItem value="FACTURA" id="type-factura" className="sr-only" />
                        <FileText className="mb-3 h-6 w-6" />
                        <span className="text-sm font-medium">Factura</span>
                        <span className="text-[10px] text-muted-foreground mt-1 text-center">Adjunto requerido</span>
                    </Label>
                </RadioGroup>
            </div>

            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                    <Checkbox
                        id="is-pending"
                        checked={dteData.isPending}
                        onCheckedChange={(checked) => setDteData({ ...dteData, isPending: !!checked })}
                    />
                    <Label htmlFor="is-pending" className="text-xs font-medium cursor-pointer">
                        Recibiré el documento luego
                    </Label>
                </div>

                {!dteData.isPending && (
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10">
                        <div className="space-y-2">
                            <Label htmlFor="folio" className="text-xs font-bold uppercase">
                                N° de Folio {dteData.type === 'BOLETA' && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                                id="folio"
                                placeholder="Ej: 45223"
                                value={dteData.number}
                                onChange={(e) => setDteData({ ...dteData, number: e.target.value })}
                                required={dteData.type === 'BOLETA'}
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
                            <Label htmlFor="attachment" className="text-xs font-bold uppercase">
                                Archivo Adjunto {dteData.type === 'FACTURA' && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                                id="attachment"
                                type="file"
                                onChange={(e) => setDteData({ ...dteData, attachment: e.target.files?.[0] || null })}
                                className="text-xs"
                                required={dteData.type === 'FACTURA'}
                            />
                            {dteData.attachment && (
                                <p className="text-xs text-muted-foreground">
                                    Archivo: {dteData.attachment.name}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {dteData.type === 'BOLETA' && !dteData.isPending && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>El folio de la boleta es obligatorio. Si no lo tiene ahora, marque "Recibiré el documento luego".</p>
                </div>
            )}

            {dteData.type === 'FACTURA' && !dteData.isPending && !dteData.attachment && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>El adjunto de la factura es requerido para registrar el documento.</p>
                </div>
            )}
        </div>
    )
}
