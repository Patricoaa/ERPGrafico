"use client"

import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Eye, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const BudgetManager = () => {
    const [budgets, setBudgets] = useState<any[]>([]);
    const [selectedBudget, setSelectedBudget] = useState<any>(null);
    const [executionData, setExecutionData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Form Stats
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newBudget, setNewBudget] = useState({ name: '', start_date: '', end_date: '', description: '' });

    const loadBudgets = async () => {
        setLoading(true);
        try {
            const res = await api.get('/accounting/budgets/');
            setBudgets(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBudgets();
    }, []);

    const viewExecution = async (budget: any) => {
        setSelectedBudget(budget);
        try {
            const res = await api.get(`/accounting/budgets/${budget.id}/execution/`);
            setExecutionData(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async () => {
        try {
            await api.post('/accounting/budgets/', newBudget);
            setIsCreateOpen(false);
            loadBudgets();
            setNewBudget({ name: '', start_date: '', end_date: '', description: '' });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">Gestión de Presupuestos</h3>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Presupuesto</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Presupuesto</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input
                                    value={newBudget.name}
                                    onChange={e => setNewBudget({ ...newBudget, name: e.target.value })}
                                    placeholder="Ej: Presupuesto 2026"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Inicio</Label>
                                    <Input
                                        type="date"
                                        value={newBudget.start_date}
                                        onChange={e => setNewBudget({ ...newBudget, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fin</Label>
                                    <Input
                                        type="date"
                                        value={newBudget.end_date}
                                        onChange={e => setNewBudget({ ...newBudget, end_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input
                                    value={newBudget.description}
                                    onChange={e => setNewBudget({ ...newBudget, description: e.target.value })}
                                />
                            </div>
                            <Button onClick={handleCreate} className="w-full">Guardar</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Presupuestos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {budgets.length === 0 && <p className="text-muted-foreground text-sm">No hay presupuestos.</p>}
                        {budgets.map(b => (
                            <div
                                key={b.id}
                                className={`p-3 border rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedBudget?.id === b.id ? 'bg-slate-100 dark:bg-slate-800 ring-2 ring-primary' : ''}`}
                                onClick={() => viewExecution(b)}
                            >
                                <div className="font-semibold">{b.name}</div>
                                <div className="text-xs text-muted-foreground">{b.start_date} - {b.end_date}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>
                            {selectedBudget ? `Ejecución: ${selectedBudget.name}` : 'Detalle de Ejecución'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!selectedBudget && <div className="text-center py-8 text-muted-foreground">Seleccione un presupuesto para ver su ejecución</div>}

                        {selectedBudget && executionData && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-sm text-muted-foreground">Presupuestado</div>
                                        <div className="font-bold">{executionData.summary.total_budgeted.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Ejecutado</div>
                                        <div className="font-bold">{executionData.summary.total_actual.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Desviación</div>
                                        <div className={`font-bold ${executionData.summary.total_variance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {executionData.summary.total_variance.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                        </div>
                                    </div>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cuenta</TableHead>
                                            <TableHead className="text-right">Presupuesto</TableHead>
                                            <TableHead className="text-right">Real</TableHead>
                                            <TableHead className="text-center">%</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {executionData.items.map((item: any, idx: number) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <div className="font-medium">{item.account_name}</div>
                                                    <div className="text-xs text-muted-foreground">{item.account_code}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {item.budgeted.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {item.actual.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                </TableCell>
                                                <TableCell className="w-[150px]">
                                                    <div className="flex items-center space-x-2">
                                                        <Progress value={Math.min(item.percentage, 100)} className="h-2" />
                                                        <span className="text-xs w-8">{item.percentage.toFixed(0)}%</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
