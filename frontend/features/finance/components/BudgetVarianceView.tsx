"use client"

import React, { useState, useEffect, useMemo } from 'react';
import api from "@/lib/api";
import { 
    AppWindow, 
    CalendarBlank, 
    FileArrowDown, 
    ChartLineUp, 
    TrendDown, 
    TrendUp,
    Target
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { BudgetVarianceTable, BudgetVarianceNode } from "./BudgetVarianceTable";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function BudgetVarianceView() {
    const [budgets, setBudgets] = useState<any[]>([]);
    const [selectedBudget, setSelectedBudget] = useState<string>("");
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [data, setData] = useState<BudgetVarianceNode[]>([]);
    const [loading, setLoading] = useState(false);

    // Load available budgets
    useEffect(() => {
        loadBudgets();
    }, []);

    // Load variance data when selection changes
    useEffect(() => {
        if (selectedBudget) {
            loadVariance();
        }
    }, [selectedBudget, selectedMonth, selectedYear]);

    const loadBudgets = async () => {
        try {
            const res = await api.get('/accounting/budgets/');
            const fetched = res.data.results || res.data;
            setBudgets(fetched);
            if (fetched.length > 0 && !selectedBudget) {
                setSelectedBudget(fetched[0].id.toString());
            }
        } catch (err) {
            console.error(err);
            toast.error("Error al cargar presupuestos");
        }
    };

    const loadVariance = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/accounting/budgets/${selectedBudget}/variance/`, {
                params: {
                    month: selectedMonth,
                    year: selectedYear
                }
            });
            setData(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Error al cargar reporte de variaciones");
        } finally {
            setLoading(false);
        }
    };

    // Calculate top-level summary sums from the tree
    const summary = useMemo(() => {
        if (!data.length) return null;
        
        let ma = 0, mb = 0, ya = 0, yb = 0;
        // The tree has top-level accounts (groups like 4, 5, 6 - Income, Expenses, etc.)
        // We sum them up based on their type to get a "Result" summary or just total activity.
        // Usually we want: Net Margin/Result = Income - Expenses
        data.forEach(node => {
            // This is a naive sum, but works for identifying top-level movement
            // For a proper financial summary, we'd filter by income/expense type
            if (node.type === 'INCOME') {
                ma += node.month_actual;
                mb += node.month_budget;
                ya += node.ytd_actual;
                yb += node.ytd_budget;
            } else if (node.type === 'EXPENSE') {
                ma -= node.month_actual;
                mb -= node.month_budget;
                ya -= node.ytd_actual;
                yb -= node.ytd_budget;
            }
        });

        return { 
            month_actual: ma, 
            month_budget: mb, 
            month_variance: ma - mb,
            month_perc: mb !== 0 ? (ma / mb * 100) : 0,
            ytd_actual: ya, 
            ytd_budget: yb,
            ytd_variance: ya - yb,
            ytd_perc: yb !== 0 ? (ya / yb * 100) : 0
        };
    }, [data]);

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Versus Presupuestario"
                description="Análisis de ejecución mensual y acumulada contra el presupuesto."
                titleActions={
                    <div className="flex items-center gap-3">
                        <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                            <SelectTrigger className="w-[200px] h-9 bg-background">
                                <Target className="mr-2 h-4 w-4 text-primary" />
                                <SelectValue placeholder="Seleccionar Presupuesto" />
                            </SelectTrigger>
                            <SelectContent>
                                {budgets.map(b => (
                                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                            <SelectTrigger className="w-[140px] h-9 bg-background">
                                <CalendarBlank className="mr-2 h-4 w-4 text-primary" />
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTH_NAMES.map((name, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-[100px] h-9 bg-background">
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026].map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button variant="outline" size="sm" className="h-9">
                            <FileArrowDown className="mr-2 h-4 w-4" />
                            Exportar
                        </Button>
                    </div>
                }
            />

            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-primary">
                        <CardContent className="pt-6">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Margen Mes</p>
                            <MoneyDisplay amount={summary.month_actual} className="text-2xl font-heading font-bold" />
                            <div className="mt-2 flex items-center gap-1.5">
                                {summary.month_variance >= 0 ? <TrendUp className="text-emerald-500" /> : <TrendDown className="text-destructive" />}
                                <span className={cn("text-xs font-bold", summary.month_variance >= 0 ? "text-emerald-500" : "text-destructive")}>
                                    {summary.month_perc.toFixed(1)}% ejecución
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Presupuesto Mes</p>
                            <MoneyDisplay amount={summary.month_budget} showColor={false} className="text-2xl font-heading font-bold opacity-80" />
                            <p className="text-[10px] text-muted-foreground mt-2">Projection objetivos periodo</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-primary bg-primary/5">
                        <CardContent className="pt-6">
                            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1 text-opacity-80">Margen YTD (Acum.)</p>
                            <MoneyDisplay amount={summary.ytd_actual} className="text-2xl font-heading font-bold" />
                            <div className="mt-2 flex items-center gap-1.5">
                                {summary.ytd_variance >= 0 ? <TrendUp className="text-emerald-500" /> : <TrendDown className="text-destructive" />}
                                <span className={cn("text-xs font-bold", summary.ytd_variance >= 0 ? "text-emerald-500" : "text-destructive")}>
                                    {summary.ytd_perc.toFixed(1)}% objetivos YTD
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Desviación Neta YTD</p>
                            <MoneyDisplay amount={summary.ytd_variance} className="text-2xl font-heading font-bold" />
                            <p className="text-[10px] text-muted-foreground mt-2">Diferencia acumulada anual</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <BudgetVarianceTable data={data} loading={loading} />
        </div>
    );
}
