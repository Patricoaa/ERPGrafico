"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { financeApi } from "../api/financeApi";
import {
    CalendarDays,
    FileDown,
    Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { BudgetVarianceTable, BudgetVarianceNode } from "./BudgetVarianceTable";
import { EmptyState, StatCard } from "@/components/shared";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function BudgetVarianceView() {
    const [budgets, setBudgets] = useState<Array<{ id: number; name: string }>>([]);
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
            const budgetsData = await financeApi.getBudgets();
            const fetched = (budgetsData as any).results || budgetsData;
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
            const varianceData = await financeApi.getBudgetVariance(Number(selectedBudget), {
                month: selectedMonth,
                year: selectedYear
            });
            setData(varianceData);
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
                                <CalendarDays className="mr-2 h-4 w-4 text-primary" />
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
                            <FileDown className="mr-2 h-4 w-4" />
                            Exportar
                        </Button>
                    </div>
                }
            />

             {summary && (
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <StatCard
                         label="Margen Mes"
                         value={<MoneyDisplay amount={summary.month_actual} />}
                         trend={{
                             direction: summary.month_variance >= 0 ? "up" : "down",
                             value: `${summary.month_perc.toFixed(1)}% ejecución`,
                         }}
                         accent="primary"
                     />
                     <StatCard
                         label="Presupuesto Mes"
                         value={<MoneyDisplay amount={summary.month_budget} showColor={false} />}
                         subtext="Projection objetivos periodo"
                         accent="muted"
                     />
                     <StatCard
                         label="Margen YTD (Acum.)"
                         value={<MoneyDisplay amount={summary.ytd_actual} />}
                         trend={{
                             direction: summary.ytd_variance >= 0 ? "up" : "down",
                             value: `${summary.ytd_perc.toFixed(1)}% objetivos YTD`,
                         }}
                         accent="primary"
                         className="bg-primary/5"
                     />
                     <StatCard
                         label="Desviación Neta YTD"
                         value={<MoneyDisplay amount={summary.ytd_variance} />}
                         subtext="Diferencia acumulada anual"
                         accent="muted"
                     />
                 </div>
             )}

             {!loading && data.length === 0 ? (
                 <EmptyState 
                     context="finance" 
                     title="Sin datos presupuestarios" 
                     description="No se encontraron datos para el periodo seleccionado." 
                 />
             ) : (
                 <BudgetVarianceTable data={data} loading={loading} />
             )}
        </div>
    );
}
