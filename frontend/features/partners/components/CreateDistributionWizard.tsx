"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect, useMemo, useCallback } from "react"
import { LabeledInput, LabeledSelect, PeriodValidationDateInput, GenericWizard, type WizardStep, DataCell, SubmitButton, Section } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { type ProfitDistribution, type ProfitDistributionLine } from "@/features/contacts"
import { useFiscalYears } from "@/features/accounting"
import { useProfitDistributionMutations } from "../hooks"
import { toast } from "sonner"
import { DistributionImpactStep } from "./DistributionImpactStep"
import { Collection, EditableCollection, useEntityCollection, type EditableRowValue } from "@/components/entity-view"
import { distributionAllocationEditable, distributionLineToRow, distributionLossViews, distributionPartnerEntity, remainingOf } from "../entity-view/distributionPartner.entity"

import {
    PieChart,
    Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    initialResolution?: ProfitDistribution
}

export function CreateDistributionWizard({ open, onOpenChange, onSuccess, initialResolution }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [executed, setExecuted] = useState(false)
    const { fiscalYears: allFiscalYears } = useFiscalYears()
    const fiscalYears = useMemo(() => allFiscalYears.filter(fy => fy.status === 'CLOSED'), [allFiscalYears])
    const { create, update, recalculate, updateLines, approve, execute } = useProfitDistributionMutations()

    // Step 1 Form
    const [formData, setFormData] = useState({
        fiscal_year_id: "",
        net_result: "",
        resolution_date: new Date().toISOString().split('T')[0],
        acta_number: "",
        notes: ""
    })

    // Draft Resolution State (from backend)
    const [draftResolution, setDraftResolution] = useState<ProfitDistribution | null>(null)
    const [lines, setLines] = useState<ProfitDistributionLine[]>([])

    type DestinationAllocation = {
        destination: string;
        amount: number;
    }
    // Destinations config: line_id -> array of allocations
    const [lineDestinations, setLineDestinations] = useState<Record<number, DestinationAllocation[]>>({})

    const handleAmountChange = useCallback((lineId: number, type: string, val: string | number) => {
        const numVal = typeof val === 'number' ? val : (val === '' ? 0 : parseFloat(val));
        const safeNum = isNaN(numVal) ? 0 : Math.max(0, numVal);
        setLineDestinations(prev => {
            const arr = [...(prev[lineId] || [])];
            const idx = arr.findIndex(d => d.destination === type);
            if (idx >= 0) arr[idx] = { destination: type, amount: safeNum };
            else arr.push({ destination: type, amount: safeNum });
            return { ...prev, [lineId]: arr };
        });
    }, [])

    const handleAssignFirstAvailable = useCallback((lineId: number) => {
        const line = lines.find(l => l.id === lineId);
        if (!line) return;
        const net = Math.abs(parseFloat(line.net_amount));
        const dests = lineDestinations[lineId] || [];
        const sumAllocated = dests.reduce((sum, d) => sum + d.amount, 0);
        const remaining = net - sumAllocated;
        if (remaining <= 0.01) return;

        // Buscar el primer destino con monto 0 o el primero en la lista estándar
        const order = ['DIVIDEND', 'REINVEST', 'RETAINED'];
        const target = order.find(type => {
            const current = dests.find(d => d.destination === type)?.amount || 0;
            return current === 0;
        }) || order[0];

        const currentTargetAmount = dests.find(d => d.destination === target)?.amount || 0;
        handleAmountChange(lineId, target, currentTargetAmount + remaining);
    }, [lines, lineDestinations, handleAmountChange])

    const resetFlow = () => {
        setExecuted(false)
        setDraftResolution(null)
        setLines([])
        setLineDestinations({})
        setFormData({
            fiscal_year_id: "",
            net_result: "",
            resolution_date: new Date().toISOString().split('T')[0],
            acta_number: "",
            notes: ""
        })
    }

    // Preselección del ejercicio desde la URL (?yearId=), una vez por apertura
    const [yearSeeded, setYearSeeded] = useState(false)
    if (!open && yearSeeded) setYearSeeded(false)
    if (open && !initialResolution && !yearSeeded && fiscalYears.length > 0) {
        setYearSeeded(true)
        const yearParam = new URLSearchParams(window.location.search).get('yearId')
        const fy = yearParam ? fiscalYears.find(f => f.year.toString() === yearParam) : undefined
        if (fy && !formData.fiscal_year_id) {
            setFormData(prev => ({
                ...prev,
                fiscal_year_id: fy.id.toString(),
                net_result: fy.net_result?.toString() || ""
            }))
        }
    }

    // Hydrate state if initialResolution is provided
    useEffect(() => {
        if (open && initialResolution) {
            setTimeout(() => {
                setDraftResolution(initialResolution)
                setFormData({
                    fiscal_year_id: initialResolution.fiscal_year_obj?.toString() || "",
                    net_result: initialResolution.net_result.toString(),
                    resolution_date: initialResolution.resolution_date,
                    acta_number: initialResolution.acta_number || "",
                    notes: initialResolution.notes || ""
                })
                setLines(initialResolution.lines || [])

                const dests: Record<number, DestinationAllocation[]> = {}
                initialResolution.lines?.forEach((l) => {
                    dests[l.id] = (l.destinations || []).map(d => ({
                        ...d,
                        amount: parseFloat(d.amount as unknown as string)
                    }))
                    if (initialResolution.is_loss && dests[l.id].length === 0) {
                        dests[l.id] = [{ destination: 'LOSS', amount: Math.abs(parseFloat(l.net_amount)) }]
                    }
                })
                setLineDestinations(dests)
            }, 0)
        } else if (!open) {
            setTimeout(resetFlow, 0)
        }
    }, [open, initialResolution])

    const handleCreateOrUpdateDraft = async () => {
        if (!formData.fiscal_year_id || !formData.net_result || !formData.resolution_date) {
            toast.error("Complete los parámetros obligatorios")
            return false
        }

        const resultAmount = parseFloat(formData.net_result)
        if (isNaN(resultAmount) || resultAmount === 0) {
            toast.error("El resultado del ejercicio no puede ser cero para realizar una distribución.")
            return false
        }

        try {
            const payload = {
                fiscal_year_id: parseInt(formData.fiscal_year_id),
                net_result: parseFloat(formData.net_result),
                resolution_date: formData.resolution_date,
                acta_number: formData.acta_number,
                notes: formData.notes
            }

            let res: ProfitDistribution;
            if (draftResolution?.status === 'DRAFT') {
                await update.mutateAsync({ id: draftResolution.id, data: payload })
                res = await recalculate.mutateAsync(draftResolution.id)
            } else {
                res = await create.mutateAsync(payload)
            }

            setDraftResolution(res)
            setLines(res.lines || [])

            const dests: Record<number, DestinationAllocation[]> = {}
            res.lines?.forEach((l) => {
                dests[l.id] = (l.destinations || []).map(d => ({
                    ...d,
                    amount: parseFloat(d.amount as unknown as string)
                }))
                if (res.is_loss && dests[l.id].length === 0) {
                    dests[l.id] = [{ destination: 'LOSS', amount: Math.abs(parseFloat(l.net_amount)) }]
                }
            })
            setLineDestinations(dests)

            return true
        } catch (error: unknown) {
            showApiError(error, "Error al procesar distribución")
            return false
        }
    }

    const handleUpdateDestinations = async () => {
        let hasError = false
        lines.forEach(l => {
            const net = parseFloat(l.net_amount)
            if (net <= 0 && draftResolution?.is_profit) return;
            const dests = lineDestinations[l.id] || []
            const sum = dests.reduce((acc, d) => acc + d.amount, 0)
            if (Math.abs(sum - Math.abs(net)) > 0.01) {
                hasError = true
            }
        })

        if (hasError) {
            toast.error("Debe asignar la totalidad del monto neto exacto para cada socio.")
            return false
        }

        try {
            const updates = Object.keys(lineDestinations).map(id => ({
                line_id: parseInt(id),
                destinations: lineDestinations[parseInt(id)].filter(d => d.amount > 0)
            }))

            if (draftResolution) {
                await updateLines.mutateAsync({ id: draftResolution.id, lines: updates })
            }
            return true
        } catch (error: unknown) {
            showApiError(error, "Error al actualizar destinos")
            return false
        }
    }

    const handleExecute = async () => {
        setLoading(true)
        try {
            if (draftResolution) {
                if (draftResolution.status === 'DRAFT') {
                    await approve.mutateAsync(draftResolution.id)
                }
                await execute.mutateAsync(draftResolution.id)
            }
            toast.success("Distribución contable ejecutada con éxito")
            setExecuted(true)
        } catch (error: unknown) {
            showApiError(error, "Error al ejecutar la distribución")
        } finally {
            setLoading(false)
        }
    }

    // ── Allocation table (EditableCollection, ADR-0087): one row per partner line ──
    const allocationRows = useMemo(() => lines.map((l) => distributionLineToRow(l)), [lines])
    const allocationValue: EditableRowValue[] = useMemo(() => allocationRows.map((r) => {
        const dests = lineDestinations[r.id] || []
        const amount = (type: string) => dests.find((d) => d.destination === type)?.amount ?? 0
        return { key: String(r.id), values: { dividend: amount("DIVIDEND"), reinvest: amount("REINVEST"), retained: amount("RETAINED") } }
    }), [allocationRows, lineDestinations])
    const handleAllocationChange = useCallback((next: EditableRowValue[]) => {
        setLineDestinations((prev) => {
            const out = { ...prev }
            for (const v of next) {
                const row = allocationRows.find((r) => String(r.id) === v.key)
                // Fully compensated partners keep whatever they had: they have nothing to allocate.
                if (!row || row.net <= 0) continue
                out[row.id] = [
                    { destination: "DIVIDEND", amount: Math.max(0, v.values.dividend ?? 0) },
                    { destination: "REINVEST", amount: Math.max(0, v.values.reinvest ?? 0) },
                    { destination: "RETAINED", amount: Math.max(0, v.values.retained ?? 0) },
                ]
            }
            return out
        })
    }, [allocationRows])
    const lossCollection = useEntityCollection(distributionPartnerEntity, { rows: allocationRows, rowCount: allocationRows.length }, { pagination: { mode: "none" } })

    const totals = useMemo(() => [
        { key: 'DIVIDEND', label: 'Dividendos' },
        { key: 'REINVEST', label: 'Reinversión' },
        { key: 'RETAINED', label: 'Utilidades retenidas' },
    ].map(t => ({
        ...t,
        amount: Object.values(lineDestinations).flat().filter(d => d.destination === t.key).reduce((acc, d) => acc + d.amount, 0),
    })), [lineDestinations])

    const offsetTotal = useMemo(
        () => lines.reduce((acc, l) => acc + (parseFloat(l.provisional_withdrawals_offset) || 0), 0),
        [lines],
    )

    const steps: WizardStep[] = useMemo(() => [
        {
            id: 1,
            title: "Parámetros del Ejercicio",
            isValid: !!formData.fiscal_year_id && !!formData.net_result && !!formData.resolution_date,
            onNext: handleCreateOrUpdateDraft,
            component: (
                <div className="grid gap-6">
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledSelect
                            label="Ejercicio Fiscal Cerrado"
                            value={formData.fiscal_year_id}
                            onChange={(val) => {
                                const fy = fiscalYears.find(f => f.id.toString() === val)
                                setFormData(prev => ({
                                    ...prev,
                                    fiscal_year_id: val,
                                    net_result: fy?.net_result?.toString() || ""
                                }))
                            }}
                            placeholder="Seleccione un año cerrado"
                            className="font-bold"
                            options={fiscalYears.map(fy => ({ value: fy.id.toString(), label: `${fy.year} - Cerrado` }))}
                        />
                        <PeriodValidationDateInput
                            label="Fecha de Resolución"
                            date={formData.resolution_date ? new Date(formData.resolution_date + 'T12:00:00') : undefined}
                            onDateChange={(d) => {
                                if (!d) {
                                    setFormData(prev => ({ ...prev, resolution_date: "" }))
                                    return
                                }
                                setFormData(prev => ({ ...prev, resolution_date: d.toISOString().split('T')[0] }))
                            }}
                            validationType="accounting"
                            className="font-medium"
                        />
                    </div>

                    <div>
                        <div className="relative">
                            <LabeledInput
                                label="Resultado Neto ($)"
                                type="number"
                                placeholder="0"
                                value={formData.net_result}
                                readOnly
                                className="pl-10 bg-muted/50 cursor-not-allowed"
                            />
                            
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <span className={cn(
                                    "text-3xs font-bold uppercase tracking-widest px-2 py-1 rounded-sm",
                                    parseFloat(formData.net_result) >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                                )}>
                                    {parseFloat(formData.net_result) >= 0 ? "Utilidad" : "Pérdida"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <LabeledInput
                            label="Número de Acta"
                            value={formData.acta_number}
                            onChange={(e) => setFormData(prev => ({ ...prev, acta_number: e.target.value }))}
                            placeholder="Ej: Acta N° 42"
                        />
                        <LabeledInput
                            label="Notas Internas"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Distribuir según pacto social"
                        />
                    </div>

                    <Section>
                        <Section.Note tone="success">
                            El sistema calculará la participación exacta a la fecha de resolución y descontará automáticamente los retiros provisorios detectados en la contabilidad del ejercicio.
                        </Section.Note>
                    </Section>
                </div>
            )
        },
        {
            id: 2,
            title: "Asignación y Destino",
            isValid: lines.length > 0 && lines.every(l => {
                const net = parseFloat(l.net_amount);
                if (net <= 0 && draftResolution?.is_profit) return true;
                const dests = lineDestinations[l.id] || [];
                const sum = dests.reduce((acc, d) => acc + d.amount, 0);
                return Math.abs(sum - Math.abs(net)) <= 0.01;
            }),
            onNext: handleUpdateDestinations,
            component: (
                <div className="space-y-4">
                    <Section>
                        <Section.Row variant="stat" title="Ejercicio" value={String(draftResolution?.fiscal_year ?? "")} />
                        <Section.Row variant="stat" title="Monto a distribuir" value={<DataCell.Currency value={draftResolution?.net_result || 0} weight="bold" className="w-auto p-0 text-primary" />} strong />
                    </Section>

                    {draftResolution?.is_profit ? (
                        <EditableCollection
                            definition={distributionAllocationEditable}
                            rows={allocationRows}
                            value={allocationValue}
                            onChange={handleAllocationChange}
                            label="Destino de la utilidad por socio"
                            rowActions={(row) => {
                                const v = allocationValue.find((a) => a.key === String(row.id))?.values
                                const remaining = remainingOf(row, { dividend: v?.dividend ?? 0, reinvest: v?.reinvest ?? 0, retained: v?.retained ?? 0 })
                                if (row.net <= 0 || remaining <= 0.01) return null
                                return (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 text-primary"
                                        aria-label={`Asignar remanente — ${row.partnerName}`}
                                        onClick={() => handleAssignFirstAvailable(row.id)}
                                    >
                                        <Wand2 className="h-3.5 w-3.5" aria-hidden />
                                        Asignar remanente
                                    </Button>
                                )
                            }}
                        />
                    ) : (
                        <Collection.Root collection={lossCollection} label="Absorción de la pérdida por socio">
                            <Collection.View table={distributionLossViews.table} />
                        </Collection.Root>
                    )}
                </div>
            )
        },
        {
            id: 3,
            title: "Impactos de la Distribución",
            isValid: !!draftResolution,
            component: draftResolution ? <DistributionImpactStep resolutionId={draftResolution.id} /> : null,
        },
        {
            id: 4,
            title: "Confirmación y Ejecución",
            isValid: true,
            component: (
                <div className="space-y-8">
                    <Section title="Resumen de la distribución">
                        <Section.Row variant="stat" title="Ejercicio" value={String(draftResolution?.fiscal_year ?? "")} />
                        <Section.Row variant="stat" title="Resultado a distribuir" value={<DataCell.Currency value={draftResolution?.net_result || 0} weight="bold" className="w-auto p-0" />} strong />
                        {offsetTotal > 0 && (
                            <Section.Row variant="stat" title="Retiros provisorios absorbidos" value={<DataCell.Currency value={offsetTotal} className="w-auto p-0" />} />
                        )}
                        {draftResolution?.is_profit && totals.map(t => (
                            <Section.Row variant="stat" key={t.key} title={t.label} value={<DataCell.Currency value={t.amount} className="w-auto p-0" />} />
                        ))}
                    </Section>
                    <Section title="Impactos contables automatizados">
                        <Section.Note tone="success">Cierre de la cuenta «Utilidades del Ejercicio»</Section.Note>
                        <Section.Note tone="success">Liquidación contable de retiros provisorios de socios</Section.Note>
                        <Section.Note tone="success">Creación de pasivos en «Dividendos por Pagar»</Section.Note>
                        <Section.Note tone="success">Aumento de Capital si hubo Reinversión</Section.Note>
                    </Section>
                </div>
            )
        }
    ], [fiscalYears, formData, lines, lineDestinations, draftResolution, totals, offsetTotal, allocationRows, allocationValue, handleAllocationChange, handleAssignFirstAvailable, lossCollection])

    // Tras ejecutar, el éxito es un paso más del mismo wizard (mismo modal, altura y footer).
    const doneStep: WizardStep = {
        id: 'done',
        title: 'Distribución ejecutada',
        isValid: true,
        component: (
            <div className="space-y-8">
                <Section title="Distribución completada">
                    <Section.Row variant="stat" title="Ejercicio" value={String(draftResolution?.fiscal_year ?? "")} />
                    <Section.Row variant="stat" title="Resultado distribuido" value={<DataCell.Currency value={draftResolution?.net_result || 0} weight="bold" className="w-auto p-0" />} strong />
                    {draftResolution?.is_profit && totals.filter(t => t.amount > 0).map(t => (
                        <Section.Row variant="stat" key={t.key} title={t.label} value={<DataCell.Currency value={t.amount} className="w-auto p-0" />} />
                    ))}
                    <Section.Note tone="success">La contabilidad de la distribución quedó registrada.</Section.Note>
                </Section>
            </div>
        ),
    }

    const finish = () => {
        onSuccess?.()
        onOpenChange(false)
        resetFlow()
    }

    return (
        <>
            <GenericWizard
                open={open}
                onOpenChange={onOpenChange}
                onClose={() => {
                    onOpenChange(false)
                    resetFlow()
                }}
                title={
                    <div className="flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-primary" />
                        <span>Distribución de Utilidades</span>
                    </div>
                }
                steps={executed ? [doneStep] : steps}
                subtitle={executed ? 'Ejecución completada' : undefined}
                footer={executed ? (
                    <div className="flex w-full justify-end">
                        <SubmitButton type="button" onClick={finish}>Finalizar</SubmitButton>
                    </div>
                ) : undefined}
                onComplete={handleExecute}
                isCompleting={loading}
                completeButtonLabel="Ejecutar Contabilidad"
                size="xl"
                stableHeight
                cardSurface
                initialStep={initialResolution?.status === 'DRAFT' ? 1 : 0}
            />

        </>
    )
}
