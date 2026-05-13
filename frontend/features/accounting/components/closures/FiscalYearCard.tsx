import React from 'react';
import { EntityCard } from '@/components/shared/EntityCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SubmitButton, IconButton } from '@/components/shared';
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
        <EntityCard className="mb-6 shadow-md border-2 hover:border-border cursor-default">
            <EntityCard.Header
                title={
                    <div className="flex items-center gap-3">
                        <CalendarRange className="w-5 h-5 text-muted-foreground" />
                        <span className="font-heading font-extrabold text-xl uppercase tracking-tighter">
                            Ejercicio {year}
                        </span>
                    </div>
                }
                subtitle={
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2">
                            <StatusBadge status={getStatusToken(status)} label={getStatusLabel(status)} />
                        </div>
                        {isClosed && fiscalYear?.closed_at ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Lock className="w-3 h-3" />
                                Cerrado: {formatPlainDate(fiscalYear.closed_at)}
                                {fiscalYear.closed_by_name && ` por ${fiscalYear.closed_by_name}`}
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground">
                                {periods.length} periodos mensuales registrados.
                            </span>
                        )}
                    </div>
                }
                trailing={
                    <div className="flex items-center gap-2">
                        {!isClosed && (
                            <SubmitButton
                                onClick={() => onPreviewClosing(year)}
                                disabled={periods.length === 0 || periods.some(p => p.status !== 'CLOSED')}
                                loading={isFiscalYearLoading}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest text-[10px] h-8 px-3"
                                icon={<ShieldAlert className="w-3.5 h-3.5 mr-1.5" />}
                            >
                                Cerrar Ejercicio
                            </SubmitButton>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <IconButton className="h-8 w-8">
                                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                                </IconButton>
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
                }
            />

            <div className="p-4 bg-muted/5 border-t border-border/50">
                <h4 className="font-heading font-bold text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
        </EntityCard>
    );
}
