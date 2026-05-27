"use client"
 
import React, { useState } from 'react';
import { useTrialBalance } from '../../hooks/useTrialBalance';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calculator, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { SkeletonShell, PeriodValidationDateInput, DataCell } from '@/components/shared';

export function TrialBalanceView() {
    // Default dates: current year start to now
    const now = new Date();
    const currentYear = now.getFullYear();
    const defaultStart = `${currentYear}-01-01`;
    const defaultEnd = now.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);

    const { data, isLoading } = useTrialBalance(startDate, endDate);

    return (
        <SkeletonShell isLoading={isLoading && !data} ariaLabel="Cargando balance de comprobación">
            <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Filters Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-muted/30 p-4 rounded-md border border-border/50">
                <PeriodValidationDateInput
                    label="Desde"
                    date={startDate ? new Date(startDate + 'T12:00:00') : undefined}
                    onDateChange={(d) => {
                        if (!d) {
                            setStartDate("")
                            return
                        }
                        setStartDate(d.toISOString().split('T')[0])
                    }}
                    className="w-full md:w-auto"
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    validationType="accounting"
                />
                <PeriodValidationDateInput
                    label="Hasta"
                    date={endDate ? new Date(endDate + 'T12:00:00') : undefined}
                    onDateChange={(d) => {
                        if (!d) {
                            setEndDate("")
                            return
                        }
                        setEndDate(d.toISOString().split('T')[0])
                    }}
                    className="w-full md:w-auto"
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    validationType="accounting"
                />
                <div className="flex-1" />

                {data && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${data.is_balanced
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
                                        <td className="px-4 py-2.5">
                                            <DataCell.Code value={acc.code} className="text-left justify-start" />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <DataCell.Text className="text-left justify-start font-medium text-foreground">{acc.name}</DataCell.Text>
                                        </td>
                                        <td className="px-4 py-2.5 bg-primary/5">
                                            <DataCell.Currency value={acc.initial_balance} showZeroAsDash className="text-right justify-end font-medium" />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <DataCell.Currency value={acc.debit} showZeroAsDash className="text-right justify-end text-muted-foreground group-hover:text-foreground transition-colors" />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <DataCell.Currency value={acc.credit} showZeroAsDash className="text-right justify-end text-muted-foreground group-hover:text-foreground transition-colors" />
                                        </td>
                                        <td className="px-4 py-2.5 bg-primary/5">
                                            <DataCell.Currency value={acc.closing_balance} showZeroAsDash className="text-right justify-end font-bold" />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <DataCell.Currency value={acc.saldo_deudor} showZeroAsDash className="text-right justify-end font-medium text-success" />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <DataCell.Currency value={acc.saldo_acreedor} showZeroAsDash className="text-right justify-end font-medium text-warning" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {data && (
                                <tfoot className="bg-muted/80 border-t-2 border-border/80">
                                    <tr className="font-bold">
                                        <td colSpan={3} className="px-4 py-4 text-xs text-right uppercase tracking-wider">Totales de Control</td>
                                        <td className="px-4 py-4 border-x border-border/20">
                                            <DataCell.Currency value={data.total_debit} className="text-right justify-end font-bold" />
                                        </td>
                                        <td className="px-4 py-4 border-x border-border/20">
                                            <DataCell.Currency value={data.total_credit} className="text-right justify-end font-bold" />
                                        </td>
                                        <td className="px-4 py-4 bg-primary/10 text-center text-xs font-mono font-bold">—</td>
                                        <td className="px-4 py-4 border-x border-border/20">
                                            <DataCell.Currency value={data.total_saldo_deudor} className="text-right justify-end font-bold text-success" />
                                        </td>
                                        <td className="px-4 py-4 border-x border-border/20">
                                            <DataCell.Currency value={data.total_saldo_acreedor} className="text-right justify-end font-bold text-warning" />
                                        </td>
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
        </SkeletonShell>
    );
}
