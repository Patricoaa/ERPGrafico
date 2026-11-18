"use client"

import { useMemo, useEffect } from "react"
import { useBillingSettingsQuery } from "@/features/settings"
import { useServerDate } from "@/hooks/useServerDate"
import { Banner, StepHeader, DteRegistrationPanel } from "@/components/shared"
import { FileText } from "lucide-react"
import { DteClass, FiscalMatchContext, getDteSiiCode } from "@/lib/dte"
import type { CheckoutDTEData } from "../../types"

interface Step2_DTEProps {
    dteData: CheckoutDTEData
    setDteData: (data: CheckoutDTEData) => void
    isDefaultCustomer?: boolean
    onValidityChange?: (isValid: boolean) => void
    onPeriodValidityChange?: (isValid: boolean) => void
    /** POS touch: habilita el numpad para el folio. Fuera de POS se escribe con teclado. */
    touchMode?: boolean
    customerRut?: string | null
    total?: number
}

const DEFAULT_ALLOWED: DteClass[] = ["BOLETA", "FACTURA", "BOLETA_EXENTA", "FACTURA_EXENTA"]

export function Step2_DTE({
    dteData,
    setDteData,
    isDefaultCustomer = false,
    onValidityChange,
    onPeriodValidityChange,
    touchMode = false,
    customerRut,
    total,
}: Step2_DTEProps) {
    const { dateString } = useServerDate()
    const { settings } = useBillingSettingsQuery()

    const allowedDteTypes = useMemo<DteClass[]>(() => {
        if (isDefaultCustomer) return ["BOLETA"]
        if (!settings) return DEFAULT_ALLOWED
        const allowed = (settings.allowed_dte_types_emit || []) as DteClass[]
        const valid = allowed.filter((t) => DEFAULT_ALLOWED.includes(t))
        return valid.length > 0 ? valid : DEFAULT_ALLOWED
    }, [isDefaultCustomer, settings])

    // Ensure valid type selection
    useEffect(() => {
        if (isDefaultCustomer && dteData.type !== "BOLETA") {
            setDteData({ ...dteData, type: "BOLETA", pickedFiscalMatchId: null })
        } else if (!allowedDteTypes.includes(dteData.type as DteClass)) {
            setDteData({ ...dteData, type: allowedDteTypes[0], pickedFiscalMatchId: null })
        }
    }, [isDefaultCustomer, dteData.type, allowedDteTypes, setDteData])

    // Default date if needed
    useEffect(() => {
        if (dateString && !dteData.date && dteData.type !== "BOLETA") {
            setDteData({ ...dteData, date: dateString })
        }
    }, [dateString, dteData.date, dteData.type, setDteData, dteData])

    const fiscalContext = useMemo<FiscalMatchContext>(() => {
        const code = getDteSiiCode(dteData.type as DteClass)
        return {
            direction: "sale",
            sii_code: code ?? undefined,
            counterparty_rut: customerRut || undefined,
            total: total && total > 0 ? total : undefined,
        }
    }, [dteData.type, customerRut, total])

    return (
        <div className="space-y-6">
            <StepHeader
                title="Documento Tributario"
                description="Seleccione el tipo de documento a emitir para esta venta y vincúlelo con el SII."
                icon={FileText}
            />

            {isDefaultCustomer && (
                <Banner tone="info" bleed="lg">
                    El cliente por defecto solo permite emisión de <strong>Boleta Electrónica</strong> (emisión automática).
                </Banner>
            )}

            <DteRegistrationPanel
                data={{
                    dteClass: dteData.type as DteClass,
                    isPending: !!dteData.isPending,
                    folio: dteData.number || "",
                    issueDate: dteData.date || "",
                    attachment: dteData.attachment || null,
                    pickedFiscalMatchId: dteData.pickedFiscalMatchId ?? null,
                }}
                onChange={(next) => {
                    setDteData({
                        ...dteData,
                        type: next.dteClass,
                        isPending: next.isPending,
                        number: next.folio,
                        date: next.issueDate,
                        attachment: next.attachment,
                        pickedFiscalMatchId: next.pickedFiscalMatchId ?? null,
                    })
                }}
                direction="sale"
                fiscalMatchContext={fiscalContext}
                typeOptions={allowedDteTypes}
                onFolioValidityChange={onValidityChange}
                onPeriodValidityChange={onPeriodValidityChange}
                touchMode={touchMode}
            />
        </div>
    )
}
