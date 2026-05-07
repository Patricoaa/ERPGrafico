"use client"

import { useEffect, useCallback } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Info, Brain, Settings2, Calendar, Hash, User, CircleDollarSign, Loader2, Wand2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useReconciliationSettingsQuery } from "../hooks/useReconciliationQueries"
import { useUpdateReconciliationSettingsMutation } from "../hooks/useReconciliationMutations"
import { AutoSaveStatusBadge } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { cn } from "@/lib/utils"

const intelligenceSchema = z.object({
    amount_weight: z.number().min(0).max(100),
    date_weight: z.number().min(0).max(100),
    reference_weight: z.number().min(0).max(100),
    contact_weight: z.number().min(0).max(100),
    confidence_threshold: z.number().min(0).max(100),
    date_range_days: z.number().min(1).max(365),
    auto_confirm: z.boolean(),
})

type IntelligenceFormValues = z.infer<typeof intelligenceSchema>

const DEFAULT_VALUES: IntelligenceFormValues = {
    amount_weight: 40,
    date_weight: 30,
    reference_weight: 20,
    contact_weight: 10,
    confidence_threshold: 85,
    date_range_days: 30,
    auto_confirm: false,
}

const FieldLabel = ({ title, tooltip }: { title: string; tooltip: string }) => (
    <div className="flex items-center gap-1.5">
        <span className="shrink-0">{title}</span>
        <Tooltip>
            <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help hover:text-primary transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-relaxed">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    </div>
)

