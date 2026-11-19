"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { CheckCircle2, FileEdit, Landmark } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DteFolioFields } from "./DteFolioFields"
import {
    getDteSiiCode,
    isDteClassAutoIssued,
    type DteDirection,
    type DteRegistrationData,
    type FiscalMatchContext,
} from "@/lib/dte"
import type { FiscalMatchPickerPanelProps } from "@/features/tax"

const FiscalMatchPickerPanel = dynamic<FiscalMatchPickerPanelProps>(
    () => import("@/features/tax").then((m) => m.FiscalMatchPickerPanel),
    { ssr: false }
)

export interface DteRegistrationPanelProps {
    data: DteRegistrationData
    onChange: (data: DteRegistrationData) => void
    direction?: DteDirection
    contactId?: number | null
    touchMode?: boolean
    onFolioValidityChange?: (valid: boolean) => void
    onPeriodValidityChange?: (valid: boolean) => void
    fiscalMatchContext?: FiscalMatchContext | null
    invoiceId?: number | null
    invoiceDisplayId?: string
    invoiceTotal?: string
    defaultMode?: "rcv" | "manual"
    className?: string
}

export function DteRegistrationPanel({
    data,
    onChange,
    direction = "sale",
    contactId,
    touchMode = false,
    onFolioValidityChange,
    onPeriodValidityChange,
    fiscalMatchContext,
    invoiceId,
    invoiceDisplayId,
    invoiceTotal,
    defaultMode,
    className,
}: DteRegistrationPanelProps) {
    const isAutoIssued = isDteClassAutoIssued(data.dteClass, direction)
    const hasFiscalMatch = !!fiscalMatchContext && !isAutoIssued

    const [activeTab, setActiveTab] = useState<"rcv" | "manual">(defaultMode ?? "rcv")

    const handleAssignMatch = (matchId: number, folio: string) => {
        onChange({
            ...data,
            pickedFiscalMatchId: matchId,
            pickedFiscalMatchFolio: folio,
            folio: folio || data.folio,
            isPending: false,
        })
        onFolioValidityChange?.(true)
        onPeriodValidityChange?.(true)
    }

    const preContext = fiscalMatchContext
        ? {
              direction,
              sii_code: fiscalMatchContext.sii_code || getDteSiiCode(data.dteClass),
              counterparty_rut: fiscalMatchContext.counterparty_rut,
              amount: fiscalMatchContext.amount,
          }
        : null

    if (data.isPending) {
        return (
            <div className={className ?? "space-y-4"}>
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-xs text-foreground flex items-center justify-between">
                    <span>
                        Ha seleccionado diferir la {direction === "sale" ? "emisión" : "recepción"} del documento. El registro del folio y cuadre queda pospuesto.
                    </span>
                </div>
            </div>
        )
    }

    const assignedBadge = data.pickedFiscalMatchId && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-primary font-medium">
                <CheckCircle2 className="size-4" />
                <span>
                    Asignado al grupo de cuadre #{data.pickedFiscalMatchId} (Folio SII:{" "}
                    {data.pickedFiscalMatchFolio || data.folio})
                </span>
            </div>
            <button
                type="button"
                onClick={() => {
                    onChange({
                        ...data,
                        pickedFiscalMatchId: null,
                        pickedFiscalMatchFolio: null,
                    })
                }}
                className="text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
                Desvincular
            </button>
        </div>
    )

    const manualContent = (
        <div className="space-y-4 pt-1">
            {!data.isPending && !isAutoIssued && (
                <DteFolioFields
                    folio={data.folio}
                    onFolioChange={(val) => {
                        onChange({
                            ...data,
                            folio: val,
                            pickedFiscalMatchId: null,
                            pickedFiscalMatchFolio: null,
                        })
                    }}
                    onFolioValidityChange={onFolioValidityChange}
                    issueDate={data.issueDate}
                    onIssueDateChange={(val) => onChange({ ...data, issueDate: val })}
                    onPeriodValidityChange={onPeriodValidityChange}
                    attachment={data.attachment}
                    onAttachmentChange={(att) => onChange({ ...data, attachment: att })}
                    dteClass={data.dteClass}
                    direction={direction}
                    contactId={contactId}
                    touchMode={touchMode}
                />
            )}
        </div>
    )

    if (!hasFiscalMatch) {
        return (
            <div className={className ?? "space-y-4"}>
                {assignedBadge}
                {manualContent}
            </div>
        )
    }

    if (!hasFiscalMatch) {
        return (
            <div className={className ?? "space-y-4"}>
                {assignedBadge}
                {manualContent}
            </div>
        )
    }

    const rcvDescription = (
        <p className="text-xs text-muted-foreground">
            Seleccione el documento del RCV para registrar el folio localmente y vincular el cuadre fiscal en un solo paso.
        </p>
    )

    const renderPicker = (onSwitchToManual?: () => void) => (
        <FiscalMatchPickerPanel
            invoiceId={invoiceId}
            preInvoiceContext={preContext}
            selectedFiscalMatchId={data.pickedFiscalMatchId}
            onAssign={handleAssignMatch}
            invoiceDisplayId={invoiceDisplayId}
            invoiceTotal={invoiceTotal}
            onSwitchToManual={onSwitchToManual}
        />
    )

    // Only purchase boletas may be registered manually; everything else goes straight to the SII/RCV picker.
    const allowsManual = direction === "purchase" && (data.dteClass === "BOLETA" || data.dteClass === "BOLETA_EXENTA")

    if (!allowsManual) {
        return (
            <div className={className ?? "space-y-4"}>
                {assignedBadge}
                {rcvDescription}
                {renderPicker()}
            </div>
        )
    }

    return (
        <div className={className ?? "space-y-4"}>
            {assignedBadge}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "rcv" | "manual")}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="rcv" className="flex items-center gap-2">
                        <Landmark className="size-4 text-primary" />
                        <span>Desde el SII / RCV (Recomendado)</span>
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                        <FileEdit className="size-4" />
                        <span>Registro manual</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="rcv" className="pt-4 space-y-4">
                    {rcvDescription}
                    {renderPicker(() => setActiveTab("manual"))}
                </TabsContent>

                <TabsContent value="manual" className="pt-2">
                    {manualContent}
                </TabsContent>
            </Tabs>
        </div>
    )
}
