"use client"

import { useMemo, useEffect } from "react"
import { useBillingSettingsQuery } from "@/features/settings"
import { Banner, StepHeader, DteRegistrationPanel, DteTypeSelector, DteEmitLaterSwitch } from "@/components/shared"
import { FileText } from "lucide-react"
import { DteClass, FiscalMatchContext, getDteSiiCode, isDteClassAutoIssued } from "@/lib/dte"
import { type DTEData } from "../../types"

interface Step2_PurchaseDTEProps {
    dteData: DTEData
    setDteData: (data: DTEData) => void
    contactId?: number | string | null
    supplierRut?: string | null
    total?: number
    onValidityChange?: (isValid: boolean) => void
    onPeriodValidityChange?: (isValid: boolean) => void
}

const DEFAULT_ALLOWED: DteClass[] = ["BOLETA", "FACTURA", "BOLETA_EXENTA", "FACTURA_EXENTA"]

export function Step2_PurchaseDTE({
    dteData,
    setDteData,
    supplierRut,
    total,
    onValidityChange,
    onPeriodValidityChange,
}: Step2_PurchaseDTEProps) {
    const { settings } = useBillingSettingsQuery()

    const allowedDteTypes = useMemo<DteClass[]>(() => {
        if (!settings) return DEFAULT_ALLOWED
        const allowed = (settings.allowed_dte_types_receive || []) as DteClass[]
        const valid = allowed.filter((t) => DEFAULT_ALLOWED.includes(t))
        return valid.length > 0 ? valid : DEFAULT_ALLOWED
    }, [settings])

    useEffect(() => {
        if (!allowedDteTypes.includes(dteData.type as DteClass)) {
            setDteData({ ...dteData, type: allowedDteTypes[0], pickedFiscalMatchId: null })
        }
    }, [dteData.type, allowedDteTypes, setDteData])

    const fiscalContext = useMemo<FiscalMatchContext>(() => {
        const code = getDteSiiCode(dteData.type as DteClass)
        return {
            direction: "purchase",
            sii_code: code ?? undefined,
            counterparty_rut: supplierRut || undefined,
            total: total && total > 0 ? total : undefined,
        }
    }, [dteData.type, supplierRut, total])

    return (
        <div className="space-y-6">
            {dteData.isPending && (
                <Banner tone="warning" bleed="lg">
                    Ha seleccionado diferir la recepción del documento. El registro del folio y cuadre queda pospuesto.
                </Banner>
            )}

            <StepHeader
                title="Registro de Documento"
                description="Asigne el documento pendiente desde el RCV del SII o regístrelo manualmente con su respaldo."
                icon={FileText}
            />

            <DteTypeSelector
                value={dteData.type as DteClass}
                onChange={(cls) => setDteData({ ...dteData, type: cls, pickedFiscalMatchId: null })}
                options={allowedDteTypes}
                direction="purchase"
                disabled={allowedDteTypes.length <= 1}
            />
            {!isDteClassAutoIssued(dteData.type as DteClass, "purchase") && (
                <DteEmitLaterSwitch
                    isPending={!!dteData.isPending}
                    onChange={(pending) => {
                        setDteData({
                            ...dteData,
                            isPending: pending,
                            number: pending ? "" : dteData.number,
                            attachment: pending ? null : dteData.attachment,
                            pickedFiscalMatchId: null,
                        })
                        if (pending) {
                            onValidityChange?.(true)
                            onPeriodValidityChange?.(true)
                        }
                    }}
                    direction="purchase"
                />
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
                direction="purchase"
                fiscalMatchContext={fiscalContext}
                onFolioValidityChange={onValidityChange}
                onPeriodValidityChange={onPeriodValidityChange}
            />
        </div>
    )
}
