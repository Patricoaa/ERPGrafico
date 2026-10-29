"use client"

import React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Clock, ArrowRight, ChevronDown } from "lucide-react"
import { type HistoricalRecord } from "@/types/audit"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"
import { cn, translateFieldName } from "@/lib/utils"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import { useEntityHistory } from "@/features/audit/hooks/useEntityHistory"
import { CollapsibleSection, EmptyState, SkeletonShell, StatusBadge } from "@/components/shared"
import {
    resolveHistoryOperation,
    getChangedFields,
    formatHistoryValue
} from "@/features/audit/lib/history-display"

interface ActivitySidebarProps {
    entityId: number | string
    entityType: 'product' | 'contact' | 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'sale_delivery' | 'sale_return' | 'purchase_receipt' | 'purchase_return' | 'inventory_document' | 'check' | 'terminal_batch' | 'profit_distribution' | 'user' | 'company_settings' | 'work_order' | 'journal_entry' | 'stock_move' | 'pricing_rule' | 'reordering_rule' | 'treasuryaccount' | 'bank' | 'paymentmethod' | 'terminal' | 'category' | 'warehouse' | 'uom' | 'uom_category' | 'attribute' | 'account' | 'bank_journal' | 'employee' | 'salaryadvance' | 'absence' | 'fiscal_year' | 'tax_period' | 'f29_declaration' | 'task' | 'attachment' | 'group' | 'inventory_count' | 'bank_loan'
    className?: string
    title?: string
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
    product: 'el producto',
    contact: 'el contacto',
    sale_order: `la ${getDomainConceptTitle('ov').toLowerCase()}`,
    purchase_order: 'la orden de compra',
    invoice: 'la factura',
    payment: 'el pago',
    sale_delivery: 'el despacho de venta',
    sale_return: 'la devolución de venta',
    purchase_receipt: 'la recepción de compra',
    purchase_return: 'la devolución de compra',
    inventory_document: 'el documento de inventario',
    check: 'el cheque',
    terminal_batch: 'el lote de terminal',
    profit_distribution: 'la distribución de resultados',
    user: 'el usuario',
    company_settings: 'la configuración',
    work_order: `la ${getDomainConceptTitle('ot').toLowerCase()}`,
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
    attachment: 'el archivo adjunto',
    group: 'el grupo',
    inventory_count: 'el recuento de inventario',
    bank_loan: 'el préstamo bancario',
    absence: 'la ausencia',
}

const PLACEHOLDER_RECORDS: HistoricalRecord[] = [
    { history_id: -1, history_date: '2024-01-01T12:00:00.000Z', history_change_reason: null, history_type: '+', history_user_id: null, history_user_username: 'Operador', name: 'A' },
    { history_id: -2, history_date: '2024-01-01T13:00:00.000Z', history_change_reason: null, history_type: '~', history_user_id: null, history_user_username: 'Operador', name: 'B' },
    { history_id: -3, history_date: '2024-01-01T14:00:00.000Z', history_change_reason: null, history_type: '~', history_user_id: null, history_user_username: 'Operador' },
]

