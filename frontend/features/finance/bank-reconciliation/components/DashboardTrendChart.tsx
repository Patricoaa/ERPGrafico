"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveBar } from "@nivo/bar"
import type { TrendItem } from "../types"

interface DashboardTrendChartProps {
    data: TrendItem[]
}

export function DashboardTrendChart({ data }: DashboardTrendChartProps) {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Tendencia Mensual de Conciliación</CardTitle>
            </CardHeader>
            <CardContent className="pl-2" style={{ height: 350 }}>
                <ResponsiveBar
                    data={data as unknown as { month: string; total_lines: number; reconciled_lines: number }[]}
                    keys={["total_lines", "reconciled_lines"]}
                    indexBy="month"
                    groupMode="grouped"
                    padding={0.3}
                    colors={["var(--muted)", "var(--success)"]}
                    borderRadius={4}
                    axisBottom={{
                        tickSize: 0,
                        tickPadding: 12,
                    }}
                    axisLeft={{
                        tickSize: 0,
                        tickPadding: 12,
                        format: (v) => `${v}`,
                    }}
                    tooltip={({ id, value, color }) => (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {id === "total_lines" ? "Total Líneas" : "Conciliadas"}
                                </span>
                                <span className="font-bold">{value}</span>
                            </div>
                        </div>
                    )}
                    legends={[
                        {
                            dataFrom: "keys",
                            anchor: "bottom-right",
                            direction: "row",
                            itemWidth: 130,
                            itemHeight: 20,
                            symbolSize: 12,
                            symbolShape: "square",
                        },
                    ]}
                />
            </CardContent>
        </Card>
    )
}
