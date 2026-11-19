"use client"

import { useState } from "react"
import { ActionConfirmModal, MoneyDisplay, Section } from "@/components/shared"
import { formatDate, formatMoneyValue } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { dteShortLabel } from "../entity-view/fiscalMatch.entity"
import { useCreateFiscalMatchSale } from "../hooks/useFiscalMatchFeeding"
import type { FiscalMatchDetail, FiscalMatchRcvDetail } from "../types/fiscalMatch"

export interface FiscalMatchRegisterSaleSectionProps {
    /** Grupo huérfano de venta. */
    groupId: number
    /** Su registro del SII: aporta folio, tipo y total a registrar. */
    doc: FiscalMatchRcvDetail
    /** Recibe el grupo resultante para que la ficha lo siga. */
    onGroupChange?: (group: FiscalMatchDetail) => void
}

/**
 * Venta que falta en el ERP: crear la factura de venta en el ERP con el folio y datos del RCV.
 * Nada corre sin un clic explícito; pide confirmación antes de crear.
 */
export function FiscalMatchRegisterSaleSection({ groupId, doc, onGroupChange }: FiscalMatchRegisterSaleSectionProps) {
    const create = useCreateFiscalMatchSale()
    const [confirming, setConfirming] = useState(false)
    const dteLabel = dteShortLabel(doc.dte_type) ?? `DTE ${doc.dte_type}`

    return (
        <Section title="Registrar en el ERP">
            <Section.Row
                title={`${dteLabel} Folio ${doc.folio}`}
                description={`${doc.issue_date ? formatDate(doc.issue_date) : "Sin fecha"} · Registrar documento en ERP`}
                value={<MoneyDisplay amount={doc.total_amount} currency="CLP" />}
                actions={
                    <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={create.isPending}
                        onClick={() => setConfirming(true)}
                    >
                        Crear Factura en ERP
                    </Button>
                }
            />

            <ActionConfirmModal
                open={confirming}
                onOpenChange={setConfirming}
                onConfirm={() =>
                    void create
                        .mutateAsync({ id: groupId })
                        .then((g) => onGroupChange?.(g))
                        .catch(() => undefined)
                }
                title={`Crear ${dteLabel} Folio ${doc.folio}`}
                description={`Se registrará la factura de venta en el ERP por un total de ${formatMoneyValue(doc.total_amount)} y quedará automáticamente cuadrada con el registro del SII y sus pagos TUU.`}
                confirmText="Crear factura"
                cancelText="Cancelar"
                variant="default"
            />
        </Section>
    )
}
