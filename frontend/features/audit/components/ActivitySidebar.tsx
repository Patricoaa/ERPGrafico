"use client"

import React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Plus, Edit, Trash2, User, Clock, ArrowRight, ChevronDown } from "lucide-react"
import { HistoricalRecord } from "@/types/audit"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import {
    translateFieldName,
    translateStatus,
    translateProductionStage,
    translateSalesChannel,
    translateReceivingStatus,
    translateProductType,
    translatePaymentMethod
} from "@/lib/utils"
import { useEntityHistory } from "@/features/audit/hooks/useEntityHistory"
import { FadeIn } from "@/components/shared"
import { SkeletonShell } from "@/components/shared"

interface ActivitySidebarProps {
    entityId: number | string
    entityType: 'product' | 'contact' | 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'sale_delivery' | 'sale_return' | 'purchase_receipt' | 'user' | 'company_settings' | 'work_order' | 'journal_entry' | 'stock_move' | 'pricing_rule' | 'reordering_rule' | 'treasuryaccount' | 'bank' | 'paymentmethod' | 'terminal' | 'category' | 'warehouse' | 'uom' | 'uom_category' | 'attribute' | 'account' | 'bank_journal' | 'employee' | 'salaryadvance' | 'fiscal_year' | 'tax_period' | 'f29_declaration' | 'task' | 'attachment'
    className?: string
    title?: string
}

const IGNORED_FIELDS = ['id', 'created_at', 'updated_at', 'history_id', 'history_date', 'history_type', 'history_user_id', 'history_user_username', 'history_change_reason']

const ENTITY_TYPE_LABELS: Record<string, string> = {
    product: 'el producto',
    contact: 'el contacto',
    sale_order: 'la nota de venta',
    purchase_order: 'la orden de compra',
    invoice: 'la factura',
    payment: 'el pago',
    sale_delivery: 'el despacho de venta',
    sale_return: 'la devolución de venta',
    purchase_receipt: 'la recepción de compra',
    user: 'el usuario',
    company_settings: 'la configuración',
    work_order: 'la orden de trabajo',
    journal_entry: 'el asiento contable',
    stock_move: 'el movimiento de stock',
    pricing_rule: 'la regla de precio',
    reordering_rule: 'la regla de reabastecimiento',
    treasuryaccount: 'la cuenta de tesorería',
    bank: 'el banco',
    paymentmethod: 'el método de pago',
    terminal: 'el terminal',
    category: 'la categoría',
    warehouse: 'la bodega',
    uom: 'la unidad de medida',
    uom_category: 'la categoría de unidad de medida',
    attribute: 'el atributo',
    account: 'la cuenta contable',
    bank_journal: 'el libro de banco',
    employee: 'el empleado',
    salaryadvance: 'el anticipo de sueldo',
    fiscal_year: 'el año fiscal',
    tax_period: 'el período de impuestos',
    f29_declaration: 'la declaración F29',
    task: 'la tarea',
    attachment: 'el archivo adjunto'
}

