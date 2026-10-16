"use client"

import { DataCell, MoneyDisplay, StaleDataBanner } from "@/components/shared"
import { PrintableLayout, usePrintableDrawer } from "@/features/_shared"
import { DocumentRefLink, DocumentSheet, SHEET_LEFT } from "@/features/documents"
import { formatCurrency } from "@/lib/money"
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
    const { printRef, handlePrint } = usePrintableDrawer()

    return (
        <>
            <PrintableLayout ref={printRef} title="Cheque" displayId={check?.check_number ?? `#${id}`} subtitle={check?.bank_name ?? ''}>
                {check && (
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between"><span>Banco:</span><span>{check.bank_name ?? '-'}</span></div>
                        <div className="flex justify-between"><span>N° Cheque:</span><span>{check.check_number}</span></div>
                        <div className="flex justify-between"><span>Girador:</span><span>{check.counterparty_name ?? check.drawer_name ?? '-'}</span></div>
                        <div className="flex justify-between font-bold pt-1 border-t mt-1"><span>Monto:</span><span>{formatCurrency(parseFloat(check.amount))}</span></div>
                    </div>
                )}
            </PrintableLayout>
            {isError && check && <StaleDataBanner className="mx-4 mt-2" />}
            <DocumentSheet
                label="treasury.check"
                auditType="check"
                open={open}
                onOpenChange={onOpenChange}
                document={check ?? null}
                isLoading={isLoading}
                error={isError && !check ? new Error("No se pudo cargar el cheque.") : undefined}
                loadingLabel="Cargando cheque"
                status={check?.status ?? null}
                onPrint={handlePrint}
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
