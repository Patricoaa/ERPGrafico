import React from 'react';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { AccountingPeriod } from '../../types';
import { Calendar, Lock, LockOpen, CheckCircle2, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { formatPlainDate } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PeriodGridItemProps {
    period: AccountingPeriod;
    onClose: (id: number) => void;
    onReopen: (id: number) => void;
    isActionLoading: boolean;
}

const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case 'OPEN': return <CheckCircle2 className="w-4 h-4 text-success" />;
        case 'UNDER_REVIEW': return <Clock className="w-4 h-4 text-warning" />;
        case 'CLOSED': return <Lock className="w-4 h-4 text-muted-foreground" />;
        default: return null;
    }
};export function PeriodGridItem({ period, onClose, onReopen, isActionLoading }: PeriodGridItemProps) {
    const getStatusToken = (status: string) => {
        switch (status) {
            case 'OPEN': return 'success';
            case 'UNDER_REVIEW': return 'warning';
            case 'CLOSED': return 'info';
            default: return 'generic';
        }
    };

    const taxClosed = !!(period.tax_period_id && period.tax_period_status === 'CLOSED');

    return (
        <Card className="p-4 flex flex-col justify-between h-full group transition-all duration-300 rounded-none border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                        <p className="font-heading font-extrabold uppercase tracking-tight text-sm">
                            {period.month_display}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                            {String(period.month).padStart(2, '0')} / {period.year}
                        </p>
                    </div>
                </div>
                <StatusBadge status={getStatusToken(period.status)} label={period.status_display} />
            </div>

            <div className="flex-1 mb-4">
                {period.status === 'CLOSED' ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2 bg-muted/30 p-2 rounded">
                        <Lock className="w-3 h-3" />
                        <span className="truncate">Cerrado: {formatPlainDate(period.closed_at || '')}</span>
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2 p-2 px-0">
                        <StatusIcon status={period.status} />
                        <span>{period.status === 'OPEN' ? 'Periodo activo.' : 'En revisión.'}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <div className="flex items-center gap-2">
                    {taxClosed ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 cursor-help animate-pulse-subtle">
                                        <ShieldCheck className="w-3 h-3 text-warning" />
                                        <span className="text-[10px] font-bold uppercase text-warning tracking-wider">F29 Cerrado</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px] bg-popover border-border">
                                    <p className="text-xs font-medium">El periodo tributario (F29) está oficialmente cerrado ante el SII. Se bloquea la reapertura contable para garantizar integridad fiscal.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : period.tax_period_id ? (
                        <div className="flex items-center gap-1.2 opacity-50">
                            <ShieldAlert className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-tight">F29 Abierto</span>
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-end">
                    {period.status !== 'CLOSED' ? (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs px-3 bg-secondary text-secondary-foreground hover:bg-warning hover:text-warning-foreground transition-colors"
                            onClick={() => onClose(period.id)}
                            disabled={isActionLoading}
                        >
                            <Lock className="w-3 h-3 justify-center" />
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs px-3"
                            onClick={() => onReopen(period.id)}
                            disabled={isActionLoading || taxClosed}
                        >
                            <LockOpen className="w-3 h-3 justify-center" />
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
}
