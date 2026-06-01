"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
    FileText,
    Receipt,
    AlertCircle,
} from "lucide-react"
import { useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useBillingSettingsQuery } from "@/features/settings"
import { useServerDate } from "@/hooks/useServerDate"

import { DocumentAttachmentDropzone, FolioValidationInput, FormSection, LabeledContainer, LabeledSwitch, PeriodValidationDateInput } from '@/components/shared'

import type { CheckoutDTEData } from "../../types"

interface Step2_DTEProps {
    dteData: CheckoutDTEData
    setDteData: (data: CheckoutDTEData) => void
    isDefaultCustomer?: boolean
    onValidityChange?: (isValid: boolean) => void
    onPeriodValidityChange?: (isValid: boolean) => void
}

export function Step2_DTE({
    dteData,
    setDteData,
    isDefaultCustomer = false,
    onValidityChange,
    onPeriodValidityChange,
}: Step2_DTEProps) {
    const { dateString } = useServerDate()

    const { settings } = useBillingSettingsQuery()

    const allowedDteTypes = useMemo(() => {
        if (!settings) return ["BOLETA", "FACTURA", "BOLETA_EXENTA", "FACTURA_EXENTA"]
        const allowed = settings.allowed_dte_types_emit || []
        return allowed.length > 0 ? allowed : ["BOLETA", "FACTURA", "BOLETA_EXENTA", "FACTURA_EXENTA"]
    }, [settings])

    useEffect(() => {
        if (isDefaultCustomer && dteData.type !== "BOLETA" && allowedDteTypes.includes("BOLETA")) {
            setDteData({ ...dteData, type: "BOLETA" })
        } else if (!allowedDteTypes.includes(dteData.type)) {
            setDteData({ ...dteData, type: allowedDteTypes[0] })
        }
    }, [isDefaultCustomer, dteData.type, setDteData, allowedDteTypes])

    useEffect(() => {
        if (dateString && !dteData.date && dteData.type !== "BOLETA") {
            setDteData({ ...dteData, date: dateString })
        }
    }, [dateString, dteData.date, dteData.type, setDteData, dteData])

    const dteOptions = [
        { id: "BOLETA", label: "Boleta Electrónica", code: "39", icon: Receipt },
        { id: "FACTURA", label: "Factura Electrónica", code: "33", icon: FileText },
        { id: "BOLETA_EXENTA", label: "Boleta Exenta", code: "41", icon: Receipt, color: "text-warning" },
        { id: "FACTURA_EXENTA", label: "Factura Exenta", code: "34", icon: FileText, color: "text-warning" },
    ]

    const filteredOptions = useMemo(() => {
        let options = dteOptions.filter((opt) => allowedDteTypes.includes(opt.id))
        if (isDefaultCustomer) {
            options = options.filter((opt) => opt.id === "BOLETA")
        }
        return options
    }, [allowedDteTypes, isDefaultCustomer])

    return (
        <div className="space-y-6">
            <FormSection title="Documento Tributario" icon={FileText} />

            <RadioGroup
                value={dteData.type}
                onValueChange={(val) => setDteData({ ...dteData, type: val })}
                className="grid grid-cols-1 gap-2"
            >
                {filteredOptions.map((opt) => (
                    <Label
                        key={opt.id}
                        htmlFor={`type-${opt.id.toLowerCase().replace("_", "-")}`}
                        className={cn(
                            "flex items-center gap-4 rounded-md border-2 border-muted bg-popover py-4 px-5 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer",
                            dteData.type === opt.id ? "border-primary" : ""
                        )}
                    >
                        <RadioGroupItem
                            value={opt.id}
                            id={`type-${opt.id.toLowerCase().replace("_", "-")}`}
                            className="sr-only"
                        />
                        <div className={cn(
                            "flex items-center justify-center h-9 w-9 rounded-md shrink-0",
                            dteData.type === opt.id ? "bg-primary/10" : "bg-muted"
                        )}>
                            <opt.icon className={cn("h-5 w-5", opt.color)} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">{opt.label}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                                Código SII: {opt.code}
                            </span>
                        </div>
                    </Label>
                ))}
            </RadioGroup>

            {(dteData.type === "FACTURA" || dteData.type === "FACTURA_EXENTA") && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <LabeledSwitch
                        label="Emisión"
                        description={dteData.isPending ? "Emitiré la factura luego" : "Emisión inmediata"}
                        checked={!!dteData.isPending}
                        onCheckedChange={(checked) => {
                            const pending = !!checked
                            if (pending) {
                                setDteData({
                                    ...dteData,
                                    isPending: true,
                                    number: "",
                                    attachment: null,
                                })
                                onValidityChange?.(true)
                                onPeriodValidityChange?.(true)
                            } else {
                                setDteData({ ...dteData, isPending: false })
                            }
                        }}
                        icon={<FileText className={cn("h-4 w-4 transition-colors", dteData.isPending ? "text-warning" : "text-muted-foreground/30")} />}
                        className={cn(dteData.isPending ? "bg-warning/5 border-warning/20 shadow-sm" : "border-dashed")}
                    />

                    {!dteData.isPending && (
                        <div className="grid grid-cols-2 gap-4">
                            <FolioValidationInput
                                value={dteData.number}
                                onChange={(val) => setDteData({ ...dteData, number: val })}
                                dteType={dteData.type}
                                isPurchase={false}
                                onValidityChange={onValidityChange}
                                disabled={dteData.isPending}
                            />

                            <PeriodValidationDateInput
                                date={
                                    dteData.date
                                        ? new Date(`${dteData.date}T12:00:00`)
                                        : undefined
                                }
                                onDateChange={(d) => {
                                    if (d) {
                                        const year = d.getFullYear()
                                        const month = String(d.getMonth() + 1).padStart(2, "0")
                                        const day = String(d.getDate()).padStart(2, "0")
                                        setDteData({
                                            ...dteData,
                                            date: `${year}-${month}-${day}`,
                                        })
                                    } else {
                                        setDteData({ ...dteData, date: "" })
                                    }
                                }}
                                validationType="both"
                                onValidityChange={onPeriodValidityChange}
                            />

                            <div className="col-span-2">
                                <LabeledContainer label="Documento de Respaldo (PDF/XML)">
                                    <DocumentAttachmentDropzone
                                        file={dteData.attachment}
                                        onFileChange={(file) =>
                                            setDteData({ ...dteData, attachment: file })
                                        }
                                        dteType={dteData.type}
                                        isPending={dteData.isPending}
                                        hideLabel
                                    />
                                </LabeledContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isDefaultCustomer && (
                <Alert className="bg-warning/10 border-warning/30 text-warning [&>svg]:text-warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs font-medium">
                        El cliente por defecto solo permite emisión de{" "}
                        <strong>Boleta Electrónica</strong>.
                    </AlertDescription>
                </Alert>
            )}

            {dteData.type !== "BOLETA" && !dteData.isPending && (!dteData.attachment || !dteData.number) && (
                <Alert className="bg-warning/10 border-warning/30 text-warning [&>svg]:text-warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs font-medium">
                        El folio y el adjunto son requeridos para registrar este tipo de documento.
                    </AlertDescription>
                </Alert>
            )}

            {dteData.type === "BOLETA" && (
                <Alert className="bg-info/10 border-info/30 text-info [&>svg]:text-info">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs font-medium">
                        El sistema asignará el siguiente folio disponible automáticamente al
                        finalizar la venta.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    )
}
