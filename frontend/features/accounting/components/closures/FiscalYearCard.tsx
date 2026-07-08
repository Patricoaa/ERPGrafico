import React from 'react';
import { EntityCard, IconButton, StatusBadge, SubmitButton } from '@/components/shared';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type FiscalYear, type AccountingPeriod, type TaxPeriod } from '../../types';
import { CalendarRange, Lock, MoreVertical, Settings2, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CombinedPeriodCard } from './CombinedPeriodCard';
import { formatPlainDate } from '@/lib/utils';

interface FiscalYearCardProps {
    year: number;
    fiscalYear?: FiscalYear;
    periods: AccountingPeriod[];
    taxPeriods: TaxPeriod[];
    onClosePeriod: (id: number) => void;
    onReopenPeriod: (params: { id: number; reason?: string }) => Promise<unknown>;
    onCreatePeriod: (year: number, month: number) => Promise<unknown>;
    isPeriodActionLoading: boolean;
    onCloseTaxPeriod: (id: number) => Promise<void>;
    onReopenTaxPeriod: (params: { id: number; reason?: string }) => Promise<unknown>;
    onOpenDeclaration: (params: { id?: number; year: number; month: number }) => void;
    isTaxActionLoading: boolean;
    onPreviewClosing: (year: number) => void;
    onReopenFiscalYear: (year: number) => void;
    isFiscalYearLoading: boolean;
    onPayF29?: (periodId: number) => void;
}

export function FiscalYearCard({
    year,
    fiscalYear,
    periods,
    taxPeriods,
    onClosePeriod,
    onReopenPeriod,
    onCreatePeriod,
    isPeriodActionLoading,
    onCloseTaxPeriod,
    onReopenTaxPeriod,
    onOpenDeclaration,
    isTaxActionLoading,
    onPreviewClosing,
    onReopenFiscalYear,
    isFiscalYearLoading,
    onPayF29,
}: FiscalYearCardProps) {
    
    const status = fiscalYear?.status || 'OPEN';
    const isClosed = status === 'CLOSED';

    const closedTaxCount = taxPeriods.filter(p => p.status === 'CLOSED').length;
    const closedAcctCount = periods.filter(p => p.status === 'CLOSED').length;
    const allTaxClosed = taxPeriods.length > 0 && taxPeriods.every(p => p.status === 'CLOSED');
    const allAcctClosed = periods.length > 0 && periods.every(p => p.status === 'CLOSED');
    const canCloseFiscalYear = allTaxClosed && allAcctClosed;

    return (
        <EntityCard className="mb-6 cursor-default">
            <EntityCard.Header
                title={
                    <div className="flex items-center gap-3">
                        <CalendarRange className="w-5 h-5 text-muted-foreground" />
                        <span className=" font-extrabold text-xl uppercase tracking-tighter">
                            Ejercicio {year}
                        </span>
                        <StatusBadge status={status} />
                    </div>
                }
                subtitle={
                    <div className="flex flex-col gap-1.5 mt-1">
                        {isClosed && fiscalYear?.closed_at ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Lock className="w-3 h-3" />
                                Cerrado: {formatPlainDate(fiscalYear.closed_at)}
                                {fiscalYear.closed_by_name && ` por ${fiscalYear.closed_by_name}`}
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                    {allTaxClosed
                                        ? <CheckCircle2 className="w-3 h-3 text-success" />
                                        : <AlertTriangle className="w-3 h-3 text-warning" />
                                    }
                                    F29: {closedTaxCount}/{taxPeriods.length} cerrados
                                </span>
                                <span className="flex items-center gap-1 text-muted-foreground">
                                    {allAcctClosed
                                        ? <CheckCircle2 className="w-3 h-3 text-success" />
                                        : <AlertTriangle className="w-3 h-3 text-warning" />
                                    }
                                    Contable: {closedAcctCount}/{periods.length} cerrados
                                </span>
                            </div>
                        )}
                    </div>
                }
                trailing={
                    <div className="flex items-center gap-2">
                        {!isClosed && (
                            <SubmitButton
                                onClick={() => onPreviewClosing(year)}
                                disabled={!canCloseFiscalYear}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const acct = periods.find(p => p.month === m);
                        const tax = taxPeriods.find(p => p.month === m);
                        return (
                            <CombinedPeriodCard
                                key={m}
                                month={m}
                                year={year}
                                accountingPeriod={acct}
                                taxPeriod={tax}
                                onClosePeriod={onClosePeriod}
                                onReopenPeriod={onReopenPeriod}
                                onCreatePeriod={onCreatePeriod}
                                isPeriodActionLoading={isPeriodActionLoading}
                                onCloseTaxPeriod={onCloseTaxPeriod}
                                onReopenTaxPeriod={onReopenTaxPeriod}
                                onOpenDeclaration={onOpenDeclaration}
                                isTaxActionLoading={isTaxActionLoading}
                                onPayF29={onPayF29}
                            />
                        );
                    })}
                </div>
            </div>
        </EntityCard>
    );
}
