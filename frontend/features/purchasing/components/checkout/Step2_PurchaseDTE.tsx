"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FileText, Receipt, AlertCircle, ShieldAlert } from "lucide-react"
import { useBillingSettingsQuery } from "@/features/settings"
import { useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FolioValidationInput } from "@/components/shared/FolioValidationInput"
import { PeriodValidationDateInput } from "@/components/shared/PeriodValidationDateInput"
import { DTEData } from "../../types"

interface Step2_PurchaseDTEProps {
    dteData: DTEData
    setDteData: (data: DTEData) => void
    contactId?: number | string | null
    onValidityChange?: (isValid: boolean) => void
    onPeriodValidityChange?: (isValid: boolean) => void
}

export function Step2_PurchaseDTE({ 
    dteData, 
    setDteData,
    contactId,
    onValidityChange,
    onPeriodValidityChange
}: Step2_PurchaseDTEProps) {
    // Fetch billing settings to get allowed DTE types
    const { settings } = useBillingSettingsQuery()

    const allowedDteTypes = useMemo(() => {
        if (!settings) return ['BOLETA', 'FACTURA', 'BOLETA_EXENTA', 'FACTURA_EXENTA'];
        const allowed = settings.allowed_dte_types_receive || [];
        return allowed.length > 0 ? allowed : ['BOLETA', 'FACTURA', 'BOLETA_EXENTA', 'FACTURA_EXENTA'];
    }, [settings])

    // Enforce allowed DTE types
    useEffect(() => {
        if (!allowedDteTypes.includes(dteData.type)) {
            // If current type is not allowed, switch to first allowed
            setDteData({ ...dteData, type: allowedDteTypes[0] })
        }
    }, [dteData.type, setDteData, allowedDteTypes])

    const dteOptions = [
        { id: 'BOLETA', label: 'Boleta', code: '39', icon: Receipt },
        { id: 'FACTURA', label: 'Factura', code: '33', icon: FileText },
        { id: 'BOLETA_EXENTA', label: 'Boleta Exenta', code: '41', icon: Receipt, color: 'text-warning' },
        { id: 'FACTURA_EXENTA', label: 'Factura Exenta', code: '34', icon: FileText, color: 'text-warning' },
    ]

    const filteredOptions = useMemo(() => {
        return dteOptions.filter(opt => allowedDteTypes.includes(opt.id));
    }, [allowedDteTypes])
    return (
        <div className="space-y-8">
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
                            <opt.icon className={`mb-3 h-6 w-6 ${opt.color || ''}`} />
                            <span className="text-sm font-medium">{opt.label}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 text-center">Código SII: {opt.code}</span>
                        </Label>
                    ))}
                </RadioGroup>
            </div>

            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                    <Checkbox
                        id="is-pending"
                        checked={dteData.isPending}
                        onCheckedChange={(checked) => {
                            const pending = !!checked;
                            if (pending) {
                                setDteData({ ...dteData, isPending: true, number: '', attachment: null });
                                onValidityChange?.(true);
                                onPeriodValidityChange?.(true);
                            } else {
                                setDteData({ ...dteData, isPending: false });
                            }
                        }}
                    />
                    <Label htmlFor="is-pending" className="text-xs font-medium cursor-pointer">
                        Recibiré el documento luego
                    </Label>
                </div>

                {!dteData.isPending && (
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/10">
                        <div className="space-y-2">
                            <FolioValidationInput
                                value={dteData.number}
                                onChange={(val: string) => setDteData({ ...dteData, number: val })}
                                dteType={dteData.type}
                                contactId={contactId ? Number(contactId) : undefined}
                                isPurchase={true}
                                onValidityChange={onValidityChange}
                                disabled={dteData.isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-xs font-bold uppercase">Fecha Emisión <span className="text-destructive">*</span></Label>
                            <div>
                                <PeriodValidationDateInput
                                    date={dteData.date ? new Date(dteData.date + 'T12:00:00') : undefined}
                                    onDateChange={(d) => {
                                        if (d) {
                                            const year = d.getFullYear()
                                            const month = String(d.getMonth() + 1).padStart(2, '0')
                                            const day = String(d.getDate()).padStart(2, '0')
                                            setDteData({ ...dteData, date: `${year}-${month}-${day}` })
                                        } else {
                                            setDteData({ ...dteData, date: "" })
                                        }
                                    }}
                                    validationType="both"
                                    onValidityChange={onPeriodValidityChange}
                                />
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

            {dteData.type === 'BOLETA' && !dteData.isPending && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 text-warning rounded-lg text-xs leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>El folio de la boleta es obligatorio. Si no lo tiene ahora, marque &quot;Recibiré el documento luego&quot;.</p>
                </div>
            )}

            {dteData.type !== 'BOLETA' && !dteData.isPending && (!dteData.attachment || !dteData.number) && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 text-warning rounded-lg text-xs leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>El folio y el adjunto son requeridos para registrar este tipo de documento.</p>
                </div>
            )}
        </div>
    )
}
