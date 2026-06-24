"use client"

import React, { useState, useEffect } from 'react';
import { BaseModal, DataCell, MoneyDisplay, SkeletonShell, FormFooter, CancelButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { Info, History, Split, BarChart2 } from "lucide-react"
import { parseDateOnly } from "@/lib/utils";
import { useServerDate } from '@/hooks/useServerDate';
import { financeApi } from "../api/financeApi";
import { cn } from "@/lib/utils";

interface BudgetEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    budget: { id: number; name: string; start_date: string } | null;
    onSave: () => void;
}

interface BudgetAccount {
    id: number;
    code: string;
    name: string;
    account_type_display: string;
}

interface BudgetItem {
    account: number;
    month: number;
    amount: string | number;
}

const months = Array.from({ length: 12 }, (_, i) => i + 1);
const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const BudgetAccountRow = React.memo(({
    account,
    monthlyData,
    onAmountChange,
    onAutoDistribute
}: {
    account: BudgetAccount,
    monthlyData: Record<number, number>,
    onAmountChange: (accountId: number, month: number, val: string) => void,
    onAutoDistribute?: (accountId: number) => void
}) => {
    const accountTotal = months.reduce((sum, m) => sum + (monthlyData?.[m] || 0), 0);

    return (
        <div key={account.id} className="flex items-center border-b hover:bg-muted transition-colors">
            <div className="w-[300px] p-2 border-r flex items-center justify-between group">
                <div>
                    <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="font-semibold text-sm truncate">
                                        {account.code} - {account.name}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">{account.code} - {account.name}</TooltipContent>
                            </Tooltip>
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{account.account_type_display}</div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DataCell.Action
                        icon={Split}
                        title="Distribuir Total Equitativamente"
                        onClick={() => onAutoDistribute?.(account.id)}
                    />
                </div>
            </div>
            {months.map(m => (
                <div key={m} className="flex-1 border-r p-1 bg-card/10">
                    <Input
                        type="number"
                        className="h-8 text-[11px] text-right px-1 border-none bg-transparent focus-visible:bg-accent/40 font-medium"
                        placeholder="0"
                        value={monthlyData?.[m] || ''}
                        onChange={e => onAmountChange(account.id, m, e.target.value)}
                    />
                </div>
            ))}
            <div className="w-[100px] p-2 text-right font-mono text-xs font-bold text-primary">
                <MoneyDisplay amount={accountTotal} />
            </div>
        </div>
    );
});

BudgetAccountRow.displayName = 'BudgetAccountRow';

