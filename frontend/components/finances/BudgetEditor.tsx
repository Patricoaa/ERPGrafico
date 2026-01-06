"use client"

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import api from '@/lib/api';

interface BudgetEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    budget: any;
    onSave: () => void;
}

export function BudgetEditor({ open, onOpenChange, budget, onSave }: BudgetEditorProps) {
    const [accounts, setAccounts] = useState<any[]>([]);
    // accountId -> month (1-12) -> amount
    const [items, setItems] = useState<Record<number, Record<number, number>>>({});
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    useEffect(() => {
        if (open && budget) {
            loadData();
        }
    }, [open, budget]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Accounts
            const accRes = await api.get('/accounting/accounts/');
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

    const handleAmountChange = (accountId: number, month: number, val: string) => {
        const num = parseFloat(val);
        setItems(prev => ({
            ...prev,
            [accountId]: {
                ...(prev[accountId] || {}),
                [month]: isNaN(num) ? 0 : num
            }
        }));
    };

    const handleSave = async () => {
        try {
            const payload: any[] = [];
            Object.entries(items).forEach(([accId, monthlyData]) => {
                Object.entries(monthlyData).forEach(([month, amount]) => {
                    if (amount > 0) {
                        payload.push({
                            account: parseInt(accId),
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] lg:max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Editar Presupuesto: {budget?.name}</DialogTitle>
                </DialogHeader>

                <div className="p-2">
                    <Input
                        placeholder="Buscar cuenta..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>

                <ScrollArea className="flex-1 border rounded-md">
                    <div className="min-w-[1200px]">
                        <div className="flex bg-slate-50 dark:bg-slate-900 border-b sticky top-0 z-10 font-medium">
                            <div className="w-[300px] p-2 border-r">Cuenta</div>
                            {monthNames.map(m => (
                                <div key={m} className="flex-1 p-2 text-center text-xs border-r">{m}</div>
                            ))}
                            <div className="w-[100px] p-2 text-center text-xs">Total</div>
                        </div>

                        {loading && <div className="text-center p-8">Cargando cuentas...</div>}

                        {!loading && filteredAccounts.map(acc => {
                            const accountTotal = months.reduce((sum, m) => sum + (items[acc.id]?.[m] || 0), 0);
                            return (
                                <div key={acc.id} className="flex items-center border-b hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="w-[300px] p-2 border-r">
                                        <div className="font-semibold text-sm truncate" title={`${acc.code} - ${acc.name}`}>
                                            {acc.code} - {acc.name}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground uppercase">{acc.account_type_display}</div>
                                    </div>
                                    {months.map(m => (
                                        <div key={m} className="flex-1 border-r p-1">
                                            <Input
                                                type="number"
                                                className="h-8 text-[11px] text-right px-1 border-none bg-transparent focus-visible:bg-white dark:focus-visible:bg-slate-950"
                                                placeholder="0"
                                                value={items[acc.id]?.[m] || ''}
                                                onChange={e => handleAmountChange(acc.id, m, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                    <div className="w-[100px] p-2 text-right font-mono text-xs font-bold text-primary">
                                        {accountTotal.toLocaleString('es-CL')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
