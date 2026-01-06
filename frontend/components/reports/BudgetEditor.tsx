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
    const [items, setItems] = useState<Record<number, number>>({});
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
            // Load Accounts
            const accRes = await api.get('/accounting/accounts/');
            // Load current budget items (we can get them from budget detail or execution endpoint, 
            // or just rely on parent passing them? Parent has "summary" maybe not full list depending on serializer)
            // Let's re-fetch budget to be safe or use execution endpoint which returns "budgeted"
            const execRes = await api.get(`/accounting/budgets/${budget.id}/execution/`);

            const fetchedAccounts = accRes.data.results || accRes.data;
            setAccounts(fetchedAccounts);

            // Map existing items
            const currItems: Record<number, number> = {};
            // The execution endpoint returns 'items' array with 'account_id' and 'budgeted'
            execRes.data.items.forEach((item: any) => {
                if (item.budgeted > 0) {
                    currItems[item.account_id] = item.budgeted;
                }
            });
            setItems(currItems);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAmountChange = (accountId: number, val: string) => {
        const num = parseFloat(val);
        setItems(prev => ({
            ...prev,
            [accountId]: isNaN(num) ? 0 : num
        }));
    };

    const handleSave = async () => {
        try {
            const payload = Object.entries(items).map(([accId, amount]) => ({
                account: parseInt(accId),
                amount: amount
            }));

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
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
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

                <ScrollArea className="flex-1 p-2 border rounded-md">
                    <div className="space-y-2">
                        {loading && <div className="text-center p-4">Cargando cuentas...</div>}
                        {!loading && filteredAccounts.map(acc => (
                            <div key={acc.id} className="flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border-b">
                                <div className="flex-1">
                                    <div className="font-semibold">{acc.code} - {acc.name}</div>
                                    <div className="text-xs text-muted-foreground">{acc.account_type_display}</div>
                                </div>
                                <div className="w-[150px]">
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={items[acc.id] || ''}
                                        onChange={e => handleAmountChange(acc.id, e.target.value)}
                                        className="text-right"
                                    />
                                </div>
                            </div>
                        ))}
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
