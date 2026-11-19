"use client"

/**
 * NoteStep_Registration
 *
 * Unified DTE registration step for both sales and purchase note wizards.
 * Uses DteRegistrationPanel to offer assignment from RCV pending candidates
 * as primary option, and manual registration as fallback.
 */

import { useMemo } from "react"
import { Banner, DteEmitLaterSwitch, DteRegistrationPanel } from "@/components/shared"
import { type DteClass, type DteDirection, type FiscalMatchContext, getDteSiiCode, isDteClassAutoIssued } from "@/lib/dte"
import type { NoteType, RegistrationData } from "@/features/notes"

interface NoteStep_RegistrationProps {
    noteType: NoteType
    data: RegistrationData
    setData: (data: RegistrationData | ((prev: RegistrationData) => RegistrationData)) => void
    onPeriodValidityChange?: (isValid: boolean) => void
    onFolioValidityChange?: (isValid: boolean) => void
    direction?: DteDirection
    counterpartyRut?: string | null
    total?: number
    invoiceId?: number
}

export function NoteRegistrationStep({
    noteType,
    data,
    setData,
    onPeriodValidityChange,
    onFolioValidityChange,
    direction = "sale",
    counterpartyRut,
    total,
    invoiceId,
}: NoteStep_RegistrationProps) {
    const fiscalContext = useMemo<FiscalMatchContext>(() => {
        const code = getDteSiiCode(noteType as DteClass)
        return {
            direction,
            sii_code: code ?? undefined,
            counterparty_rut: counterpartyRut || undefined,
            total: total && total > 0 ? total : undefined,
        }
    }, [noteType, direction, counterpartyRut, total])

    return (
        <div className="w-full h-full flex flex-col space-y-6">
            {data.isPending && (
                <Banner tone="warning" bleed="lg">
                    Ha seleccionado diferir la {direction === "sale" ? "emisión" : "recepción"} del documento. El registro del folio y cuadre queda pospuesto.
                </Banner>
            )}

            {!isDteClassAutoIssued(noteType as DteClass, direction) && (
                <DteEmitLaterSwitch
                    isPending={!!data.isPending}
                    onChange={(pending) => {
                        setData((prev) => ({
                            ...prev,
                            isPending: pending,
                            documentNumber: pending ? "" : prev.documentNumber,
                            attachment: pending ? null : prev.attachment,
                            pickedFiscalMatchId: null,
                        }))
                        if (pending) {
                            onFolioValidityChange?.(true)
                            onPeriodValidityChange?.(true)
                        }
                    }}
                    direction={direction}
                />
            )}

            <DteRegistrationPanel
                data={{
                    dteClass: noteType as DteClass,
                    isPending: !!data.isPending,
                    folio: data.documentNumber || "",
                    issueDate: data.documentDate || "",
                    attachment: data.attachment || null,
                    pickedFiscalMatchId: data.pickedFiscalMatchId ?? null,
                }}
                onChange={(next) => {
                    setData((prev) => ({
                        ...prev,
                        isPending: next.isPending,
                        documentNumber: next.folio,
                        documentDate: next.issueDate,
                        attachment: next.attachment,
                        pickedFiscalMatchId: next.pickedFiscalMatchId ?? null,
                    }))
                }}
                direction={direction}
                fiscalMatchContext={fiscalContext}
                invoiceId={invoiceId}
                onFolioValidityChange={onFolioValidityChange}
                onPeriodValidityChange={onPeriodValidityChange}
            />
        </div>
    )
}
