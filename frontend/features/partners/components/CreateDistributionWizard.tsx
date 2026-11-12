"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect, useMemo, useCallback } from "react"
import { LabeledInput, LabeledSelect, PeriodValidationDateInput, GenericWizard, type WizardStep, DataCell, SummarySection, SummaryRow, SummaryNote, SubmitButton, NumpadModal } from "@/components/shared"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { type ProfitDistribution, type ProfitDistributionLine } from "@/features/contacts"
import { useFiscalYears } from "@/features/accounting"
import { useProfitDistributionMutations } from "../hooks"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/money"
import { DistributionImpactStep } from "./DistributionImpactStep"

import {
    PieChart,
    Calculator,
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

    // Numpad state
    const [numpadState, setNumpadState] = useState<{
        lineId: number
        partnerName: string
        destination: string
        destinationLabel: string
        value: string
        availableDifference: number
        totalNet: number
    } | null>(null)

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
        setNumpadState(null)
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

                    <SummarySection>
                        <SummaryNote tone="success">
                            El sistema calculará la participación exacta a la fecha de resolución y descontará automáticamente los retiros provisorios detectados en la contabilidad del ejercicio.
                        </SummaryNote>
                    </SummarySection>
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
                    <SummarySection>
                        <SummaryRow label="Ejercicio" value={String(draftResolution?.fiscal_year ?? "")} />
                        <SummaryRow label="Monto a distribuir" value={<DataCell.Currency value={draftResolution?.net_result || 0} weight="bold" className="w-auto p-0 text-primary" />} strong />
                    </SummarySection>

                    <div className="border rounded-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground tracking-wider border-b">
                                <tr>
                                    <th className="px-4 py-3">Socio</th>
                                    <th className="px-4 py-3 text-right">Participación</th>
                                    <th className="px-4 py-3 text-right">Detalle Base</th>
                                    {draftResolution?.is_profit ? (
                                        <>
                                            <th className="px-3 py-3 w-[170px]">Dividendos ($)</th>
                                            <th className="px-3 py-3 w-[170px]">Reinversión ($)</th>
                                            <th className="px-3 py-3 w-[170px]">Retenido ($)</th>
                                            <th className="px-4 py-3 w-[130px] text-right">Diferencia</th>
                                        </>
                                    ) : (
                                        <th className="px-4 py-3">Absorción (Pérdida)</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {lines.map((line) => {
                                    const net = parseFloat(line.net_amount);
                                    const isCompensated = net <= 0 && draftResolution?.is_profit;
                                    const dests = lineDestinations[line.id] || [];

                                    const getAmount = (type: string) => dests.find(d => d.destination === type)?.amount || 0;

                                    const sumAllocated = dests.reduce((sum, d) => sum + d.amount, 0);
                                    const remaining = Math.abs(net) - sumAllocated;

                                    const openCellNumpad = (destKey: string, destLabel: string) => {
                                        const currentVal = getAmount(destKey);
                                        const otherSum = dests.filter(d => d.destination !== destKey).reduce((acc, d) => acc + d.amount, 0);
                                        const avail = Math.max(0, Math.abs(net) - otherSum);
                                        setNumpadState({
                                            lineId: line.id,
                                            partnerName: line.partner_name,
                                            destination: destKey,
                                            destinationLabel: destLabel,
                                            value: currentVal ? currentVal.toString() : '0',
                                            availableDifference: avail,
                                            totalNet: Math.abs(net),
                                        });
                                    };

                                    return (
                                        <tr key={line.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 align-middle">
                                                <span className="font-semibold text-foreground text-sm">{line.partner_name}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right align-middle">
                                                <span className="font-medium text-sm tabular-nums text-muted-foreground">{line.percentage_at_date}%</span>
                                            </td>
                                            <td className="px-4 py-3 text-right align-middle">
                                                <div className="flex flex-col text-xs items-end gap-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                        Bruto: <span className="font-mono">{formatCurrency(parseFloat(line.gross_amount))}</span>
                                                    </span>
                                                    {parseFloat(line.provisional_withdrawals_offset) > 0 && (
                                                        <span className="text-warning font-semibold flex items-center gap-1 text-3xs">
                                                            Absorbe retiros provisorios: <span className="font-mono">-{formatCurrency(parseFloat(line.provisional_withdrawals_offset))}</span>
                                                        </span>
                                                    )}
                                                    <span className="font-bold text-primary flex items-center gap-1 text-xs">
                                                        Neto: <span className="font-mono font-bold">{formatCurrency(parseFloat(line.net_amount))}</span>
                                                    </span>
                                                </div>
                                            </td>
                                            {isCompensated ? (
                                                <td colSpan={draftResolution?.is_profit ? 4 : 1} className="px-4 py-3 text-center align-middle">
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Retiros Compensan Totalmente Utilidad Bruta</span>
                                                </td>
                                            ) : draftResolution?.is_profit ? (
                                                <>
                                                    <td className="px-3 py-3 align-middle">
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                className="h-9 text-xs font-mono text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                value={getAmount('DIVIDEND') || ''}
                                                                onChange={(e) => handleAmountChange(line.id, 'DIVIDEND', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary hover:bg-muted"
                                                                title="Abrir teclado numérico"
                                                                onClick={() => openCellNumpad('DIVIDEND', 'Dividendos')}
                                                            >
                                                                <Calculator className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                className="h-9 text-xs font-mono text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                value={getAmount('REINVEST') || ''}
                                                                onChange={(e) => handleAmountChange(line.id, 'REINVEST', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary hover:bg-muted"
                                                                title="Abrir teclado numérico"
                                                                onClick={() => openCellNumpad('REINVEST', 'Reinversión')}
                                                            >
                                                                <Calculator className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                className="h-9 text-xs font-mono text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                value={getAmount('RETAINED') || ''}
                                                                onChange={(e) => handleAmountChange(line.id, 'RETAINED', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary hover:bg-muted"
                                                                title="Abrir teclado numérico"
                                                                onClick={() => openCellNumpad('RETAINED', 'Retenido')}
                                                            >
                                                                <Calculator className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right align-middle">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className={cn(
                                                                "font-mono text-xs font-bold flex items-center justify-end gap-0.5",
                                                                Math.abs(remaining) <= 0.01 ? "text-success" : remaining < 0 ? "text-destructive" : "text-warning"
                                                            )}>
                                                                {remaining > 0 ? '+' : ''}
                                                                {formatCurrency(remaining)}
                                                            </div>
                                                            {remaining > 0.01 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 px-1.5 text-3xs font-medium gap-1 text-primary hover:bg-primary/10 border-primary/30"
                                                                    title="Asignar automáticamente el remanente disponible"
                                                                    onClick={() => handleAssignFirstAvailable(line.id)}
                                                                >
                                                                    <Wand2 className="h-3 w-3" />
                                                                    <span>Auto</span>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <td className="px-4 py-3 text-xs font-medium text-muted-foreground align-middle">
                                                    <div className="flex items-center gap-2">
                                                        <span>Monto Automático a Absorber: </span>
                                                        <span className="font-mono font-bold text-foreground">{formatCurrency(Math.abs(parseFloat(line.net_amount)))}</span>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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
                    <SummarySection title="Resumen de la distribución">
                        <SummaryRow label="Ejercicio" value={String(draftResolution?.fiscal_year ?? "")} />
                        <SummaryRow label="Resultado a distribuir" value={<DataCell.Currency value={draftResolution?.net_result || 0} weight="bold" className="w-auto p-0" />} strong />
                        {offsetTotal > 0 && (
                            <SummaryRow label="Retiros provisorios absorbidos" value={<DataCell.Currency value={offsetTotal} className="w-auto p-0" />} />
                        )}
                        {draftResolution?.is_profit && totals.map(t => (
                            <SummaryRow key={t.key} label={t.label} value={<DataCell.Currency value={t.amount} className="w-auto p-0" />} />
                        ))}
                    </SummarySection>
                    <SummarySection title="Impactos contables automatizados">
                        <SummaryNote tone="success">Cierre de la cuenta «Utilidades del Ejercicio»</SummaryNote>
                        <SummaryNote tone="success">Liquidación contable de retiros provisorios de socios</SummaryNote>
                        <SummaryNote tone="success">Creación de pasivos en «Dividendos por Pagar»</SummaryNote>
                        <SummaryNote tone="success">Aumento de Capital si hubo Reinversión</SummaryNote>
                    </SummarySection>
                </div>
            )
        }
    ], [fiscalYears, formData, lines, lineDestinations, draftResolution, totals, offsetTotal])

    // Tras ejecutar, el éxito es un paso más del mismo wizard (mismo modal, altura y footer).
    const doneStep: WizardStep = {
        id: 'done',
        title: 'Distribución ejecutada',
        isValid: true,
        component: (
            <div className="space-y-8">
                <SummarySection title="Distribución completada">
                    <SummaryRow label="Ejercicio" value={String(draftResolution?.fiscal_year ?? "")} />
                    <SummaryRow label="Resultado distribuido" value={<DataCell.Currency value={draftResolution?.net_result || 0} weight="bold" className="w-auto p-0" />} strong />
                    {draftResolution?.is_profit && totals.filter(t => t.amount > 0).map(t => (
                        <SummaryRow key={t.key} label={t.label} value={<DataCell.Currency value={t.amount} className="w-auto p-0" />} />
                    ))}
                    <SummaryNote tone="success">La contabilidad de la distribución quedó registrada.</SummaryNote>
                </SummarySection>
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

            {numpadState && (
                <NumpadModal
                    open={!!numpadState}
                    onOpenChange={(o) => { if (!o) setNumpadState(null) }}
                    value={numpadState.value}
                    onChange={(val) => setNumpadState(prev => prev ? ({ ...prev, value: val }) : null)}
                    onConfirm={() => {
                        if (numpadState) {
                            handleAmountChange(numpadState.lineId, numpadState.destination, numpadState.value);
                            setNumpadState(null);
                        }
                    }}
                    title={`Asignar ${numpadState.destinationLabel}`}
                    description={`${numpadState.partnerName} · Neto a distribuir: ${formatCurrency(numpadState.totalNet)}`}
                    netValue={numpadState.totalNet}
                    onExactAmount={() => {
                        setNumpadState(prev => prev ? ({ ...prev, value: prev.availableDifference.toString() }) : null);
                    }}
                    exactAmountLabel={`ASIGNAR DISPONIBLE (${formatCurrency(numpadState.availableDifference)})`}
                />
            )}
        </>
    )
}
