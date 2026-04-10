"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FileText, Receipt, AlertCircle, Loader2, CheckCircle, ShieldAlert } from "lucide-react"
import { useFolioValidation } from "@/hooks/useFolioValidation"
import { useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from "@/features/settings/api/settingsApi"
import { useServerDate } from "@/hooks/useServerDate"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"

import { CheckoutDTEData } from "../../types"

interface Step1_DTEProps {
    dteData: CheckoutDTEData
    setDteData: (data: CheckoutDTEData) => void
    isPurchase?: boolean
    isDefaultCustomer?: boolean
    isPeriodClosed?: boolean
    periodMessage?: string
}

export function Step1_DTE({ 
    dteData, 
    setDteData, 
    isPurchase = false, 
    isDefaultCustomer = false,
    isPeriodClosed = false,
    periodMessage = ""
}: Step1_DTEProps) {
    const { validateFolio, isValidating, validationResult, clearValidation } = useFolioValidation()
    const { dateString } = useServerDate()

    // Fetch billing settings to get allowed DTE types
    const { data: settings } = useQuery({
        queryKey: ['settings-billing'],
        queryFn: settingsApi.getBillingSettings,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

    const allowedDteTypes = useMemo(() => {
        if (!settings) return ['BOLETA', 'FACTURA', 'BOLETA_EXENTA', 'FACTURA_EXENTA'];
        const allowed = settings.allowed_dte_types_emit || [];
        return allowed.length > 0 ? allowed : ['BOLETA', 'FACTURA', 'BOLETA_EXENTA', 'FACTURA_EXENTA'];
    }, [settings])

    // Validate folio when number changes
    useEffect(() => {
        if (dteData.type === 'FACTURA' && dteData.number && !dteData.isPending) {
            validateFolio(dteData.number, dteData.type)
        } else {
            clearValidation()
        }
    }, [dteData.number, dteData.type, dteData.isPending, validateFolio, clearValidation])

    // Enforce allowed DTE types
    useEffect(() => {
        if (isDefaultCustomer && dteData.type !== 'BOLETA' && allowedDteTypes.includes('BOLETA')) {
            setDteData({ ...dteData, type: 'BOLETA' })
        } else if (!allowedDteTypes.includes(dteData.type)) {
            // If current type is not allowed, switch to first allowed
            setDteData({ ...dteData, type: allowedDteTypes[0] })
        }
    }, [isDefaultCustomer, dteData.type, setDteData, allowedDteTypes])

    // Set default date if required
    useEffect(() => {
        if (dateString && !dteData.date && dteData.type !== 'BOLETA') {
            setDteData({ ...dteData, date: dateString })
        }
    }, [dateString, dteData.date, dteData.type, setDteData, dteData])

    const dteOptions = [
        { id: 'BOLETA', label: 'Boleta Electrónica', code: '39', icon: Receipt },
        { id: 'FACTURA', label: 'Factura Electrónica', code: '33', icon: FileText },
        { id: 'BOLETA_EXENTA', label: 'Boleta Exenta', code: '41', icon: Receipt, color: 'text-warning' },
        { id: 'FACTURA_EXENTA', label: 'Factura Exenta', code: '34', icon: FileText, color: 'text-warning' },
    ]

    const filteredOptions = useMemo(() => {
        let options = dteOptions.filter(opt => allowedDteTypes.includes(opt.id));
        if (isDefaultCustomer) {
            options = options.filter(opt => opt.id === 'BOLETA');
        }
        return options;
    }, [allowedDteTypes, isDefaultCustomer])

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

            {isDefaultCustomer && (
                <Alert className="bg-warning/5 border-warning/20 text-warning-foreground py-3">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-xs font-medium">
                        El cliente por defecto solo permite emisión de <strong>Boleta Electrónica</strong>.
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-4">
                <RadioGroup
                    value={dteData.type}
                    onValueChange={(val) => setDteData({ ...dteData, type: val })}
                    className="flex flex-wrap gap-4 w-full"
                >
                    {filteredOptions.map((opt) => (
                        <Label
                            key={opt.id}
                            htmlFor={`type-${opt.id.toLowerCase().replace('_', '-')}`}
                            className={cn(
                                "flex flex-1 flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer min-w-[120px]",
                                dteData.type === opt.id ? 'border-primary' : ''
                            )}
                        >
                            <RadioGroupItem value={opt.id} id={`type-${opt.id.toLowerCase().replace('_', '-')}`} className="sr-only" />
                            <opt.icon className={cn("mb-3 h-6 w-6", opt.color)} />
                            <span className="text-sm font-medium">{opt.label}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 text-center">Código SII: {opt.code}</span>
                        </Label>
                    ))}
                </RadioGroup>
            </div>

            {(dteData.type === 'FACTURA' || dteData.type === 'FACTURA_EXENTA') && (
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
                                <Label htmlFor="folio" className="text-xs font-bold uppercase">N° de Folio <span className="text-destructive">*</span></Label>
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
                                            <CheckCircle className="absolute right-3 top-2.5 h-4 w-4 text-success" />
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
                                <Label htmlFor="date" className="text-xs font-bold uppercase">Fecha Emisión <span className="text-destructive">*</span></Label>
                                <div className="space-y-2">
                                    <Input
                                        id="date"
                                        type="date"
                                        value={dteData.date}
                                        onChange={(e) => setDteData({ ...dteData, date: e.target.value })}
                                        className={cn(isPeriodClosed && "border-destructive text-destructive")}
                                    />
                                    {isPeriodClosed && (
                                        <Alert variant="destructive" className="py-2 bg-destructive/5 border-destructive/20">
                                            <ShieldAlert className="h-4 w-4" />
                                            <AlertDescription className="text-[10px] font-bold uppercase tracking-tight leading-none">
                                                {periodMessage || "Periodo cerrado"}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <DocumentAttachmentDropzone
                                    file={dteData.attachment}
                                    onFileChange={(file) => setDteData({ ...dteData, attachment: file })}
                                    dteType={dteData.type}
                                    isPending={dteData.isPending}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {dteData.type !== 'BOLETA' && !dteData.isPending && (!dteData.attachment || !dteData.number) && (
                <div className="flex items-start gap-2 p-3 bg-warning/5 text-warning-foreground rounded-lg text-xs leading-tight border border-warning/20">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                    <p>El folio y el adjunto son requeridos para registrar este tipo de documento.</p>
                </div>
            )}

            {dteData.type === 'BOLETA' && !isPurchase && (
                <div className="flex items-start gap-2 p-3 bg-info/5 text-info-foreground rounded-lg text-xs leading-tight border border-info/20">
                    <AlertCircle className="h-4 w-4 shrink-0 text-info" />
                    <p>El sistema asignará el siguiente folio disponible automáticamente al finalizar la venta.</p>
                </div>
            )}
        </div>
    )
}
