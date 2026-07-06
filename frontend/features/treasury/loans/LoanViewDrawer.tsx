"use client"

import React from 'react'
import { AlertCircle, Banknote } from 'lucide-react'
import {
    Drawer, EmptyState, FormSection, SkeletonShell,
} from '@/components/shared'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLoan } from './hooks'
import { parseDateOnly } from '@/lib/utils'
import { formDrawerWidth } from '@/lib/form-widths'
import { useDrawerIdentity } from '@/features/_shared/drawer'

interface Props {
    loanId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <div className="text-sm font-medium">{value}</div>
        </div>
    )
}

export function LoanViewDrawer({ loanId, open, onOpenChange }: Props) {
    const { data: loan, isLoading, isError } = useLoan(loanId)

    const identity = useDrawerIdentity('treasury.bankloan', 'view', loan, {
        customTitle: loan ? `${loan.display_id} · ${loan.lender_name}` : 'Cargando crédito…',
        subtitle: loan ? `${loan.status_display} · ${loan.currency}` : undefined,
    })

    return (
        <Drawer
            mode="view"
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("complex", false)}
            resizable
            icon={identity.icon}
            title={identity.title}
            subtitle={identity.subtitle}
        >
            {isError ? (
                <div className="p-4">
                    <EmptyState
                        title="Error al cargar crédito"
                        description="No se pudo cargar la información del crédito."
                        icon={AlertCircle}
                    />
                </div>
            ) : (
            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando crédito">
                {loan ? (
                    <div className="space-y-5 px-4 pb-4 pt-4">
                        <FormSection title="Entidad" icon={Banknote} />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Banco Acreedor" value={loan.lender_name} />
                            <Field label="N° de Operación" value={loan.loan_number || '—'} />
                        </div>

                        <FormSection title="Condiciones" icon={Banknote} />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Moneda" value={loan.currency === 'CLP' ? 'Pesos Chilenos (CLP)' : 'Unidad de Fomento (UF)'} />
                            <Field label="Capital" value={formatMoney(loan.principal, loan.currency)} />
                            <Field label="Tasa de Interés" value={`${parseFloat(loan.interest_rate).toFixed(2)}%`} />
                            <Field label="Base de Tasa" value={loan.rate_basis === 'MONTHLY' ? 'Mensual' : 'Anual'} />
                            <Field label="Sistema de Amortización" value={loan.amortization_system === 'FRENCH' ? 'Francés (cuota fija)' : 'Lineal (capital fijo)'} />
                            <Field label="Plazo" value={`${loan.term_months} meses`} />
                            <Field label="Seguro Mensual" value={formatMoney(loan.insurance_monthly, loan.currency)} />
                        </div>

                        <FormSection title="Cargos del Contrato" icon={Banknote} />
                        <div className="grid grid-cols-3 gap-4">
                            <Field label="Comisión de Apertura" value={formatMoney(loan.opening_fee, loan.currency)} />
                            <Field label="Impuesto de Timbres" value={formatMoney(loan.stamp_tax, loan.currency)} />
                            <Field label="Tasa de Mora" value={`${parseFloat(loan.penalty_rate).toFixed(2)}% mensual`} />
                        </div>

                        <FormSection title="Fechas" icon={Banknote} />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Fecha de Inicio" value={loan.start_date ? parseDateOnly(loan.start_date).toLocaleDateString('es-CL') : '—'} />
                            <Field label="Primer Vencimiento" value={loan.first_due_date ? parseDateOnly(loan.first_due_date).toLocaleDateString('es-CL') : '—'} />
                        </div>

                        <FormSection title="Cuentas" icon={Banknote} />
                        <div className="space-y-4">
                            <Field label="Cuenta de Desembolso" value={`${loan.disbursement_account_name} (${loan.disbursement_account})`} />
                            <Field label="Cuenta Contable de Pasivo" value={`${loan.liability_account_name} (${loan.liability_account})`} />
                        </div>

                        {loan.notes && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Notas</Label>
                                <Textarea
                                    readOnly
                                    value={loan.notes}
                                    className="bg-muted/30 text-sm min-h-[60px]"
                                />
                            </div>
                        )}
                    </div>
                ) : null}
            </SkeletonShell>
            )}
        </Drawer>
    )
}

function formatMoney(value: string, currency: string) {
    const n = parseFloat(value || '0')
    if (currency === 'UF') {
        return `${n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`
    }
    return new Intl.NumberFormat('es-CL', {
        style: 'currency', currency: 'CLP',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n)
}
