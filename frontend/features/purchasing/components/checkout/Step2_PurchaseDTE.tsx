"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FileText, Receipt, AlertCircle } from "lucide-react"
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from "@/features/settings/api/settingsApi"
import { useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"

interface Step2_PurchaseDTEProps {
    dteData: any
    setDteData: (data: any) => void
}

export function Step2_PurchaseDTE({ dteData, setDteData }: Step2_PurchaseDTEProps) {
    // Fetch billing settings to get allowed DTE types
    const { data: settings } = useQuery({
        queryKey: ['settings-billing'],
        queryFn: settingsApi.getBillingSettings,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

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
        { id: 'BOLETA_EXENTA', label: 'Boleta Exenta', code: '41', icon: Receipt, color: 'text-amber-600' },
        { id: 'FACTURA_EXENTA', label: 'Factura Exenta', code: '34', icon: FileText, color: 'text-amber-600' },
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
                                N° de Folio <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="folio"
                                placeholder="Ej: 45223"
                                value={dteData.number}
                                onChange={(e) => setDteData({ ...dteData, number: e.target.value })}
                                required
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
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>El folio de la boleta es obligatorio. Si no lo tiene ahora, marque "Recibiré el documento luego".</p>
                </div>
            )}

            {dteData.type !== 'BOLETA' && !dteData.isPending && (!dteData.attachment || !dteData.number) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>El folio y el adjunto son requeridos para registrar este tipo de documento.</p>
                </div>
            )}
        </div>
    )
}
