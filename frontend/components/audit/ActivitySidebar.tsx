"use client"

import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Plus, Edit, Trash2, User, Clock } from "lucide-react"
import api from "@/lib/api"
import { HistoricalRecord } from "@/types/audit"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { translateFieldName } from "@/lib/utils"

interface ActivitySidebarProps {
    entityId: number | string
    entityType: 'product' | 'contact' | 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'sale_delivery' | 'purchase_receipt' | 'user' | 'company_settings' | 'work_order' | 'journal_entry' | 'stock_move' | 'pricing_rule' | 'reordering_rule' | 'treasuryaccount' | 'bank' | 'paymentmethod' | 'terminal' | 'category' | 'warehouse' | 'uom' | 'uom_category' | 'attribute' | 'account' | 'bank_journal'
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
    'bank_journal': '/accounting/journals'
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
            } catch (err: unknown) {
                console.error("Error fetching history:", err)
                const error = err as { code?: string; response?: { data?: { detail?: string } } }
                const message = error.code === 'ERR_NETWORK'
                    ? "Error de conexión con el servidor"
                    : (error.response?.data?.detail || "Error al cargar el historial")
                setError(message)
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
            case '+': return <Plus className="h-3.5 w-3.5 text-green-600" />
            case '~': return <Edit className="h-3.5 w-3.5 text-blue-600" />
            case '-': return <Trash2 className="h-3.5 w-3.5 text-red-600" />
            default: return <Edit className="h-3.5 w-3.5 text-muted-foreground" />
        }
    }

    const getChangeLabel = (type: string) => {
        switch (type) {
            case '+': return 'Creado'
            case '~': return 'Editado'
            case '-': return 'Eliminado'
            default: return 'Modificado'
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
        <div className={`flex flex-col h-full p-3 ${className}`}>
            <div className="border-b pb-2 mb-3 shrink-0">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {title}
                </h3>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12">
                        <User className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground italic">
                            Sin actividad registrada
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((record, index) => {
                            const changedFields = index < history.length - 1
                                ? getChangedFields(record, history[index + 1])
                                : []

                            return (
                                <div key={record.history_id} className="flex gap-3">
                                    {/* Avatar */}
                                    <div className="flex-shrink-0">
                                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-xs font-bold text-primary">
                                                {record.history_user_username?.substring(0, 2).toUpperCase() || 'SY'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pb-3 border-b last:border-b-0">
                                        <div className="flex items-start justify-between gap-1 mb-0.5">
                                            <div className="flex items-center gap-2">
                                                {getChangeIcon(record.history_type)}
                                                <span className="text-xs font-bold">
                                                    {getChangeLabel(record.history_type)}
                                                </span>
                                            </div>
                                            <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {formatDistanceToNow(new Date(record.history_date), {
                                                    addSuffix: true,
                                                    locale: es
                                                })}
                                            </time>
                                        </div>

                                        <p className="text-xs text-muted-foreground mb-1">
                                            por <span className="font-semibold">{record.history_user_username || 'Sistema'}</span>
                                        </p>

                                        {changedFields.length > 0 && record.history_type === '~' && (
                                            <div className="mt-1 space-y-1">
                                                {changedFields.map(field => {
                                                    const oldValue = history[index + 1][field];
                                                    const newValue = record[field];

                                                    const formatValue = (val: unknown) => {
                                                        if (val === null || val === undefined) return <span className="italic opacity-50">vacio</span>;
                                                        if (typeof val === 'boolean') return val ? 'Sí' : 'No';
                                                        if (typeof val === 'string' && val.length > 30) return val.substring(0, 27) + '...';
                                                        return String(val);
                                                    };

                                                    return (
                                                        <div key={field} className="text-[10px] leading-tight">
                                                            <span className="font-semibold text-muted-foreground mr-1">
                                                                {formatFieldName(field)}:
                                                            </span>
                                                            <span className="text-red-600/70 line-through mr-1">
                                                                {formatValue(oldValue)}
                                                            </span>
                                                            <span className="text-muted-foreground mr-1">→</span>
                                                            <span className="text-green-600 font-medium">
                                                                {formatValue(newValue)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
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
