"use client"

import { showApiError } from "@/lib/errors"
import { shouldKeepIdempotencyKey } from "@/lib/idempotency"
import { generateUuidV4 } from "@/lib/uuid"
import React, { useState, useEffect, useMemo, useRef } from "react"
import { useTreasuryAccounts } from "@/features/settings"
import { LabeledSelect, GenericWizard, type WizardStep, DataCell, SubmitButton, Section } from "@/components/shared"
import { EditableCollection, editableSchema, toEditableErrors, type EditableRowValue } from "@/components/entity-view"
import { massPaymentEditable } from "../entity-view/partnerPayout.entity"
import { useProfitDistributionMutations } from "../hooks"
import { toast } from "sonner"

import { Wallet } from "lucide-react"
import { type ProfitDistribution, type ProfitDistributionLine } from "@/features/contacts"

interface MassPaymentWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    resolution: ProfitDistribution
    onSuccess?: () => void
}

export function MassPaymentWizard({ open, onOpenChange, resolution, onSuccess }: MassPaymentWizardProps) {
    const [loading, setLoading] = useState(false)
    const [paid, setPaid] = useState<{ total: number; count: number } | null>(null)
    const { massPayment } = useProfitDistributionMutations()
    const [selectedAccountId, setSelectedAccountId] = useState<string>("")
    const [payments, setPayments] = useState<Record<number, number>>({})
    const idempotencyKeyRef = useRef<string>(generateUuidV4())

    const pendingLines = useMemo(() => {
        if (!resolution?.lines) return [];
        return resolution.lines.map((l: ProfitDistributionLine) => {
            const divAlloc = l.destinations?.find(d => d.destination === 'DIVIDEND');
            const totalAllocated = divAlloc ? parseFloat(divAlloc.amount) : 0;
            const paid = parseFloat(l.paid_dividend_amount || "0");
            return {
                ...l,
                pendingAmount: Math.max(0, totalAllocated - paid),
                totalAllocated,
                paid
            }
        }).filter(l => l.pendingAmount > 0)
    }, [resolution])

    const { data: treasuryAccounts = [] } = useTreasuryAccounts(open)

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                setSelectedAccountId("")
                setPaid(null)
                const initialPayments: Record<number, number> = {}
                pendingLines.forEach(l => {
                    initialPayments[l.partner] = l.pendingAmount
                })
                setPayments(initialPayments)
            })
        }
    }, [open, pendingLines])

    const handleExecutePayment = async () => {
        setLoading(true)
        try {
            const paymentsData = Object.keys(payments).map(pId => ({
                partner_id: parseInt(pId),
                amount: payments[parseInt(pId)]
            })).filter(p => p.amount > 0)

            await massPayment.mutateAsync({
                id: resolution.id,
                treasuryAccountId: parseInt(selectedAccountId),
                payments: paymentsData,
                idempotencyKey: idempotencyKeyRef.current,
            })
            idempotencyKeyRef.current = generateUuidV4()
            toast.success("Pagos procesados correctamente.")
            setPaid({
                total: paymentsData.reduce((sum, p) => sum + p.amount, 0),
                count: paymentsData.length,
            })
        } catch (error: unknown) {
            if (!shouldKeepIdempotencyKey(error)) idempotencyKeyRef.current = generateUuidV4()
            showApiError(error, "Error al procesar pagos")
        } finally {
            setLoading(false)
        }
    }

    const { paymentValue, paymentErrors } = useMemo(() => {
        const value: EditableRowValue[] = pendingLines.map((l) => ({ key: String(l.partner), values: { amount: payments[l.partner] ?? 0 } }))
        const parsed = editableSchema(massPaymentEditable, pendingLines).safeParse(value)
        return { paymentValue: value, paymentErrors: parsed.success ? {} : toEditableErrors(parsed.error, value) }
    }, [pendingLines, payments])

    const steps: WizardStep[] = useMemo(() => {
        const totalToPay = Object.values(payments).reduce((sum, val) => sum + val, 0)
        const partnersCount = Object.values(payments).filter(val => val > 0).length

        return [
            {
                id: 1,
                title: "Beneficiarios y Montos",
                isValid: totalToPay > 0 && pendingLines.every(l => (payments[l.partner] || 0) <= l.pendingAmount),
                component: (
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-3xs font-bold uppercase text-muted-foreground tracking-widest">Suma a Pagar</p>
                                <DataCell.Currency value={totalToPay} weight="bold" className="justify-start text-2xl text-success-text mt-1" />
                            </div>
                        </div>

                        <EditableCollection
                            definition={massPaymentEditable}
                            rows={pendingLines}
                            value={paymentValue}
                            onChange={(next) => setPayments(Object.fromEntries(next.map((v) => [Number(v.key), v.values.amount ?? 0])))}
                            errors={paymentErrors}
                            label="Montos a pagar por socio"
                            emptyText="No hay dividendos pendientes de pago"
                        />
                    </div>
                )
            },
            {
                id: 2,
                title: "Cuenta de Origen y Confirmación",
                isValid: !!selectedAccountId,
                component: (
                    <div className="space-y-8">
                        <div>
                            <LabeledSelect
                                label="Cuenta de Tesorería (Salida de Dinero)"
                                value={selectedAccountId}
                                onChange={setSelectedAccountId}
                                placeholder="Seleccione banco o caja"
                                options={treasuryAccounts.map(a => ({ value: a.id.toString(), label: `${a.name} (${a.identifier})` }))}
                            />
                            <p className="text-3xs text-muted-foreground mt-1 pl-1 font-medium">
                                Cuenta de donde se extraerán los fondos para liquidar los dividendos seleccionados.
                            </p>
                        </div>
                        <Section title="Resumen del pago">
                            <Section.Row variant="stat" title="Socios a pagar" value={String(partnersCount)} />
                            <Section.Row variant="stat" title="Total neto a desembolsar" value={<DataCell.Currency value={totalToPay} weight="bold" className="w-auto p-0" />} strong />
                        </Section>
                        <Section title="Impactos contables">
                            <Section.Note tone="success">Salida del dinero de la cuenta de tesorería seleccionada</Section.Note>
                            <Section.Note tone="success">Disminución de «Dividendos por Pagar» con {partnersCount} {partnersCount === 1 ? "socio" : "socios"}</Section.Note>
                        </Section>
                    </div>
                )
            },
        ]
    }, [payments, pendingLines, selectedAccountId, treasuryAccounts, paymentValue, paymentErrors])

    if (!resolution) return null

    // Tras pagar, el éxito es un paso más del mismo wizard (mismo modal, altura y footer).
    const doneStep: WizardStep = {
        id: 'done',
        title: 'Pagos procesados',
        isValid: true,
        component: (
            <Section title="Pago completado">
                <Section.Row variant="stat" title="Socios pagados" value={String(paid?.count ?? 0)} />
                <Section.Row variant="stat" title="Total desembolsado" value={<DataCell.Currency value={paid?.total ?? 0} weight="bold" className="w-auto p-0" />} strong />
                <Section.Note tone="success">Los pagos quedaron registrados en la tesorería y en la contabilidad.</Section.Note>
            </Section>
        ),
    }

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            onClose={() => onOpenChange(false)}
            title={
                <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-success" />
                    <span>Pagos de Dividendos</span>
                </div>
            }
            steps={paid ? [doneStep] : steps}
            subtitle={paid ? 'Pago completado' : undefined}
            footer={paid ? (
                <div className="flex w-full justify-end">
                    <SubmitButton type="button" onClick={() => { onSuccess?.(); onOpenChange(false) }}>Finalizar</SubmitButton>
                </div>
            ) : undefined}
            onComplete={handleExecutePayment}
            isCompleting={loading}
            completeButtonLabel="Firmar y Transferir"
            size="xl"
            stableHeight
            cardSurface
            initialStep={0}
        />
    )
}
