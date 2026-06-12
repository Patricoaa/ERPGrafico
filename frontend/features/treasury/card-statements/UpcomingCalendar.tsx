"use client"

import { cn } from '@/lib/utils'
import type { ByMonthItem } from '../types'

interface UpcomingCalendarProps {
    byMonth: Record<string, ByMonthItem>
    currency?: string
    className?: string
}

const MONTH_LABELS: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

export function UpcomingCalendar({ byMonth, currency = 'CLP', className }: UpcomingCalendarProps) {
    const entries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
    const maxTotal = Math.max(...entries.map(([, v]) => parseFloat(v.total)), 1)

    const format = (n: number) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

    if (!entries.length) {
        return (
            <p className="text-xs text-muted-foreground italic py-4 text-center">
                Sin cuotas futuras
            </p>
        )
    }

    return (
        <div className={cn('space-y-2', className)}>
            {entries.map(([key, item]) => {
                const [, mm] = key.split('-')
                const label = MONTH_LABELS[mm] ?? key
                const total = parseFloat(item.total)
                const pct = (total / maxTotal) * 100
                const isHighest = total >= maxTotal

                return (
                    <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className={cn(
                                'font-medium',
                                isHighest ? 'text-foreground' : 'text-muted-foreground',
                            )}>
                                {label}
                            </span>
                            <span className="font-bold tabular-nums text-foreground">
                                {format(total)}
                            </span>
                        </div>
                        <div className="relative h-5 bg-muted/40 rounded-sm overflow-hidden">
                            <div
                                className={cn(
                                    'h-full rounded-sm transition-all duration-500',
                                    isHighest ? 'bg-warning' : 'bg-info/60',
                                )}
                                style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            {item.count} {item.count === 1 ? 'cuota' : 'cuotas'}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