export function ActivitySidebar({ entityId, entityType, className = "", title = "Actividad" }: ActivitySidebarProps) {
    const { history, loading, error } = useEntityHistory(entityType, entityId)
    const [expandedRecords, setExpandedRecords] = React.useState<Record<string | number, boolean>>({})

    const toggleRecord = (recordId: string | number) => {
        setExpandedRecords(prev => ({
            ...prev,
            [recordId]: !prev[recordId]
        }))
    }

    const getChangeIcon = (type: string) => {
        switch (type) {
            case '+': return <Plus className="h-3 w-3" />
            case '~': return <Edit className="h-3 w-3" />
            case '-': return <Trash2 className="h-3 w-3" />
            default: return <Edit className="h-3 w-3" />
        }
    }

    const getIconColor = (type: string) => {
        switch (type) {
            case '+':
                return 'bg-success text-success-foreground border-success dark:bg-success dark:text-success-foreground'
            case '~':
                return 'bg-primary text-primary-foreground border-primary dark:bg-primary dark:text-primary-foreground'
            case '-':
                return 'bg-destructive text-destructive-foreground border-destructive dark:bg-destructive dark:text-destructive-foreground'
            default:
                return 'bg-muted text-muted-foreground border-border'
        }
    }

    const getChangedFields = (current: HistoricalRecord, previous?: HistoricalRecord): string[] => {
        if (!previous) return []

        const changed: string[] = []
        Object.keys(current).forEach(key => {
            if (IGNORED_FIELDS.includes(key)) return
            if (current[key] !== previous[key]) {
                changed.push(key)
            }
        })
        return changed
    }

    const formatFieldName = (field: string): string => {
        return translateFieldName(field)
    }

    return (
        <SkeletonShell isLoading={loading} ariaLabel="Cargando actividad">
            <div className={cn("flex flex-col h-full p-4 bg-background select-none", className)}>
                {/* Encabezado del Módulo (Capa L1 - FormSection) */}
                <div className="pb-3 mb-4 shrink-0 flex items-center justify-between border-b border-border/40">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/70 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        {title}
                    </h3>
                    {history.length > 0 && (
                        <span className="text-[10px] font-medium text-muted-foreground/50 lowercase tracking-normal">
                            ({history.length} {history.length === 1 ? 'registro' : 'registros'})
                        </span>
                    )}
                </div>

                {/* Scroll Container */}
                <ScrollArea className="flex-1 min-h-0 pr-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/55" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Cargando Archivo...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 border border-dashed border-destructive/25 rounded-md bg-destructive/5">
                            <p className="text-xs font-black uppercase tracking-wider text-destructive px-4">{error}</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-border/60 rounded-md bg-muted/10">
                            <User className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                Sin actividad registrada
                            </p>
                        </div>
                    ) : (
                        <div className="ml-1 mt-2 pb-4">
                            {history.map((record, index) => {
                                const changedFields = index < history.length - 1
                                    ? getChangedFields(record, history[index + 1])
                                    : []

                                const username = record.history_user_username || 'Sistema';
                                const isCreate = record.history_type === '+';
                                const isDelete = record.history_type === '-';
                                const recordDelay = Math.min(index * 0.05, 0.25);
                                const isExpanded = !!expandedRecords[record.history_id]
                                const entityLabel = ENTITY_TYPE_LABELS[entityType] || 'el registro'

                                return (
                                    <FadeIn key={record.history_id} delay={recordDelay} yOffset={6}>
                                        <div className="group relative flex gap-4 pb-8 last:pb-0">
                                            {/* Línea de Troquelado / Perforación (Dashed Timeline Connector) */}
                                            {index !== history.length - 1 && (
                                                <div className="absolute left-[11px] top-6 -bottom-6 w-0 border-l border-dashed border-border/80 group-hover:border-primary/30 transition-colors duration-normal ease-premium z-0" />
                                            )}

                                            {/* Badge de Historial Tipo Swatch Angular */}
                                            <div className={cn(
                                                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border shadow-sm transition-all duration-normal ease-premium group-hover:scale-105",
                                                getIconColor(record.history_type)
                                            )}>
                                                {getChangeIcon(record.history_type)}
                                            </div>

                                            {/* Bloque de Información del Registro */}
                                            <div className="flex-1 min-w-0 pt-0.5 flex flex-col">
                                                {/* Cabecera del Item de Línea de Tiempo */}
                                                <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground flex-wrap">
                                                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors duration-normal">
                                                        {username}
                                                    </span>

                                                    <span className="text-muted-foreground/80 font-medium">
                                                        {isCreate ? 'creó' : isDelete ? 'eliminó' : 'editó'}
                                                    </span>

                                                    <span className="font-semibold text-foreground">
                                                        {entityLabel}
                                                    </span>

                                                    {/* Timestamp */}
                                                    <time
                                                        className="whitespace-nowrap sm:ml-auto text-[9px] font-medium tracking-normal text-muted-foreground/60 group-hover:text-muted-foreground transition-colors duration-normal"
                                                        title={new Date(record.history_date).toISOString()}
                                                    >
                                                        {formatDistanceToNow(new Date(record.history_date), {
                                                            addSuffix: true,
                                                            locale: es
                                                        })}
                                                    </time>
                                                </div>

                                                {/* Acordeón Toggle */}
                                                {changedFields.length > 0 && record.history_type === '~' && (
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => toggleRecord(record.history_id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                toggleRecord(record.history_id);
                                                            }
                                                        }}
                                                        className="w-fit text-[9px] font-bold text-muted-foreground/50 hover:text-primary flex items-center gap-1 cursor-pointer mt-1.5 uppercase tracking-wider transition-colors duration-normal select-none outline-none"
                                                    >
                                                        {isExpanded ? 'Ocultar cambios' : 'Ver cambios'}
                                                        <ChevronDown className={cn("h-2.5 w-2.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                                                    </span>
                                                )}

                                                {/* Detalles de Cambios */}
                                                {changedFields.length > 0 && record.history_type === '~' && isExpanded && (
                                                    <div className="mt-2.5 pl-1 transition-all duration-normal ease-premium">
                                                        <ul className="space-y-2">
                                                            {changedFields.map(field => {
                                                                const oldValue = history[index + 1][field];
                                                                const newValue = record[field];

                                                                const formatValue = (fieldName: string, val: unknown) => {
                                                                    if (val === null || val === undefined || (typeof val === 'string' && val.trim() === ''))
                                                                        return 'vacío';
                                                                    if (typeof val === 'boolean') return val ? 'Sí' : 'No';

                                                                    let displayVal = String(val);
                                                                    if (typeof val === 'string') {
                                                                        const f = fieldName.toLowerCase();
                                                                        if (f.includes('status') || f.includes('state')) displayVal = translateStatus(val);
                                                                        else if (f.includes('stage')) displayVal = translateProductionStage(val);
                                                                        else if (f.includes('channel')) displayVal = translateSalesChannel(val);
                                                                        else if (f.includes('method')) displayVal = translatePaymentMethod(val);
                                                                        else if (f.includes('receiving')) displayVal = translateReceivingStatus(val);
                                                                        else if (f.includes('type') && val.match(/^[A-Z_]+$/)) displayVal = translateProductType(val);

                                                                        if (displayVal.length > 40) return displayVal.substring(0, 37) + '...';
                                                                    }

                                                                    return displayVal;
                                                                };

                                                                return (
                                                                    <li key={field} className="text-xs flex items-baseline gap-2 py-0.5 text-muted-foreground/90 flex-wrap sm:flex-nowrap">
                                                                        <span className="text-[10px] font-medium tracking-normal text-muted-foreground/50 lowercase shrink-0">
                                                                            {formatFieldName(field)}:
                                                                        </span>
                                                                        <span className="font-mono text-[11px] text-muted-foreground/70 line-through truncate max-w-[120px] sm:max-w-none">
                                                                            {formatValue(field, oldValue)}
                                                                        </span>
                                                                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0 self-center" />
                                                                        <span className="font-mono text-[11px] text-foreground font-medium truncate max-w-[120px] sm:max-w-none">
                                                                            {formatValue(field, newValue)}
                                                                        </span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </FadeIn>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </SkeletonShell>
    )
}
