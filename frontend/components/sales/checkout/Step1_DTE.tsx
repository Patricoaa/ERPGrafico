"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FileText, Receipt, AlertCircle, Loader2, CheckCircle } from "lucide-react"
import { useFolioValidation } from "@/hooks/useFolioValidation"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Step1_DTEProps {
    dteData: any
    setDteData: (data: any) => void
    isPurchase?: boolean
}

export function Step1_DTE({ dteData, setDteData, isPurchase = false }: Step1_DTEProps) {
    const { validateFolio, isValidating, validationResult, clearValidation } = useFolioValidation()

    // Validate folio when number changes
    useEffect(() => {
        if (dteData.type === 'FACTURA' && dteData.number && !dteData.isPending) {
            validateFolio(dteData.number, dteData.type)
        } else {
            clearValidation()
        }
    }, [dteData.number, dteData.type, dteData.isPending, validateFolio, clearValidation])

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
                                <div className="relative">
                                    <Input
                                        id="folio"
                                        placeholder="Ej: 45223"
                                        value={dteData.number}
                                        onChange={(e) => setDteData({ ...dteData, number: e.target.value })}
                                        className={cn(
                                            validationResult && !validationResult.is_unique && "border-destructive pr-10"
                                        )}
                                    />
                                    {isValidating && (
                                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                    {validationResult && !isValidating && (
                                        validationResult.is_unique ? (
                                            <CheckCircle className="absolute right-3 top-2.5 h-4 w-4 text-emerald-600" />
                                        ) : (
                                            <AlertCircle className="absolute right-3 top-2.5 h-4 w-4 text-destructive" />
                                        )
                                    )}
                                </div>
                                {validationResult && !validationResult.is_unique && (
                                    <Alert variant="destructive" className="mt-2 py-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-xs">
                                            {validationResult.message}
                                            {validationResult.existing_invoice && (
                                                <div className="mt-1 text-[10px] opacity-80">
                                                    Usado en: {validationResult.existing_invoice.customer_name} ({validationResult.existing_invoice.date})
                                                </div>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}
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
