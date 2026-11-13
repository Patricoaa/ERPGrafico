"use client"

import { showApiError } from "@/lib/errors"
import { shouldKeepIdempotencyKey } from "@/lib/idempotency"
import { generateUuidV4 } from "@/lib/uuid"
import React, { useState, useEffect, useMemo, useRef } from "react"
import { useTreasuryAccounts } from "@/features/settings"
import { LabeledSelect, GenericWizard, type WizardStep, DataCell, SubmitButton, Section } from "@/components/shared"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
                                <DataCell.Currency value={totalToPay} weight="bold" className="justify-start text-2xl text-success mt-1" />
                            </div>
                            <div className="flex gap-4">
                                <Button
                                    variant="link"
                                    onClick={() => {
                                        const next: Record<number, number> = {}
                                        pendingLines.forEach(l => next[l.partner] = l.pendingAmount)
                                        setPayments(next)
                                    }}
                                    className="text-3xs font-medium text-primary p-0 h-auto"
                                >
                                    Pagar Totalidad
                                </Button>
                                <Button
                                    variant="link"
                                    onClick={() => setPayments({})}
                                    className="text-3xs font-medium text-muted-foreground p-0 h-auto"
                                >
                                    Limpiar Todo
                                </Button>
                            </div>
                        </div>

                        <div className="border rounded-sm overflow-x-auto">
                            <table className="w-full text-2xs text-left">
                                <thead className="bg-muted text-3xs font-bold uppercase text-muted-foreground tracking-wider border-b sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-3">Socio</th>
                                        <th className="px-3 py-3 text-right">Pendiente ($)</th>
                                        <th className="px-3 py-3 w-[160px] text-right">A Pagar ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y relative z-0">
                                    {pendingLines.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground text-2xs font-bold">
                                                No hay dividendos pendientes de pago
                                            </td>
                                        </tr>
                                    )}
                                    {pendingLines.map((line) => {
                                        const currentVal = payments[line.partner] || 0
                                        const isOver = currentVal > line.pendingAmount
                                        return (
                                            <tr key={line.id} className="hover:bg-muted/30">
                                                <td className="px-3 py-2">
                                                    <DataCell.Text className="justify-start text-left font-black">{line.partner_name}</DataCell.Text>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <DataCell.Currency value={line.pendingAmount} className="justify-end" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="number"
                                                        className={`h-8 text-2xs font-mono text-right ${isOver ? 'border-destructive text-destructive focus-visible:ring-destructive' : ''}`}
                                                        value={payments[line.partner] !== undefined ? payments[line.partner] : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                                            setPayments(p => ({ ...p, [line.partner]: val }))
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
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
    }, [payments, pendingLines, selectedAccountId, treasuryAccounts])

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
