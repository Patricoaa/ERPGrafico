"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

interface DashboardTrendChartProps {
    data: any[]
}

export function DashboardTrendChart({ data }: DashboardTrendChartProps) {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Tendencia Mensual de Conciliación</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data}>
                        <XAxis
                            dataKey="month"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                        Total Líneas
                                                    </span>
                                                    <span className="font-bold text-muted-foreground">
                                                        {payload[0].value}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                        Conciliadas
                                                    </span>
                                                    <span className="font-bold text-green-600">
                                                        {payload[1].value}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            }}
                        />
                        <Legend />
                        <Bar
                            dataKey="total_lines"
                            name="Total Líneas"
                            fill="#e5e7eb" // gray-200
                            radius={[4, 4, 0, 0]}
                        />
                        <Bar
                            dataKey="reconciled_lines"
                            name="Conciliadas"
                            fill="#16a34a" // green-600
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
