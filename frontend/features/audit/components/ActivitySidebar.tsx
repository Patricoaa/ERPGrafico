"use client"

import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Plus, Edit, Trash2, User, Clock } from "lucide-react"
import api from "@/lib/api"
import { HistoricalRecord } from "@/types/audit"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { 
    translateFieldName, 
    translateStatus, 
    translateProductionStage, 
    translateSalesChannel, 
    translateReceivingStatus, 
    translateProductType, 
    translatePaymentMethod 
} from "@/lib/utils"
import { getErrorMessage } from "@/lib/errors"

interface ActivitySidebarProps {
    entityId: number | string
    entityType: 'product' | 'contact' | 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'sale_delivery' | 'purchase_receipt' | 'user' | 'company_settings' | 'work_order' | 'journal_entry' | 'stock_move' | 'pricing_rule' | 'reordering_rule' | 'treasuryaccount' | 'bank' | 'paymentmethod' | 'terminal' | 'category' | 'warehouse' | 'uom' | 'uom_category' | 'attribute' | 'account' | 'bank_journal' | 'employee'
    className?: string
    title?: string
}

const ENDPOINT_MAP: Record<string, string> = {
    'product': '/inventory/products',
    'contact': '/contacts',
    'sale_order': '/sales/orders',
    'purchase_order': '/purchasing/orders',
    'invoice': '/billing/invoices',
    'payment': '/treasury/payments',
    'sale_delivery': '/sales/deliveries',
    'purchase_receipt': '/purchasing/receipts',
    'user': '/core/users',
    'company_settings': '/core/company',
    'work_order': '/production/orders',
    'journal_entry': '/accounting/entries',
    'stock_move': '/inventory/moves',
    'pricing_rule': '/inventory/pricing-rules',
    'reordering_rule': '/inventory/reordering-rules',
    'treasuryaccount': '/treasury/accounts',
    'bank': '/treasury/banks',
    'paymentmethod': '/treasury/payment-methods',
    'terminal': '/treasury/pos-terminals',
    'category': '/inventory/categories',
    'warehouse': '/inventory/warehouses',
    'uom': '/inventory/uoms',
    'uom_category': '/inventory/uom-categories',
    'attribute': '/inventory/attributes',
    'account': '/accounting/accounts',
    'bank_journal': '/accounting/journals',
    'employee': '/hr/employees'
}

const IGNORED_FIELDS = ['id', 'created_at', 'updated_at', 'history_id', 'history_date', 'history_type', 'history_user_id', 'history_user_username', 'history_change_reason']

export function ActivitySidebar({ entityId, entityType, className = "", title = "Actividad" }: ActivitySidebarProps) {
    const [history, setHistory] = useState<HistoricalRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchHistoryInternal = async () => {
            setLoading(true)
            setError(null)
            try {
                const endpoint = ENDPOINT_MAP[entityType]
                if (!endpoint) {
                    throw new Error(`Unknown entity type: ${entityType}`)
                }
                const res = await api.get(`${endpoint}/${entityId}/history/`)
                setHistory(res.data)
            } catch (error: unknown) {
                setError(getErrorMessage(error))
            } finally {
                setLoading(false)
            }
        }

        if (entityId) {
            fetchHistoryInternal()
        }
    }, [entityId, entityType])

    const getChangeIcon = (type: string) => {
        switch (type) {
            case '+': return <Plus className="h-4 w-4" />
            case '~': return <Edit className="h-4 w-4" />
            case '-': return <Trash2 className="h-4 w-4" />
            default: return <Edit className="h-4 w-4" />
        }
    }

    const getIconColor = (type: string) => {
        switch (type) {
            case '+': return 'bg-success/10/80 text-success border-success/20 dark:bg-success/30 dark:text-success/50 dark:border-success'
            case '~': return 'bg-primary/10/80 text-primary border-primary/20 dark:bg-primary/30 dark:text-primary/50 dark:border-primary'
            case '-': return 'bg-destructive/10/80 text-destructive border-destructive/20 dark:bg-destructive/30 dark:text-destructive dark:border-destructive'
            default: return 'bg-muted text-muted-foreground border-border'
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
        <div className={`flex flex-col h-full p-4 ${className}`}>
            <div className="border-b pb-3 mb-4 shrink-0">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {title}
                </h3>
            </div>

            <ScrollArea className="flex-1 min-h-0 pr-3">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12">
                        <User className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground italic">
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

                            return (
                                <div key={record.history_id} className="relative flex gap-4 pb-8 last:pb-0">
                                    {/* Timeline Connecting Line */}
                                    {index !== history.length - 1 && (
                                        <div className="absolute left-[15px] top-8 -bottom-8 w-[2px] bg-border/60 z-0" />
                                    )}

                                    {/* Timeline Icon */}
                                    <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm ${getIconColor(record.history_type)}`}>
                                        {getChangeIcon(record.history_type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pt-1.5 flex flex-col">
                                        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground flex-wrap">
                                            {/* User Avatar Small */}
                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 select-none">
                                                <span className="text-[9px] font-bold text-primary">
                                                    {username.substring(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                            
                                            <span className="font-semibold text-foreground">
                                                {username}
                                            </span>
                                            
                                            <span>
                                                {isCreate ? 'creó' : isDelete ? 'eliminó' : 'editó'}
                                            </span>

                                            <span className="font-medium text-foreground">
                                                este registro
                                            </span>

                                            <time 
                                                className="whitespace-nowrap sm:ml-auto underline decoration-dotted underline-offset-2 text-xs" 
                                                title={new Date(record.history_date).toLocaleString()}
                                            >
                                                {formatDistanceToNow(new Date(record.history_date), {
                                                    addSuffix: true,
                                                    locale: es
                                                })}
                                            </time>
                                        </div>

                                        {/* Changed details */}
                                        {changedFields.length > 0 && record.history_type === '~' && (
                                            <div className="mt-3 rounded-md border bg-card text-card-foreground shadow-sm">
                                                <div className="p-3">
                                                    <ul className="space-y-2">
                                                        {changedFields.map(field => {
                                                            const oldValue = history[index + 1][field];
                                                            const newValue = record[field];

                                                            const formatValue = (fieldName: string, val: unknown) => {
                                                                if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) 
                                                                    return <span className="italic opacity-50">vacío</span>;
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
                                                                    
                                                                    if (displayVal.length > 50) return displayVal.substring(0, 47) + '...';
                                                                }
                                                                
                                                                return displayVal;
                                                            };

                                                            return (
                                                                <li key={field} className="text-[13px] flex flex-col gap-1.5 pt-1.5 pb-2.5 last:pb-0 border-b last:border-0 border-border/40">
                                                                    <span className="font-semibold text-muted-foreground">
                                                                        {formatFieldName(field)}
                                                                    </span>
                                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                                                        <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive dark:text-destructive line-through decoration-red-500/50 break-words max-w-full">
                                                                            {formatValue(field, oldValue)}
                                                                        </span>
                                                                        <span className="text-muted-foreground font-bold shrink-0">→</span>
                                                                        <span className="rounded bg-success/10 px-2 py-0.5 text-success dark:text-success/50 font-medium break-words max-w-full">
                                                                            {formatValue(field, newValue)}
                                                                        </span>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}