export function ActivitySidebar({ entityId, entityType, className, title = "Actividad" }: ActivitySidebarProps) {
    const { history, loading, error } = useEntityHistory(entityType, entityId)
    const [open, setOpen] = React.useState(true)
    const [expandedRecords, setExpandedRecords] = React.useState<Record<string | number, boolean>>({})

    const records = loading ? PLACEHOLDER_RECORDS : history
    const entityLabel = ENTITY_TYPE_LABELS[entityType] || 'el registro'

    const toggleRecord = (recordId: string | number) => {
        setExpandedRecords(prev => ({
            ...prev,
            [recordId]: !prev[recordId]
        }))
    }

    const badge = !loading && records.length > 0 ? (
        <span className="text-3xs font-medium text-muted-foreground/60 tabular-nums">
            {records.length}
        </span>
    ) : undefined

    return (
        <CollapsibleSection
            title={title}
            icon={Clock}
            badge={badge}
            open={open}
            onOpenChange={setOpen}
            className={className}
        >
            <SkeletonShell isLoading={loading} ariaLabel="Cargando actividad" className="flex flex-col flex-1 min-h-0">
                {/* Scroll Container */}
                <ScrollArea className="flex-1 min-h-0 px-4 py-3">
                    {!loading && error ? (
                        <div role="alert" className="rounded-md border border-dashed border-destructive/25 bg-destructive/5 px-3 py-8 text-center">
                            <p className="text-xs font-medium text-destructive">No se pudo cargar la actividad</p>
                            <p className="mt-1 text-3xs text-muted-foreground/70 break-words">{error}</p>
                        </div>
                    ) : !loading && records.length === 0 ? (
                        <EmptyState
                            variant="compact"
                            context="generic"
                            icon={Clock}
                            title="Sin actividad registrada"
                            description="Los cambios del registro aparecerán aquí."
                        />
                    ) : (
                        <ol reversed className="pb-2">
                            {records.map((record, index) => {
                                const operation = resolveHistoryOperation(record.history_type)
                                const previous = records[index + 1]
                                const changedFields = getChangedFields(record, previous)
                                const canExpand = record.history_type === '~' && changedFields.length > 0
                                const isExpanded = !!expandedRecords[record.history_id]
                                const isLast = index === records.length - 1
                                const changesId = `activity-changes-${record.history_id}`

                                const username = record.history_user_username || 'Sistema'
                                const date = new Date(record.history_date)

                                return (
                                    <li key={record.history_id} className="flex gap-4">
                                        {/* Columna del marcador: badge + perforación vertical */}
                                        <div className="flex w-6 shrink-0 flex-col items-center">
                                            <StatusBadge
                                                variant="hub"
                                                size="sm"
                                                icon={operation.icon}
                                                status={operation.status}
                                                intent={operation.intent}
                                            />
                                            {!isLast && (
                                                <span aria-hidden="true" className="w-0 flex-1 border-l border-dashed border-border/80" />
                                            )}
                                        </div>

                                        {/* Bloque de Información del Registro */}
                                         <div className={cn("flex-1 min-w-0 flex flex-col", !isLast && isExpanded && "pb-6")}>
                                            <div className="flex items-baseline justify-between gap-2">
                                                 <span className="min-w-0 truncate text-2xs font-semibold leading-tight text-foreground">
                                                     {username}
                                                 </span>
                                                <time
                                                    className="shrink-0 text-3xs font-medium text-muted-foreground/60"
                                                    title={format(date, "d MMM yyyy, HH:mm", { locale: es })}
                                                >
                                                    {formatDistanceToNow(date, { addSuffix: true, locale: es })}
                                                </time>
                                            </div>

                                            <p className="mt-0.5 text-2xs leading-snug text-muted-foreground/80">
                                                {operation.verb}{' '}
                                                <span className="font-semibold text-foreground">{entityLabel}</span>
                                            </p>

                                            {/* Acordeón Toggle */}
                                            {canExpand && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleRecord(record.history_id)}
                                                    disabled={loading}
                                                    aria-expanded={isExpanded}
                                                    aria-controls={changesId}
                                                     className={cn(
                                                         "-ml-1 h-auto w-fit gap-1 rounded-sm px-1 py-0.5 text-muted-foreground/70 hover:bg-transparent hover:text-foreground text-2xs",
                                                         isExpanded ? "mt-2" : "mt-1"
                                                     )}
                                                >
                                                    {isExpanded ? 'Ocultar cambios' : 'Ver cambios'}
                                                    <ChevronDown
                                                        aria-hidden="true"
                                                        className={cn("size-3 transition-transform duration-200 ease-premium", isExpanded && "rotate-180")}
                                                    />
                                                </Button>
                                            )}

                                            {/* Detalles de Cambios */}
                                             {canExpand && (
                                                 <div id={changesId} hidden={!isExpanded} className="mt-2 border-l border-border/40 pl-2">
                                                     <ul className="space-y-1">
                                                         {changedFields.map(field => (
                                                             <li key={field} className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-2xs">
                                                                 <span className="text-muted-foreground/70 lowercase">
                                                                     {translateFieldName(field)}:
                                                                 </span>
                                                                 <span
                                                                     className="truncate text-muted-foreground/60 line-through"
                                                                     title={formatHistoryValue(field, previous?.[field])}
                                                                 >
                                                                     {formatHistoryValue(field, previous?.[field])}
                                                                 </span>
                                                                 <ArrowRight aria-hidden="true" className="h-2.5 w-2.5 shrink-0 self-center text-muted-foreground/40" />
                                                                 <span
                                                                     className="min-w-0 break-words text-foreground"
                                                                     title={formatHistoryValue(field, record[field])}
                                                                 >
                                                                     {formatHistoryValue(field, record[field])}
                                                                 </span>
                                                             </li>
                                                         ))}
                                                     </ul>
                                                 </div>
                                             )}
                                        </div>
                                    </li>
                                )
                            })}
                        </ol>
                    )}
                </ScrollArea>
            </SkeletonShell>
        </CollapsibleSection>
    )
}
