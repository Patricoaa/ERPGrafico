"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Info, Brain, Save, Settings2, Calendar, Hash, User, CircleDollarSign, Loader2, Wand2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useReconciliationSettingsQuery } from "../hooks/useReconciliationQueries"
import { useUpdateReconciliationSettingsMutation } from "../hooks/useReconciliationMutations"
import { cn } from "@/lib/utils"

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

const WeightControl = ({ icon: Icon, label, value, tooltip, onChange }: { icon: any; label: string; value: number; tooltip: string; onChange: (v: number) => void }) => (
    <div className="space-y-3">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
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
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
    </div>
)

const ThresholdControl = ({ label, value, suffix, tooltip, onChange, min = 0, max = 100 }: any) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <FieldLabel title={label} tooltip={tooltip} />
            <span className="text-xs font-bold text-primary">{value}{suffix}</span>
        </div>
        <input
            type="range" min={min} max={max} step={max > 50 ? 5 : 1}
            value={value}
            onChange={e => onChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
    </div>
)

export function ReconciliationIntelligence({ externalOpen }: { externalOpen?: boolean }) {
    const { data: settings, isLoading: isLoadingSettings, isFetching: isFetchingSettings } = useReconciliationSettingsQuery("global")
    const updateMutation = useUpdateReconciliationSettingsMutation("global")

    const [localSettings, setLocalSettings] = useState<any>(null)

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings)
        }
    }, [settings])

    const handleSave = async () => {
        if (localSettings) {
            await updateMutation.mutateAsync(localSettings)
        }
    }

    const totalWeight = localSettings ? 
        localSettings.amount_weight + 
        localSettings.date_weight + 
        localSettings.reference_weight + 
        localSettings.contact_weight : 0

    return (
        <TooltipProvider>
            <div className="space-y-4 max-w-2xl mx-auto py-2">
                {(isLoadingSettings || isFetchingSettings) && !localSettings ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : localSettings && (
                    <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                <WeightControl
                                    icon={CircleDollarSign}
                                    label="Monto Exacto"
                                    value={localSettings.amount_weight}
                                    tooltip="Prioridad alta si esperas que el banco y el sistema registren siempre el mismo monto."
                                    onChange={v => setLocalSettings({...localSettings, amount_weight: v})}
                                />
                                <WeightControl
                                    icon={Calendar}
                                    label="Cercanía de Fecha"
                                    value={localSettings.date_weight}
                                    tooltip="Importante si hay desfase entre el pago y el registro bancario (ej: depósitos)."
                                    onChange={v => setLocalSettings({...localSettings, date_weight: v})}
                                />
                                <WeightControl
                                    icon={Hash}
                                    label="Referencia / Operación"
                                    value={localSettings.reference_weight}
                                    tooltip="ID de transferencia, número de cheque o código de operación único."
                                    onChange={v => setLocalSettings({...localSettings, reference_weight: v})}
                                />
                                <WeightControl
                                    icon={User}
                                    label="Coincidencia de Contacto"
                                    value={localSettings.contact_weight}
                                    tooltip="Busca el nombre del cliente/proveedor dentro de la glosa descriptiva del banco."
                                    onChange={v => setLocalSettings({...localSettings, contact_weight: v})}
                                />
                            </div>
                            
                            {totalWeight !== 100 && (
                                <div className="mt-8 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-3 text-warning-foreground text-xs font-medium">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    Los pesos deben sumar exactamente 100% para poder guardar la configuración.
                                </div>
                            )}
                        </Card>

                        {/* Logic Config */}
                        <div className="grid grid-cols-1 gap-6">
                            <Card className="p-4 space-y-4">
                                <div className="flex items-center gap-2 border-b pb-3">
                                    <Settings2 className="h-3.5 w-3.5 text-primary" />
                                    <h4 className="text-xs font-bold uppercase tracking-wider">Parámetros</h4>
                                </div>
                                
                                <ThresholdControl
                                    label="Umbral de Confianza"
                                    value={localSettings.confidence_threshold}
                                    suffix="%"
                                    tooltip="Score mínimo para que el sistema sugiera un match en el workbench."
                                    onChange={v => setLocalSettings({...localSettings, confidence_threshold: v})}
                                />

                                <ThresholdControl
                                    label="Rango de Búsqueda"
                                    value={localSettings.date_range_days}
                                    suffix=" días"
                                    min={1}
                                    max={365}
                                    tooltip="Días hacia atrás y adelante para buscar candidatos desde la fecha de la línea."
                                    onChange={v => setLocalSettings({...localSettings, date_range_days: v})}
                                />
                            </Card>

                            <Card className="p-4 flex flex-col justify-between border-primary/5 bg-primary/[0.01]">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b pb-3">
                                        <Wand2 className="h-3.5 w-3.5 text-primary" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider">Automatización</h4>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-background shadow-sm hover:border-primary/30 transition-colors cursor-pointer group"
                                         onClick={() => setLocalSettings({...localSettings, auto_confirm: !localSettings.auto_confirm})}>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold">Auto-Confirmación</p>
                                            <p className="text-[11px] text-muted-foreground leading-tight max-w-[200px]">
                                                Conciliar automáticamente si el score supera el {localSettings.confidence_threshold}%.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={localSettings.auto_confirm}
                                            onCheckedChange={v => setLocalSettings({...localSettings, auto_confirm: v})}
                                            className="group-hover:scale-105 transition-transform"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    className="w-full mt-6 h-10 text-xs font-bold shadow-md shadow-primary/10" 
                                    disabled={updateMutation.isPending || totalWeight !== 100 || isFetchingSettings}
                                    onClick={handleSave}
                                >
                                    {updateMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    {updateMutation.isPending ? 'Guardando...' : 'Guardar Perfil de Inteligencia'}
                                </Button>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}

const AlertTriangle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
)
