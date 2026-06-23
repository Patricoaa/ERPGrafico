"use client"

import { formatCurrency } from "@/lib/money"
import React from "react"
import { Drawer, StatCard } from "@/components/shared"

import {
    TrendingUp,
    PieChart as PieChartIcon,
    Building2,
    BarChart3
} from "lucide-react"
import { PieChart, BarChart } from "@/components/shared"

// Categorical data-viz palette (CMYK process inks). NOT semantic state. See color-system.md §8.
import { Partner, PartnerSummary } from "@/features/contacts/types/partner"

interface EquityStatsDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    partners: Partner[]
    summary: PartnerSummary
}

export function EquityStatsDrawer({ open, onOpenChange, partners, summary }: EquityStatsDrawerProps) {
    if (!summary || !partners) return null

    // Prepare data for Pie Chart (Ownership)
    const pieData = partners
        .filter(p => parseFloat(p.partner_equity_percentage) > 0)
        .map(p => ({
            id: p.name,
            value: parseFloat(p.partner_net_equity),
        }))

    // Prepare data for Bar Chart (Paid vs Pending)
    const barData = partners.map(p => ({
        name: p.name.split(' ')[0], // Short name
        paid: parseFloat(p.partner_total_paid_in),
        pending: parseFloat(p.partner_pending_capital)
    }))

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="right"
            showOverlay={false}
            defaultSize="90vw"
            className="p-0 flex flex-col"
            icon={BarChart3}
            title="Análisis Societario"
            subtitle="Estadísticas de Composición"
            contentClassName="flex flex-col overflow-hidden"
        >
            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                {/* General Summary Metrics */}
                <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                    <StatCard
                        label="Patrimonio Neto"
                        value={formatCurrency(summary.total_net_equity || 0)}
                        subtext="Valor Libro de la Compañía"
                        variant="minimal"
                        accent="primary"
                        className="p-5 justify-center"
                    />
                </div>

                {/* Chart 1: Equity Ownership */}
                <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-700 delay-100">
                    <div className="flex items-center gap-2 opacity-80">
                        <PieChartIcon className="h-4 w-4" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest">Participación Patrimonial</h3>
                    </div>
                    <div className="h-64 bg-background border border-border rounded-md p-4">
                        <PieChart
                            data={pieData}
                            legends={[
                                {
                                    anchor: "bottom",
                                    direction: "row",
                                    translateY: 50,
                                    itemWidth: 100,
                                    itemHeight: 18,
                                    itemTextColor: "var(--muted-foreground)",
                                    symbolSize: 10,
                                    symbolShape: "circle",
                                },
                            ]}
                        />
                    </div>
                </div>

                {/* Chart 2: Paid vs Pending Capital */}
                <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-1000 delay-200">
                    <div className="flex items-center gap-2 opacity-80">
                        <TrendingUp className="h-4 w-4" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest">Capital Enterado vs Pendiente</h3>
                    </div>
                    <div className="h-64 bg-background border border-border rounded-md p-4">
                        <BarChart
                            data={barData}
                            keys={["paid", "pending"]}
                            indexBy="name"
                            groupMode="stacked"
                            axisBottom={{
                                tickSize: 0,
                                tickPadding: 10,
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 10,
                                format: (v: number) => `$${v / 1000}k`,
                            }}
                            legends={[
                                {
                                    dataFrom: "keys",
                                    anchor: "bottom",
                                    direction: "row",
                                    translateY: 50,
                                    itemWidth: 100,
                                    itemHeight: 18,
                                    symbolSize: 10,
                                    symbolShape: "circle",
                                },
                            ]}
                        />
                    </div>
                </div>
            </div>
        </Drawer>
    )
}
