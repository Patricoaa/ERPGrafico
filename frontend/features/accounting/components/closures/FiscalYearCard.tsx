import React from 'react';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FiscalYear, AccountingPeriod } from '../../types';
import { CalendarRange, Lock, MoreVertical, PlayCircle, Settings2, ShieldAlert } from 'lucide-react';
import { PeriodGridItem } from './PeriodGridItem';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatPlainDate } from '@/lib/utils';

interface FiscalYearCardProps {
    year: number;
    fiscalYear?: FiscalYear;
    periods: AccountingPeriod[];
    onClosePeriod: (id: number) => void;
    onReopenPeriod: (id: number) => void;
    isPeriodActionLoading: boolean;
    onPreviewClosing: (year: number) => void;
    onReopenFiscalYear: (year: number) => void;
    onGenerateOpening: (year: number) => void;
    isFiscalYearLoading: boolean;
}

export function FiscalYearCard({
    year,
    fiscalYear,
    periods,
    onClosePeriod,
    onReopenPeriod,
    isPeriodActionLoading,
    onPreviewClosing,
    onReopenFiscalYear,
    onGenerateOpening,
    isFiscalYearLoading
}: FiscalYearCardProps) {
    
    // Default to OPEN if fiscal year model doesn't exist yet for this year
    const status = fiscalYear?.status || 'OPEN';
    const isClosed = status === 'CLOSED';

    const getStatusToken = (s: string) => {
        switch (s) {
            case 'OPEN': return 'success';
            case 'CLOSING': return 'warning';
            case 'CLOSED': return 'info';
            default: return 'generic';
        }
    };

    const getStatusLabel = (s: string) => {
        switch (s) {
            case 'OPEN': return 'Abierto';
            case 'CLOSING': return 'En Cierre';
            case 'CLOSED': return 'Cerrado';
            default: return s;
        }
    };

    return (
        <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card overflow-hidden mb-8">
            {/* Header / Annual Status */}
            <div className="bg-muted/20 border-b border-border/50 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <CalendarRange className="w-6 h-6 text-muted-foreground" />
                    <div>
                        <h3 className="font-heading font-extrabold text-2xl uppercase tracking-tighter flex items-center gap-3">
                            Ejercicio {year}
                            <StatusBadge status={getStatusToken(status)} label={getStatusLabel(status)} />
                        </h3>
                        {isClosed && fiscalYear?.closed_at && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                                <Lock className="w-3 h-3" />
                                Cerrado definitivamente el {formatPlainDate(fiscalYear.closed_at)}
                                {fiscalYear.closed_by_name && ` por ${fiscalYear.closed_by_name}`}
                            </p>
                        )}
                        {!isClosed && (
                            <p className="text-sm text-muted-foreground mt-1">
                                {periods.length} periodos mensuales registrados.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Primary Action */}
                    {!isClosed ? (
                        <Button
                            variant="default"
                            onClick={() => onPreviewClosing(year)}
                            disabled={isFiscalYearLoading || periods.length === 0 || periods.some(p => p.status !== 'CLOSED')}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <ShieldAlert className="w-4 h-4 mr-2" />
                            Ejecutar cierre del ejercicio
                        </Button>
                    ) : null}

                    {/* Three dots menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-10 w-10">
                                <Settings2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {isClosed ? (
                                <>
                                    <DropdownMenuItem onClick={() => onReopenFiscalYear(year)} disabled={isFiscalYearLoading}>
                                        <Lock className="w-4 h-4 mr-2 text-warning" />
                                        Reabrir Ejercicio
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => onGenerateOpening(year)} disabled={isFiscalYearLoading}>
                                        <PlayCircle className="w-4 h-4 mr-2 text-success" />
                                        Generar Asiento Apertura
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <DropdownMenuItem disabled>
                                    <MoreVertical className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Acciones bloqueadas (Año abierto)
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Monthly Periods Grid */}
            <div className="p-5 md:p-6 bg-card">
                <h4 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-widest mb-4">
                    Periodos Mensuales
                </h4>
                
                {periods.length === 0 ? (
                    <EmptyState
                        context="generic"
                        variant="compact"
                        title="Sin periodos registrados"
                        description={`No existen asientios contables o periodos habilitados para el año ${year}.`}
                    />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {periods.map(period => (
                            <PeriodGridItem
                                key={period.id}
                                period={period}
                                onClose={onClosePeriod}
                                onReopen={onReopenPeriod}
                                isActionLoading={isPeriodActionLoading}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}
