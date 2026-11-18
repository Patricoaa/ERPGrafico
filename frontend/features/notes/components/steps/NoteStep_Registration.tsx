"use client"

/**
 * NoteStep_Registration
 *
 * Unified DTE registration step for both sales and purchase note wizards.
 * Uses DteRegistrationPanel to offer assignment from RCV pending candidates
 * as primary option, and manual registration as fallback.
 */

import { useMemo } from "react"
import { DteRegistrationPanel } from "@/components/shared"
import { DteClass, DteDirection, FiscalMatchContext, getDteSiiCode } from "@/lib/dte"
import type { NoteType, RegistrationData } from "@/features/notes"

interface NoteStep_RegistrationProps {
    isCreditNote: boolean
    noteType: NoteType
    data: RegistrationData
    setData: (data: RegistrationData | ((prev: RegistrationData) => RegistrationData)) => void
    onPeriodValidityChange?: (isValid: boolean) => void
    direction?: DteDirection
    counterpartyRut?: string | null
    total?: number
    invoiceId?: number
}

export function NoteRegistrationStep({
    isCreditNote,
    noteType,
    data,
    setData,
    onPeriodValidityChange,
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
                onPeriodValidityChange={onPeriodValidityChange}
            />
        </div>
    )
}
