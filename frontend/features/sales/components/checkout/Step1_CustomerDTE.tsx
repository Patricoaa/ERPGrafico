"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import {
    User,
    FileText,
    Receipt,
    AlertCircle,
    FileWarning,
} from "lucide-react"
import { useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useBillingSettingsQuery } from "@/features/settings"
import { useServerDate } from "@/hooks/useServerDate"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"
import { FolioValidationInput } from "@/components/shared/FolioValidationInput"
import { PeriodValidationDateInput } from "@/components/shared/PeriodValidationDateInput"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { LabeledContainer } from "@/components/shared"

import { CheckoutDTEData, PendingDebt } from "../../types"

interface Step1_CustomerDTEProps {
    /* Customer */
    selectedCustomerId: string | null
    setSelectedCustomerId: (id: string | null) => void
    setSelectedCustomerName: (name: string) => void
    /* DTE */
    dteData: CheckoutDTEData
    setDteData: (data: CheckoutDTEData) => void
    isDefaultCustomer?: boolean
    onValidityChange?: (isValid: boolean) => void
    onPeriodValidityChange?: (isValid: boolean) => void
    /* Debts banner */
    pendingDebts?: PendingDebt[] | null
    onDebtClick?: (debt: PendingDebt) => void
}

export function Step1_CustomerDTE({
    selectedCustomerId,
    setSelectedCustomerId,
    setSelectedCustomerName,
    dteData,
    setDteData,
    isDefaultCustomer = false,
    onValidityChange,
    onPeriodValidityChange,
    pendingDebts,
    onDebtClick,
}: Step1_CustomerDTEProps) {
    const { dateString } = useServerDate()
    const { openHub } = useHubPanel()

    // Fetch billing settings
    const { settings } = useBillingSettingsQuery()

    const allowedDteTypes = useMemo(() => {
        if (!settings) return ["BOLETA", "FACTURA", "BOLETA_EXENTA", "FACTURA_EXENTA"]
        const allowed = settings.allowed_dte_types_emit || []
        return allowed.length > 0 ? allowed : ["BOLETA", "FACTURA", "BOLETA_EXENTA", "FACTURA_EXENTA"]
    }, [settings])

    // Enforce allowed DTE types
    useEffect(() => {
        if (isDefaultCustomer && dteData.type !== "BOLETA" && allowedDteTypes.includes("BOLETA")) {
            setDteData({ ...dteData, type: "BOLETA" })
        } else if (!allowedDteTypes.includes(dteData.type)) {
            setDteData({ ...dteData, type: allowedDteTypes[0] })
        }
    }, [isDefaultCustomer, dteData.type, setDteData, allowedDteTypes])

    // Set default date
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
            {/* ── Pending Debts Banner ─────────────────────────── */}
            {pendingDebts && pendingDebts.length > 0 && (
                <Alert className="border border-warning/30 bg-warning/5 p-3 sm:py-2.5 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <FileWarning className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <span className="text-sm font-bold text-warning-foreground shrink-0">
                                    Deudas Pendientes ({pendingDebts.length})
                                </span>
                                <span className="text-xs text-warning-foreground/80 leading-none">
                                    Total:{" "}
                                    <span className="font-bold font-mono">
                                        ${pendingDebts
                                            .reduce((sum, d) => sum + Number(d.balance || 0), 0)
                                            .toLocaleString("es-CL")}
                                    </span>
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 ml-8 sm:ml-0">
                            {pendingDebts.slice(0, 4).map((debt) => (
                                <Button
                                    key={debt.id}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 border-warning/20 text-warning-foreground hover:bg-warning/10 text-[10px] gap-1 font-medium bg-white/50"
                                    onClick={() => onDebtClick?.(debt)}
                                >
                                    <span className="font-mono">NV-{debt.number}</span>
                                    <span className="opacity-60">
                                        ${Number(debt.balance).toLocaleString("es-CL")}
                                    </span>
                                    {debt.days_overdue > 0 && (
                                        <span className="text-destructive font-bold ml-0.5">
                                            {debt.days_overdue}d
                                        </span>
                                    )}
                                </Button>
                            ))}
                            {pendingDebts.length > 4 && (
                                <div className="text-[10px] text-warning/70 py-1 px-1.5 bg-warning/5 rounded border border-warning/10">
                                    +{pendingDebts.length - 4}
                                </div>
                            )}
                        </div>
                    </div>
                </Alert>
            )}

            {/* ── Customer Selector ───────────────────────────── */}
            <div className="space-y-4">
                <LabeledContainer 
                    label="Seleccionar Cliente" 
                    icon={<User className="h-4 w-4" />}
                >
                    <AdvancedContactSelector
                        value={selectedCustomerId}
                        onChange={setSelectedCustomerId}
                        onSelectContact={(contact) => setSelectedCustomerName(contact.name)}
                        placeholder="Buscar por Nombre, RUT o Email..."
                        className="border-none shadow-none focus-visible:ring-0 h-9"
                    />
                </LabeledContainer>
            </div>

            <Separator className="opacity-30" />

            {/* ── DTE Document Section ────────────────────────── */}
            <div className="space-y-4">
                <div className="flex flex-col gap-1">
                    <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        Documento Tributario
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Seleccione el tipo de documento y adjunte el respaldo si corresponde.
                    </p>
                </div>

                {isDefaultCustomer && (
                    <Alert className="bg-warning/5 border-warning/20 text-warning-foreground py-3">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <AlertDescription className="text-xs font-medium">
                            El cliente por defecto solo permite emisión de{" "}
                            <strong>Boleta Electrónica</strong>.
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
                                htmlFor={`type-${opt.id.toLowerCase().replace("_", "-")}`}
                                className={cn(
                                    "flex flex-1 flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer min-w-[120px]",
                                    dteData.type === opt.id ? "border-primary" : ""
                                )}
                            >
                                <RadioGroupItem
                                    value={opt.id}
                                    id={`type-${opt.id.toLowerCase().replace("_", "-")}`}
                                    className="sr-only"
                                />
                                <opt.icon className={cn("mb-3 h-6 w-6", opt.color)} />
                                <span className="text-sm font-medium">{opt.label}</span>
                                <span className="text-[10px] text-muted-foreground mt-1 text-center">
                                    Código SII: {opt.code}
                                </span>
                            </Label>
                        ))}
                    </RadioGroup>
                </div>

                {(dteData.type === "FACTURA" || dteData.type === "FACTURA_EXENTA") && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center space-x-2 px-3 py-2 bg-muted/20 rounded-md border border-dashed">
                            <Checkbox
                                id="is-pending"
                                checked={dteData.isPending}
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
                            />
                            <Label htmlFor="is-pending" className="text-[10px] font-black uppercase tracking-wider cursor-pointer text-muted-foreground/80">
                                Emitiré la factura luego
                            </Label>
                        </div>

                        {!dteData.isPending && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <LabeledContainer label="Folio">
                                        <FolioValidationInput
                                            value={dteData.number}
                                            onChange={(val) => setDteData({ ...dteData, number: val })}
                                            dteType={dteData.type}
                                            isPurchase={false}
                                            onValidityChange={onValidityChange}
                                            disabled={dteData.isPending}
                                            className="border-none shadow-none focus-visible:ring-0 h-9"
                                        />
                                    </LabeledContainer>
                                </div>
                                <div>
                                    <LabeledContainer label="Fecha de Emisión">
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
                                            className="border-none shadow-none focus-visible:ring-0 h-9"
                                        />
                                    </LabeledContainer>
                                </div>
                                <div className="col-span-2">
                                    <LabeledContainer label="Documento de Respaldo (PDF/XML)">
                                        <DocumentAttachmentDropzone
                                            file={dteData.attachment}
                                            onFileChange={(file) =>
                                                setDteData({ ...dteData, attachment: file })
                                            }
                                            dteType={dteData.type}
                                            isPending={dteData.isPending}
                                        />
                                    </LabeledContainer>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {dteData.type !== "BOLETA" && !dteData.isPending && (!dteData.attachment || !dteData.number) && (
                    <div className="flex items-start gap-2 p-3 bg-warning/5 text-warning-foreground rounded-lg text-xs leading-tight border border-warning/20">
                        <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                        <p>El folio y el adjunto son requeridos para registrar este tipo de documento.</p>
                    </div>
                )}

                {dteData.type === "BOLETA" && (
                    <div className="flex items-start gap-2 p-3 bg-info/5 text-info-foreground rounded-lg text-xs leading-tight border border-info/20">
                        <AlertCircle className="h-4 w-4 shrink-0 text-info" />
                        <p>
                            El sistema asignará el siguiente folio disponible automáticamente al
                            finalizar la venta.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
