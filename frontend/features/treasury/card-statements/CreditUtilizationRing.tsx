"use client"

import { cn } from '@/lib/utils'

interface CreditUtilizationRingProps {
    limit: number
    unbilled: number
    className?: string
}

export function CreditUtilizationRing({
    limit,
    unbilled,
    className,
}: CreditUtilizationRingProps) {
    const available = Math.max(limit - unbilled, 0)
    const usedPct = limit > 0 ? (unbilled / limit) * 100 : 0

    const circumference = 2 * Math.PI * 42
    const unbilledOffset = circumference - (usedPct / 100) * circumference

    const format = (n: number) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

    return (
        <div className={cn('flex items-center gap-5', className)}>
            <svg width="120" height="120" viewBox="0 0 100 100" className="shrink-0">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                {unbilled > 0 && (
                    <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke="hsl(var(--warning))"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={unbilledOffset}
                        transform="rotate(-90 50 50)"
                        strokeLinecap="round"
                        className="transition-all duration-700"
                    />
                )}
                <text x="50" y="46" textAnchor="middle" className="fill-foreground text-lg font-bold" fontSize="18">
                    {usedPct.toFixed(0)}%
                </text>
                <text x="50" y="60" textAnchor="middle" className="fill-muted-foreground" fontSize="7">
                    usado
                </text>
            </svg>

            <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                    <span className="text-muted-foreground">No facturado</span>
                    <span className="font-bold tabular-nums ml-auto">{format(unbilled)}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="text-muted-foreground">Disponible</span>
                    <span className="font-bold tabular-nums ml-auto">{format(available)}</span>
                </div>
                <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                    Límite: {format(limit)}
                </div>
            </div>
        </div>
    )
}