const WeightControl = ({ icon: Icon, label, value, tooltip, onChange }: { icon: React.ElementType; label: string; value: number; tooltip: string; onChange: (v: number) => void }) => (
    <div className="space-y-3">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-sm bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <FieldLabel title={label} tooltip={tooltip} />
            </div>
            <span className="text-sm font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">{value}%</span>
        </div>
        <input
            type="range" min="0" max="100" step="5"
            value={value}
            onChange={e => onChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-sm appearance-none cursor-pointer accent-primary"
        />
    </div>
)

const ThresholdControl = ({ label, value, suffix, tooltip, onChange, min = 0, max = 100 }: { label: string; value: number; suffix: string; tooltip: string; onChange: (v: number) => void; min?: number; max?: number }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <FieldLabel title={label} tooltip={tooltip} />
            <span className="text-xs font-bold text-primary">{value}{suffix}</span>
        </div>
        <input
            type="range" min={min} max={max} step={max > 50 ? 5 : 1}
            value={value}
            onChange={e => onChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-sm appearance-none cursor-pointer accent-primary"
        />
    </div>
)

export function ReconciliationIntelligence({ externalOpen }: { externalOpen?: boolean }) {
    const { data: settings, isLoading: isLoadingSettings, isFetching: isFetchingSettings } = useReconciliationSettingsQuery("global")
    const updateMutation = useUpdateReconciliationSettingsMutation("global")

    const form = useForm<IntelligenceFormValues>({
        resolver: zodResolver(intelligenceSchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        if (settings) {
            form.reset({
                amount_weight: settings.amount_weight ?? DEFAULT_VALUES.amount_weight,
                date_weight: settings.date_weight ?? DEFAULT_VALUES.date_weight,
                reference_weight: settings.reference_weight ?? DEFAULT_VALUES.reference_weight,
                contact_weight: settings.contact_weight ?? DEFAULT_VALUES.contact_weight,
                confidence_threshold: settings.confidence_threshold ?? DEFAULT_VALUES.confidence_threshold,
                date_range_days: settings.date_range_days ?? DEFAULT_VALUES.date_range_days,
                auto_confirm: settings.auto_confirm ?? DEFAULT_VALUES.auto_confirm,
            })
        }
    }, [settings, form])

    const onSave = useCallback(async (data: IntelligenceFormValues) => {
        await updateMutation.mutateAsync({ ...data, id: settings!.id })
    }, [updateMutation, settings?.id])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: !isLoadingSettings && !!settings,
        validate: (v) => {
            const total = v.amount_weight + v.date_weight + v.reference_weight + v.contact_weight
            return total === 100 || `Los pesos deben sumar 100 % — actualmente suman ${total} %`
        },
    })

    useUnsavedChangesGuard(status)

    // reactive totalWeight for inline badge (independent of autosave status)
    const [aw, dw, rw, cw] = form.watch(["amount_weight", "date_weight", "reference_weight", "contact_weight"])
    const totalWeight = aw + dw + rw + cw

    return (
        <TooltipProvider>
            <div className="space-y-4 max-w-2xl mx-auto py-2">
                {(isLoadingSettings || isFetchingSettings) && !settings ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : settings && (
                    <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-end">
                            <AutoSaveStatusBadge
                                status={status}
                                invalidReason={invalidReason}
                                lastSavedAt={lastSavedAt}
                                onRetry={retry}
                            />
                        </div>

                        {/* Weight Config */}
                        <Card className="p-4 border-primary/10 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                                <Brain className="h-20 w-20" />
                            </div>

                            <div className="flex justify-between items-center mb-6">
                                <div className="space-y-0.5">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <Brain className="h-4 w-4 text-primary" />
                                        Pesos de Matching
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground">Importancia de cada dato para el score.</p>
                                </div>
                                <Badge
                                    variant={totalWeight === 100 ? "success" : "warning"}
                                    className={cn(
                                        "font-mono text-[10px] px-2 py-0.5",
                                        totalWeight !== 100 && "animate-pulse"
                                    )}
                                >
                                    {totalWeight}% / 100%
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 gap-y-6">
                                <Controller control={form.control} name="amount_weight" render={({ field }) => (
                                    <WeightControl icon={CircleDollarSign} label="Monto Exacto" value={field.value}
                                        tooltip="Prioridad alta si esperas que el banco y el sistema registren siempre el mismo monto."
                                        onChange={field.onChange} />
                                )} />
                                <Controller control={form.control} name="date_weight" render={({ field }) => (
                                    <WeightControl icon={Calendar} label="Cercanía de Fecha" value={field.value}
                                        tooltip="Importante si hay desfase entre el pago y el registro bancario (ej: depósitos)."
                                        onChange={field.onChange} />
                                )} />
                                <Controller control={form.control} name="reference_weight" render={({ field }) => (
                                    <WeightControl icon={Hash} label="Referencia / Operación" value={field.value}
                                        tooltip="ID de transferencia, número de cheque o código de operación único."
                                        onChange={field.onChange} />
                                )} />
                                <Controller control={form.control} name="contact_weight" render={({ field }) => (
                                    <WeightControl icon={User} label="Coincidencia de Contacto" value={field.value}
                                        tooltip="Busca el nombre del cliente/proveedor dentro de la glosa descriptiva del banco."
                                        onChange={field.onChange} />
                                )} />
                            </div>
                        </Card>

                        {/* Logic Config */}
                        <div className="grid grid-cols-1 gap-6">
                            <Card className="p-4 space-y-4">
                                <div className="flex items-center gap-2 border-b pb-3">
                                    <Settings2 className="h-3.5 w-3.5 text-primary" />
                                    <h4 className="text-xs font-bold uppercase tracking-wider">Parámetros</h4>
                                </div>

                                <Controller control={form.control} name="confidence_threshold" render={({ field }) => (
                                    <ThresholdControl label="Umbral de Confianza" value={field.value} suffix="%"
                                        tooltip="Score mínimo para que el sistema sugiera un match en el workbench."
                                        onChange={field.onChange} />
                                )} />

                                <Controller control={form.control} name="date_range_days" render={({ field }) => (
                                    <ThresholdControl label="Rango de Búsqueda" value={field.value} suffix=" días"
                                        min={1} max={365}
                                        tooltip="Días hacia atrás y adelante para buscar candidatos desde la fecha de la línea."
                                        onChange={field.onChange} />
                                )} />
                            </Card>

                            <Card className="p-4 flex flex-col justify-between border-primary/5 bg-primary/[0.01]">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b pb-3">
                                        <Wand2 className="h-3.5 w-3.5 text-primary" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider">Automatización</h4>
                                    </div>
                                    <Controller control={form.control} name="auto_confirm" render={({ field }) => (
                                        <div className="flex items-center justify-between p-4 border rounded-md bg-background shadow-sm hover:border-primary/30 transition-colors cursor-pointer group"
                                            onClick={() => field.onChange(!field.value)}>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold">Auto-Confirmación</p>
                                                <p className="text-[11px] text-muted-foreground leading-tight max-w-[200px]">
                                                    Conciliar automáticamente si el score supera el {form.watch("confidence_threshold")}%.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className="group-hover:scale-105 transition-transform"
                                            />
                                        </div>
                                    )} />
                                </div>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}
