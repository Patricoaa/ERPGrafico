"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useTrialBalance } from '../../hooks/useTrialBalance';
import { LoadingFallback } from '@/components/shared/LoadingFallback';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calculator, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { LAYOUT_TOKENS } from '@/lib/styles';

export function TrialBalanceView() {
    const { data, isLoading, fetchTrialBalance } = useTrialBalance();
    
    // Default dates: current year start to now
    const now = new Date();
    const currentYear = now.getFullYear();
    const defaultStart = `${currentYear}-01-01`;
    const defaultEnd = now.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);

    useEffect(() => {
        fetchTrialBalance(startDate, endDate);
    }, [fetchTrialBalance, startDate, endDate]);

    const formatNum = (val: number) => {
        return val === 0 ? '—' : formatCurrency(val);
    };

    if (isLoading && !data) {
        return <LoadingFallback variant="card" message="Calculando balance de comprobación..." />;
    }

    return (
        <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Filters Header */}
            <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="grid gap-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Desde
                    </label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                </div>
                <div className="grid gap-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Hasta
                    </label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                </div>
                <div className="flex-1" />
                
                {data && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                        data.is_balanced 
                            ? 'bg-success/10 text-success border-success/20' 
                            : 'bg-warning/10 text-warning border-warning/20'
                    }`}>
                        {data.is_balanced ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Partida Doble Cuadrada</>
                        ) : (
                            <><AlertCircle className="w-3.5 h-3.5" /> Diferencia en Saldos</>
                        )}
                    </div>
                )}
            </div>

            {/* Main Report Card */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
                <ScrollArea className="w-full">
                    <div className="min-w-[1000px]">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border/50">
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Código</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cuenta</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-primary/5">Saldo Inicial</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Débitos</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Créditos</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-primary/5">Saldo Final</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-success">Deudor</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-warning">Acreedor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {data?.accounts.map((acc) => (
                                    <tr key={acc.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{acc.code}</td>
                                        <td className="px-4 py-2.5 text-xs font-medium text-foreground">{acc.name}</td>
                                        <td className="px-4 py-2.5 text-xs text-right bg-primary/5 font-medium">{formatNum(acc.initial_balance)}</td>
                                        <td className="px-4 py-2.5 text-xs text-right text-muted-foreground group-hover:text-foreground">{formatNum(acc.debit)}</td>
                                        <td className="px-4 py-2.5 text-xs text-right text-muted-foreground group-hover:text-foreground">{formatNum(acc.credit)}</td>
                                        <td className="px-4 py-2.5 text-xs text-right bg-primary/5 font-bold">{formatNum(acc.closing_balance)}</td>
                                        <td className="px-4 py-2.5 text-xs text-right font-medium text-success">{formatNum(acc.saldo_deudor)}</td>
                                        <td className="px-4 py-2.5 text-xs text-right font-medium text-warning">{formatNum(acc.saldo_acreedor)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {data && (
                                <tfoot className="bg-muted/80 border-t-2 border-border/80">
                                    <tr className="font-bold">
                                        <td colSpan={3} className="px-4 py-4 text-xs text-right uppercase tracking-wider">Totales de Control</td>
                                        <td className="px-4 py-4 text-xs text-right border-x border-border/20">{formatCurrency(data.total_debit)}</td>
                                        <td className="px-4 py-4 text-xs text-right border-x border-border/20">{formatCurrency(data.total_credit)}</td>
                                        <td className="px-4 py-4 text-xs text-right bg-primary/10">—</td>
                                        <td className="px-4 py-4 text-xs text-right border-x border-border/20 text-success">{formatCurrency(data.total_saldo_deudor)}</td>
                                        <td className="px-4 py-4 text-xs text-right border-x border-border/20 text-warning">{formatCurrency(data.total_saldo_acreedor)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </ScrollArea>
                
                {(!data || data.accounts.length === 0) && !isLoading && (
                    <div className="py-12">
                        <EmptyState 
                            title="No hay movimientos en este periodo"
                            description="Ajusta las fechas para visualizar el balance de comprobación."
                        />
                    </div>
                )}
            </Card>

            <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1">
                <div className="flex items-center gap-2">
                    <Calculator className="w-3 h-3" />
                    Generado automáticamente desde el Libro Mayor
                </div>
                <div>
                   Todos los importes expresados en moneda nacional (CLP)
                </div>
            </div>
        </div>
    );
}
