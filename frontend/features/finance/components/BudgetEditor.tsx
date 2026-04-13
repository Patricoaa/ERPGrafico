"use client"

import React, { useState, useEffect } from 'react';
import { BaseModal } from "@/components/shared/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { Info, History, Share2, BarChart2 } from "lucide-react";
import api from '@/lib/api';
import { FORM_STYLES } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface BudgetEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    budget: any;
    onSave: () => void;
}

const months = Array.from({ length: 12 }, (_, i) => i + 1);
const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const BudgetAccountRow = React.memo(({
    account,
    monthlyData,
    onAmountChange,
    onAutoDistribute
}: {
    account: any,
    monthlyData: Record<number, number>,
    onAmountChange: (accountId: number, month: number, val: string) => void,
    onAutoDistribute?: (accountId: number) => void
}) => {
    const accountTotal = months.reduce((sum, m) => sum + (monthlyData?.[m] || 0), 0);

    return (
        <div key={account.id} className="flex items-center border-b hover:bg-muted transition-colors">
            <div className="w-[300px] p-2 border-r flex items-center justify-between group">
                <div>
                    <div className="font-semibold text-sm truncate" title={`${account.code} - ${account.name}`}>
                        {account.code} - {account.name}
                    </div>
                    <div className={FORM_STYLES.label}>{account.account_type_display}</div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Share2 className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAutoDistribute?.(account.id)}>
                            Distribuir Total Equitativamente
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {months.map(m => (
                <div key={m} className="flex-1 border-r p-1 bg-white dark:bg-slate-900/50">
                    <Input
                        type="number"
                        className="h-8 text-[11px] text-right px-1 border-none bg-transparent focus-visible:bg-white dark:focus-visible:bg-slate-950 font-medium"
                        placeholder="0"
                        value={monthlyData?.[m] || ''}
                        onChange={e => onAmountChange(account.id, m, e.target.value)}
                    />
                </div>
            ))}
            <div className="w-[100px] p-2 text-right font-mono text-xs font-bold text-primary">
                {accountTotal.toLocaleString('es-CL')}
            </div>
        </div>
    );
});

BudgetAccountRow.displayName = 'BudgetAccountRow';

export function BudgetEditor({ open, onOpenChange, budget, onSave }: BudgetEditorProps) {
    const [accounts, setAccounts] = useState<any[]>([]);
    // accountId -> month (1-12) -> amount
    const [items, setItems] = useState<Record<number, Record<number, number>>>({});
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');


    useEffect(() => {
        if (open && budget) {
            loadData();
        }
    }, [open, budget]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load only budgetable accounts
            const accRes = await api.get('/accounting/accounts/budgetable/');
            // Load current budget items (we can get them from budget detail or execution endpoint, 
            // or just rely on parent passing them? Parent has "summary" maybe not full list depending on serializer)
            // Let's re-fetch budget to be safe or use execution endpoint which returns "budgeted"
            const execRes = await api.get(`/accounting/budgets/${budget.id}/execution/`);

            const fetchedAccounts = accRes.data.results || accRes.data;
            setAccounts(fetchedAccounts);

            // Map existing items
            const currItems: Record<number, Record<number, number>> = {};
            // The execution endpoint returns 'items' array. 
            // However, we need the raw budget items with month.
            // Let's fetch the budget detail which should have the items.
            const budgetRes = await api.get(`/accounting/budgets/${budget.id}/`);

            // If the budget detail doesn't include items, we might need a specific endpoint 
            // or use the BudgetViewSet if it serializes items.
            // Let's assume BudgetSerializer includes items (BudgetItemSerializer).
            if (budgetRes.data.items) {
                budgetRes.data.items.forEach((item: any) => {
                    if (!currItems[item.account]) currItems[item.account] = {};
                    currItems[item.account][item.month] = parseFloat(item.amount);
                });
            }
            setItems(currItems);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyPreviousYear = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/accounting/budgets/${budget.id}/previous_year_actuals/`);
            const fetchedItems = res.data;
            const newItems: Record<number, Record<number, number>> = {};

            fetchedItems.forEach((item: any) => {
                if (!newItems[item.account]) newItems[item.account] = {};
                newItems[item.account][item.month] = item.amount;
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
            const payload: any[] = [];
            const budgetYear = new Date(budget.start_date).getFullYear();

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

            await api.post(`/accounting/budgets/${budget.id}/set_items/`, { items: payload });
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
            hideScrollArea
            title={
                <div className="flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-primary" />
                    Editar Presupuesto: {budget?.name}
                </div>
            }
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} className="px-8 font-bold">Guardar Presupuesto</Button>
                </>
            }
        >
            <div className="flex flex-col h-full bg-background overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-accent/30 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <Input
                            placeholder="Buscar cuenta por nombre o código..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className={cn(FORM_STYLES.input, "bg-white dark:bg-slate-950")}
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
                    <ScrollArea className="h-full border rounded-lg overflow-hidden shadow-sm">
                        <div className="min-w-[1200px]">
                            <div className="flex bg-muted/50 border-b sticky top-0 z-10 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                                <div className="w-[300px] p-3 border-r bg-muted/50">Cuenta Contable</div>
                                {monthNames.map(m => (
                                    <div key={m} className="flex-1 p-3 text-center border-r bg-muted/50">{m}</div>
                                ))}
                                <div className="w-[100px] p-3 text-center bg-muted/50">Total Anual</div>
                            </div>

                            {loading && (
                                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm text-muted-foreground animate-pulse">Cargando cuentas...</p>
                                </div>
                            )}

                            {!loading && filteredAccounts.map(acc => (
                                <BudgetAccountRow
                                    key={acc.id}
                                    account={acc}
                                    monthlyData={items[acc.id]}
                                    onAmountChange={handleAmountChange}
                                    onAutoDistribute={handleAutoDistribute}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </BaseModal>
    )
}
