"use client"

import { DataCell, MoneyDisplay, StaleDataBanner } from "@/components/shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { useCheck } from '../hooks/useChecks'

interface CheckDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Ficha documental del cheque (ADR-0083): contexto (monto, banco y número, emisión y
 * vencimiento, girador, OV asociada, notas) + relaciones (pago, depósito, protesto).
 */
export function CheckDrawer({ id, open, onOpenChange }: CheckDrawerProps) {
    const { check, isLoading, isError } = useCheck(id, open)

    return (
        <>
            {isError && check && <StaleDataBanner className="mx-4 mt-2" />}
            <DocumentSheet
                label="treasury.check"
                open={open}
                onOpenChange={onOpenChange}
                document={check ?? null}
                isLoading={isLoading}
                error={isError && !check ? new Error("No se pudo cargar el cheque.") : undefined}
                loadingLabel="Cargando cheque"
                status={check?.status ?? null}
                context={check ? [
                    { label: "Monto", value: <MoneyDisplay amount={parseFloat(check.amount)} inline weight="medium" /> },
                    { label: "Banco · N°", value: `${check.bank_name ?? '—'} · ${check.check_number}` },
                    {
                        label: "Emisión → vencimiento",
                        value: (
                            <span className="inline-flex items-center gap-1">
                                <DataCell.Date value={check.issue_date} size="xs" className={SHEET_LEFT} />
                                <span aria-hidden>→</span>
                                <DataCell.Date value={check.due_date} size="xs" className={SHEET_LEFT} />
                            </span>
                        ),
                    },
                    { label: "Girador", value: check.counterparty_name ?? check.drawer_name ?? null },
                    {
                        label: "OV asociada",
                        hidden: !check.sale_order_display,
                        value: check.sale_order_display ? (
                            <DocumentRefLink label="sales.saleorder" id={Number(check.sale_order_display.id)} display={`OV-${check.sale_order_display.number}`} />
                        ) : null,
                    },
                    { label: "Notas", value: check.notes || null, span: 3, hidden: !check.notes },
                ] : []}
            />
        </>
    )
}
