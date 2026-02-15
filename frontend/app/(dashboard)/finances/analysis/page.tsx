"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DateRangeSelector } from "@/components/finances/DateRangeSelector"
import { DateRange } from "react-day-picker"
import { startOfYear, subYears } from "date-fns"
import { PageTabs } from "@/components/shared/PageTabs"
import { PieChart, Activity } from "lucide-react"
import { useServerDate } from "@/hooks/useServerDate"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

const RatiosView = dynamic(() => import("@/components/finances/RatiosView").then(mod => mod.RatiosView), {
    ssr: false,
    loading: () => <LoadingFallback message="Cargando análisis..." />
})

const BIAnalyticsView = dynamic(() => import("@/components/finances/BIAnalyticsView").then(mod => mod.BIAnalyticsView), {
    ssr: false,
    loading: () => <LoadingFallback message="Cargando BI..." />
})

export default function AnalysisPage() {
    const [showComparison, setShowComparison] = useState(false);

    // Date State
    const { serverDate } = useServerDate()
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfYear(new Date()),
        to: new Date(),
    })

    const [compDate, setCompDate] = useState<DateRange | undefined>({
        from: startOfYear(subYears(new Date(), 1)),
        to: subYears(new Date(), 1),
    })

    // Sync with server date - Adjust state during render pattern
    const [handledServerDate, setHandledServerDate] = useState<Date | null>(null);
    if (serverDate && serverDate !== handledServerDate) {
        setHandledServerDate(serverDate);
        setDate({
            from: startOfYear(serverDate),
            to: serverDate,
        });
        setCompDate({
            from: startOfYear(subYears(serverDate, 1)),
            to: subYears(serverDate, 1),
        });
    }

    const tabs = [
        { value: "ratios", label: "Ratios Financieros", icon: PieChart },
        { value: "bi", label: "Business Intelligence", icon: Activity },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Análisis Financiero</h2>
                    <p className="text-muted-foreground">Ratios financieros y Business Intelligence</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2 border-l pl-4">
                        <Switch id="compare-mode" checked={showComparison} onCheckedChange={setShowComparison} />
                        <Label htmlFor="compare-mode" className="text-sm cursor-pointer">Comparar</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <DateRangeSelector date={date} onDateChange={setDate} />
                        {showComparison && (
                            <div className="flex items-center space-x-2 border-l pl-4">
                                <span className="text-xs text-muted-foreground">vs</span>
                                <DateRangeSelector date={compDate} onDateChange={setCompDate} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Tabs defaultValue="ratios" className="space-y-4">
                <PageTabs tabs={tabs} maxWidth="max-w-sm" />

                <div className="max-w-6xl mx-auto w-full pt-4">
                    <TabsContent value="ratios">
                        <RatiosView date={date} showComparison={showComparison} compDate={compDate} />
                    </TabsContent>

                    <TabsContent value="bi">
                        <BIAnalyticsView date={date} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
