"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import { TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DateRangeSelector } from "@/features/finance/components/DateRangeSelector"
import { DateRange } from "react-day-picker"
import { startOfYear, subYears } from "date-fns"
import { useServerDate } from "@/hooks/useServerDate"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { LAYOUT_TOKENS } from "@/lib/styles"

const RatiosView = dynamic(() => import("@/features/finance/components/RatiosView").then(mod => mod.RatiosView), {
    ssr: false,
    loading: () => <LoadingFallback message="Cargando análisis..." />
})

const BIAnalyticsView = dynamic(() => import("@/features/finance/components/BIAnalyticsView").then(mod => mod.BIAnalyticsView), {
    ssr: false,
    loading: () => <LoadingFallback message="Cargando BI..." />
})

interface AnalysisViewProps {
    activeTab: string
}

export function AnalysisView({ activeTab }: AnalysisViewProps) {
    const [showComparison, setShowComparison] = useState(false)

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
    const [handledServerDate, setHandledServerDate] = useState<Date | null>(null)
    if (serverDate && serverDate !== handledServerDate) {
        setHandledServerDate(serverDate)
        setDate({
            from: startOfYear(serverDate),
            to: serverDate,
        })
        setCompDate({
            from: startOfYear(subYears(serverDate, 1)),
            to: subYears(serverDate, 1),
        })
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <div className="flex flex-wrap items-center justify-end gap-4">
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

            <div className="max-w-6xl mx-auto w-full pt-4">
                <TabsContent value="ratios">
                    {activeTab === "ratios" && (
                        <RatiosView date={date} showComparison={showComparison} compDate={compDate} />
                    )}
                </TabsContent>

                <TabsContent value="bi">
                    {activeTab === "bi" && (
                        <BIAnalyticsView date={date} />
                    )}
                </TabsContent>
            </div>
        </div>
    )
}
