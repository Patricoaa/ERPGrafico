"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import { TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DateRangeFilter } from "@/components/shared"
import { DateRange } from "react-day-picker"
import { startOfYear, subYears } from "date-fns"
import { useServerDate } from "@/hooks/useServerDate"
import { CardSkeleton } from "@/components/shared"
import { MappingConfigSheet } from "@/features/finance/components/MappingConfigSheet"
import { PageContainer } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal } from "lucide-react"

const RatiosView = dynamic(() => import("@/features/finance/components/RatiosView").then(mod => mod.RatiosView), {
    ssr: false,
    loading: () => <CardSkeleton variant="grid" count={4} />
})

const BIAnalyticsView = dynamic(() => import("@/features/finance/components/BIAnalyticsView").then(mod => mod.BIAnalyticsView), {
    ssr: false,
    loading: () => <CardSkeleton variant="grid" count={4} />
})

interface AnalysisViewProps {
    activeTab: string
}

export function AnalysisView({ activeTab }: AnalysisViewProps) {
    const [showComparison, setShowComparison] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)

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
        <PageContainer>
            <div className="flex flex-wrap items-center justify-end gap-4">
                {activeTab === "ratios" && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMappingOpen(true)}
                        className="text-xs font-black uppercase tracking-widest text-primary gap-1.5"
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Configurar Mapeo
                    </Button>
                )}

                <div className="flex items-center space-x-2 border-l pl-4">
                    <Switch id="compare-mode" checked={showComparison} onCheckedChange={setShowComparison} />
                    <Label htmlFor="compare-mode" className="text-sm cursor-pointer">Comparar</Label>
                </div>

                <div className="flex items-center space-x-2">
                    <DateRangeFilter date={date} onDateChange={setDate} label="Periodo Principal" />
                    {showComparison && (
                        <div className="flex items-center space-x-2 border-l pl-4">
                            <span className="text-xs text-muted-foreground">vs</span>
                            <DateRangeFilter date={compDate} onDateChange={setCompDate} label="Comparar con" />
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
            
            <MappingConfigSheet
                open={mappingOpen}
                onOpenChange={setMappingOpen}
                mappingType="bs" // Defaulting to Balance Sheet mappings for Ratios
                // Ratios data will be fetched inside RatiosView on next mount or we can't easily force refresh here 
                // since RatiosView does its own fetch on mount/date change. 
                // But saving mappings will take effect on next refresh.
            />
        </PageContainer>
    )
}