export function BudgetEditor({ open, onOpenChange, budget, onSave }: BudgetEditorProps) {
    const { serverDate } = useServerDate();
    const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
    // accountId -> month (1-12) -> amount
    const [items, setItems] = useState<Record<number, Record<number, number>>>({});
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');


    const loadData = async () => {
        if (!budget) return;
        setLoading(true);
        try {
            const accData = await financeApi.getBudgetableAccounts();
            await financeApi.getBudgetExecution(budget.id);

            const fetchedAccounts = (accData as any).results || accData;
            setAccounts(fetchedAccounts);

            const currItems: Record<number, Record<number, number>> = {};
            const budgetData = await financeApi.getBudgetDetail(budget.id);

            if ((budgetData as any).items) {
                (budgetData as any).items.forEach((item: BudgetItem) => {
                    if (!currItems[item.account]) currItems[item.account] = {};
                    currItems[item.account][item.month] = parseFloat(String(item.amount));
                });
            }
            setItems(currItems);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && budget) {
            requestAnimationFrame(() => {
                loadData();
            })
        }
    }, [open, budget]);

    const handleCopyPreviousYear = async () => {
        if (!budget) return;
        setLoading(true);
        try {
            const fetchedItems = await financeApi.getBudgetPreviousYearActuals(budget.id);
            const newItems: Record<number, Record<number, number>> = {};

            fetchedItems.forEach((item: BudgetItem) => {
                if (!newItems[item.account]) newItems[item.account] = {};
                newItems[item.account][item.month] = Number(item.amount);
            });

            setItems(prev => ({ ...prev, ...newItems }));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoDistribute = (accountId: number) => {
        const total = months.reduce((sum, m) => sum + (items[accountId]?.[m] || 0), 0);
        if (total === 0) return;

        const monthly = Math.round(total / 12);
        const newMonthlyData: Record<number, number> = {};
        months.forEach(m => {
            newMonthlyData[m] = monthly;
        });

        setItems(prev => ({
            ...prev,
            [accountId]: newMonthlyData
        }));
    };

    const handleAmountChange = React.useCallback((accountId: number, month: number, val: string) => {
        const num = parseFloat(val);
        setItems(prev => {
            const currentAccData = prev[accountId] || {};
            const newVal = isNaN(num) ? 0 : num;
            if (currentAccData[month] === newVal) return prev;

            return {
                ...prev,
                [accountId]: {
                    ...currentAccData,
                    [month]: newVal
                }
            };
        });
    }, []);

    const handleSave = async () => {
        try {
            const payload: Array<Record<string, unknown>> = [];
            const budgetYear = budget ? parseDateOnly(budget.start_date).getFullYear() : (serverDate ?? new Date()).getFullYear();

            Object.entries(items).forEach(([accId, monthlyData]) => {
                Object.entries(monthlyData).forEach(([month, amount]) => {
                    if (amount > 0) {
                        payload.push({
                            account: parseInt(accId),
                            year: budgetYear,
                            month: parseInt(month),
                            amount: amount
                        });
                    }
                });
            });

            if (budget) {
                await financeApi.setBudgetItems(budget.id, payload);
            }
            onOpenChange(false);
            onSave();
        } catch (error) {
            console.error(error);
        }
    };

    // Filter accounts
    const filteredAccounts = accounts.filter(acc =>
        acc.name.toLowerCase().includes(filter.toLowerCase()) ||
        acc.code.includes(filter)
    );

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            icon={BarChart2}
            title={`Editar Presupuesto: ${budget?.name || ""}`}
            description="Planificación Financiera • Control de Gestión"
            hideScrollArea
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <Button onClick={handleSave} className="px-8 font-bold ">
                                Guardar Presupuesto
                            </Button>
                        </>
                    }
                />
            }
        >
            <div className="flex flex-col h-full bg-background overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-accent/30 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <Input
                            placeholder="Buscar cuenta por nombre o código..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className={cn("h-9 text-sm bg-background border border-border rounded-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "bg-background")}
                        />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help hover:text-primary transition-colors">
                                        <Info className="h-4 w-4" />
                                        <span>Cuentas Presupuestables</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                    <p className="font-semibold mb-1">Criterios de Filtrado:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Cuentas de <strong>Ingresos</strong> y <strong>Gastos</strong>.</li>
                                        <li>Cuentas de <strong>Activos Fijos</strong> (Inversiones).</li>
                                        <li>Solo se muestran cuentas de último nivel (sin subcuentas).</li>
                                    </ul>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyPreviousYear}
                            disabled={loading}
                            className="h-9 px-4"
                        >
                            <History className="h-4 w-4 mr-2 text-primary" />
                            Cargar Real Año Anterior
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-4">
                    <ScrollArea className="h-full border rounded-md overflow-hidden shadow-card">
                        <div className="min-w-[1200px]">
                            <div className="flex bg-muted/50 border-b sticky top-0 z-10 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                                <div className="w-[300px] p-3 border-r bg-muted/50">Cuenta Contable</div>
                                {monthNames.map(m => (
                                    <div key={m} className="flex-1 p-3 text-center border-r bg-muted/50">{m}</div>
                                ))}
                                <div className="w-[100px] p-3 text-center bg-muted/50">Total Anual</div>
                            </div>

                            <SkeletonShell isLoading={loading} ariaLabel="Cargando cuentas presupuestables">
                                {filteredAccounts.map(acc => (
                                    <BudgetAccountRow
                                        key={acc.id}
                                        account={acc}
                                        monthlyData={items[acc.id]}
                                        onAmountChange={handleAmountChange}
                                        onAutoDistribute={handleAutoDistribute}
                                    />
                                ))}
                            </SkeletonShell>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </BaseModal>
    )
}
