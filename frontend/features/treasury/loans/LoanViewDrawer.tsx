"use client"

import { useState, useMemo } from 'react'
import { Banknote, Calendar, Building2, FileText, CreditCard, Eye, DollarSign } from 'lucide-react'
import {
    DataCell, StatCard, StatusBadge, BaseModal,
    type DocumentField, type LifecycleStep, type DocumentActionItem,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { DocumentSheet, SHEET_LEFT } from '@/features/documents'
import { Collection, useEntityCollection, formatMoneyValue, formatDate } from '@/components/entity-view'
import { loanInstallmentEntity, loanInstallmentViews, type LoanInstallmentRow } from '../entity-view/loanInstallment.entity'
import { useLoan } from '../hooks/useLoans'
import { parseDateOnly } from '@/lib/utils'
import { LoanPayInstallmentModal } from './LoanPayInstallmentModal'
import { LoanInstallmentReadonlyModal } from './LoanInstallmentReadonlyModal'
import { PrepayLoanModal } from './PrepayLoanModal'
import type { BankLoan, LoanInstallment } from './types'

interface Props {
    loanId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onDisburse?: (loan: BankLoan) => void
}

function formatLoanMoney(value: string, currency: string) {
    const n = parseFloat(value || '0')
    if (currency === 'UF') {
        return `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} UF`
    }
    return new Intl.NumberFormat('es-CL', {
        style: 'currency', currency: 'CLP',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n)
}

function getLoanLifecycle(loan: BankLoan): LifecycleStep[] {
    const isDisbursed = loan.status !== 'DRAFT'
    return [
        { id: 'origin', label: 'Registrado', icon: FileText, status: 'success' },
        {
            id: 'treasury',
            label: isDisbursed ? 'Desembolsado' : 'Desembolsar',
            icon: Banknote,
            status: isDisbursed ? 'success' : 'active',
        },
        {
            id: 'completed',
            label: loan.status === 'PAID' ? 'Pagado' : loan.status === 'DEFAULTED' ? 'En Mora' : 'Finalizar',
            icon: FileText,
            status: loan.status === 'PAID' ? 'success' : loan.status === 'DEFAULTED' ? 'destructive' : 'neutral',
        },
    ]
}

function FieldGrid({ rows }: { rows: [string, string][] }) {
    return (
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
            {rows.map(([label, value]) => (
                <div key={label} className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-sm font-medium tabular-nums">{value}</div>
                </div>
            ))}
        </div>
    )
}

function AmortizationTab({ loan, onPayInst, onViewInst, onShowFeeDetail }: {
    loan: BankLoan
    onPayInst: (inst: LoanInstallmentRow) => void
    onViewInst: (inst: LoanInstallmentRow) => void
    onShowFeeDetail: () => void
}) {
    const fmtKpi = (val: string) => {
        const n = parseFloat(val)
        if (loan.currency === 'UF') {
            // eslint-disable-next-line entity-view/no-adhoc-format -- UF is not ISO 4217
            return `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))} UF`
        }
        return formatMoneyValue(n, 'CLP')
    }

    const tableData = useMemo<LoanInstallmentRow[]>(() => {
        const openingFee = parseFloat(loan.opening_fee)
        const stampTax = parseFloat(loan.stamp_tax)
        const feeTotal = openingFee + stampTax
        const syntheticFeeRow: LoanInstallmentRow | null = feeTotal > 0 ? {
            id: -1, display_id: '', loan: loan.id, loan_display_id: loan.display_id,
            number: 0, due_date: loan.start_date, principal_amount: '0', interest_amount: '0',
            insurance_amount: '0', total_amount: feeTotal.toFixed(2),
            outstanding_balance: loan.principal, status: 'PAID', status_display: 'Pagado',
            is_overdue: false, paid_at: null, payment_movement: null,
            uf_value_used: null, clp_amount_paid: null, penalty_paid: '0', notes: '',
            _feeTotal: feeTotal,
        } : null
        return syntheticFeeRow ? [syntheticFeeRow, ...loan.installments] : loan.installments
    }, [loan])

    const collection = useEntityCollection(
        loanInstallmentEntity,
        { rows: tableData },
        { pagination: { mode: 'none' } },
    )

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="shrink-0 grid grid-cols-6 gap-3 sm:grid-cols-5 pb-4">
                <StatCard label="Capital" value={fmtKpi(loan.principal)} icon={Banknote} accent="info" />
                <StatCard label="Saldo Insoluto" value={fmtKpi(loan.outstanding_balance)} icon={FileText} accent="warning" />
                <StatCard label="Cuotas Pagadas" value={`${loan.paid_installments_count} / ${loan.installments_count}`} icon={Calendar} accent="success" />
                <StatCard label="Próx. Vencimiento" value={formatDate(loan.next_due_date) || '—'} icon={Calendar} accent="info" />
                <StatCard label="Total Desembolsado" value={fmtKpi(loan.total_disbursed || '0')} icon={DollarSign} accent="info" />
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                label="Tabla de amortización"
                actions={(row) => {
                    if (row.number === 0) {
                        return (
                            <Button size="sm" variant="outline" onClick={onShowFeeDetail} title="Ver detalle">
                                <Eye className="h-3.5 w-3.5" />
                            </Button>
                        )
                    }
                    if (row.status === 'PENDING' || row.status === 'OVERDUE') {
                        return (
                            <Button size="sm" variant="outline" onClick={() => onPayInst(row)} title="Pagar">
                                <DollarSign className="h-3.5 w-3.5" />
                            </Button>
                        )
                    }
                    if (row.status === 'PAID') {
                        return (
                            <Button size="sm" variant="outline" onClick={() => onViewInst(row)} title="Ver detalle">
                                <Eye className="h-3.5 w-3.5" />
                            </Button>
                        )
                    }
                    return null
                }}
            >
                <Collection.View
                    table={loanInstallmentViews.table}
                    emptyTitle="Tabla aún no generada"
                    emptyDescription="Desembolsa el crédito para crearla."
                />
            </Collection.Root>
            </div>
        </div>
    )
}

export function LoanViewDrawer({ loanId, open, onOpenChange, onDisburse }: Props) {
    const { data: loan, isLoading, isError } = useLoan(loanId)

    const [payingInst, setPayingInst] = useState<LoanInstallmentRow | null>(null)
    const [viewingInst, setViewingInst] = useState<LoanInstallmentRow | null>(null)
    const [showPrepayModal, setShowPrepayModal] = useState(false)
    const [showFeeDetail, setShowFeeDetail] = useState(false)

    const nextInstallment = useMemo(
        () => loan?.installments.find(i => i.status === 'PENDING' || i.status === 'OVERDUE') ?? null,
        [loan],
    )

    const context: DocumentField[] = loan ? [
        { label: 'Banco Acreedor', value: loan.lender_name },
        { label: 'Estado', value: <StatusBadge status={loan.status} variant="badge" /> },
        {
            label: 'Capital',
            value: <DataCell.Currency value={parseFloat(loan.principal)} size="xs" className={SHEET_LEFT} />,
        },
        { label: 'N° de Operación', value: loan.loan_number || '—' },
    ] : []

    const sections = loan ? [
        {
            title: 'Condiciones',
            icon: Banknote,
            content: (
                <FieldGrid rows={[
                    ['Moneda', loan.currency === 'CLP' ? 'Pesos Chilenos (CLP)' : 'Unidad de Fomento (UF)'],
                    ['Tasa de Interés', `${parseFloat(loan.interest_rate).toFixed(2)}%`],
                    ['Base de Tasa', loan.rate_basis_display],
                    ['Sistema de Amortización', loan.amortization_system_display],
                    ['Plazo', `${loan.term_months} meses`],
                    ['Seguro Mensual', formatLoanMoney(loan.insurance_monthly, loan.currency)],
                ]} />
            ),
        },
        {
            title: 'Cargos y Fechas',
            icon: Calendar,
            content: (
                <FieldGrid rows={[
                    ['Comisión de Apertura', formatLoanMoney(loan.opening_fee, loan.currency)],
                    ['Impuesto de Timbres', formatLoanMoney(loan.stamp_tax, loan.currency)],
                    ['Tasa de Mora', `${parseFloat(loan.penalty_rate).toFixed(2)}% mensual`],
                    ['Fecha de Inicio', loan.start_date ? parseDateOnly(loan.start_date).toLocaleDateString('es-CL') : '—'],
                    ['Primer Vencimiento', loan.first_due_date ? parseDateOnly(loan.first_due_date).toLocaleDateString('es-CL') : '—'],
                    ['Próximo Vencimiento', loan.next_due_date ? parseDateOnly(loan.next_due_date).toLocaleDateString('es-CL') : '—'],
                ]} />
            ),
        },
        {
            title: 'Cuentas',
            icon: Building2,
            content: (
                <FieldGrid rows={[
                    ['Cuenta de Desembolso', `${loan.disbursement_account_name} (${loan.disbursement_account})`],
                    ['Cuenta Contable de Pasivo', `${loan.liability_account_name} (${loan.liability_account})`],
                ]} />
            ),
        },
        ...(loan.notes || loan.collateral_notes ? [{
            title: 'Notas',
            icon: FileText,
            content: (
                <div className="space-y-2 text-sm text-muted-foreground">
                    {loan.notes && <p>{loan.notes}</p>}
                    {loan.collateral_notes && (
                        <div>
                            <span className="text-xs font-medium text-foreground">Garantías: </span>
                            {loan.collateral_notes}
                        </div>
                    )}
                </div>
            ),
        }] : []),
    ] : []

    const extraTabs = loan?.status !== 'DRAFT' ? [{
        value: 'amortization',
        label: 'Amortización',
        icon: Calendar,
        content: loan ? (
            <AmortizationTab
                loan={loan}
                onPayInst={setPayingInst}
                onViewInst={setViewingInst}
                onShowFeeDetail={() => setShowFeeDetail(true)}
            />
        ) : null,
    }] : []

    const primaryAction: DocumentActionItem | null = loan?.status === 'ACTIVE' && nextInstallment
        ? {
            id: 'pay-next',
            label: `Pagar cuota #${nextInstallment.number}`,
            icon: CreditCard,
            onClick: () => setPayingInst(nextInstallment as LoanInstallmentRow),
        }
        : null

    const actions: DocumentActionItem[] = []
    if (loan) {
        if (loan.status === 'ACTIVE') {
            actions.push({
                id: 'prepay',
                label: 'Prepago total',
                icon: Banknote,
                onClick: () => setShowPrepayModal(true),
            })
        }
        if (loan.status === 'DRAFT' && onDisburse) {
            actions.push({
                id: 'disburse',
                label: 'Desembolsar',
                icon: FileText,
                onClick: () => onDisburse(loan),
            })
        }
    }

    return (
        <>
            <DocumentSheet
                label="treasury.bankloan"
                open={open}
                onOpenChange={onOpenChange}
                document={loan ?? null}
                isLoading={isLoading}
                error={isError ? new Error('No se pudo cargar el crédito.') : undefined}
                loadingLabel="Cargando crédito"
                context={context}
                sections={sections}
                lifecycle={loan ? getLoanLifecycle(loan) : undefined}
                primaryAction={primaryAction}
                actions={actions}
                extraTabs={extraTabs}
                auditType="bank_loan"
            />

            {payingInst && loan && (
                <LoanPayInstallmentModal
                    key={payingInst.id}
                    installment={payingInst as LoanInstallment}
                    loanCurrency={loan.currency}
                    penaltyRate={loan.penalty_rate}
                    open
                    onOpenChange={(o) => { if (!o) setPayingInst(null) }}
                />
            )}

            {viewingInst && loan && (
                <LoanInstallmentReadonlyModal
                    key={`view-${viewingInst.id}`}
                    installment={viewingInst as LoanInstallment}
                    loanDisplayId={loan.display_id}
                    loanCurrency={loan.currency}
                    open
                    onOpenChange={(o) => { if (!o) setViewingInst(null) }}
                />
            )}

            {showPrepayModal && loan && (
                <PrepayLoanModal
                    loan={loan}
                    open
                    onOpenChange={(o) => { if (!o) setShowPrepayModal(false) }}
                />
            )}

            {showFeeDetail && loan && (
                <BaseModal
                    open
                    onOpenChange={(o) => { if (!o) setShowFeeDetail(false) }}
                    title="Detalle de Cargos Iniciales"
                >
                    <div className="space-y-4 p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Capital del crédito</span>
                            <span className="font-semibold">{formatLoanMoney(loan.principal, loan.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-destructive">
                            <span className="text-sm">Comisión de apertura</span>
                            <span>-{formatLoanMoney(loan.opening_fee, loan.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-destructive">
                            <span className="text-sm">Impuesto de timbres</span>
                            <span>-{formatLoanMoney(loan.stamp_tax, loan.currency)}</span>
                        </div>
                        <hr className="border-border" />
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold">Total desembolsado</span>
                            <span className="font-bold">
                                {formatLoanMoney(
                                    (parseFloat(loan.principal) - parseFloat(loan.opening_fee) - parseFloat(loan.stamp_tax)).toFixed(2),
                                    loan.currency,
                                )}
                            </span>
                        </div>
                    </div>
                </BaseModal>
            )}
        </>
    )
}
