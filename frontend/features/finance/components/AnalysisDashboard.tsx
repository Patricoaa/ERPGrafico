"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import type { DateRange } from "react-day-picker"
import { startOfYear, subYears } from "date-fns"
import { useServerDate } from "@/hooks/useServerDate"
import { CardSkeleton } from "@/components/shared"
import { MappingConfigDrawer } from "@/features/finance/components/MappingConfigDrawer"
import { useMappingDrawer } from "@/features/finance/hooks/useMappingDrawer"
import { PageContainer, FadeIn, ReportToolbar } from "@/components/shared"

const RatiosDashboard = dynamic(() => import("@/features/finance/components/RatiosDashboard").then(mod => mod.RatiosDashboard), {
    ssr: false,
    loading: () => <CardSkeleton variant="grid" count={4} />
})

const BIAnalyticsDashboard = dynamic(() => import("@/features/finance/components/BIAnalyticsDashboard").then(mod => mod.BIAnalyticsDashboard), {
    ssr: false,
    loading: () => <CardSkeleton variant="grid" count={4} />
})

interface AnalysisDashboardProps {
    activeTab: string
}

export function AnalysisDashboard({ activeTab }: AnalysisDashboardProps) {
    const [showComparison, setShowComparison] = useState(false)
    const { open: mappingOpen, onOpenChange: setMappingOpen, resolvedMappingType, openDrawer: openMappingDrawer } = useMappingDrawer('bs')
    type HeaderFormat = 'year' | 'month-year' | 'day-month-year'
    const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('year')

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
        <PageContainer scrollable>
            <ReportToolbar
                headerFormat={headerFormat}
                onHeaderFormatChange={setHeaderFormat}
                date={date}
                onDateChange={setDate}
                showComparison={showComparison}
                onShowComparisonChange={setShowComparison}
                compDate={compDate}
                onCompDateChange={setCompDate}
                showMapeo={activeTab === "ratios"}
                onMapeoClick={() => openMappingDrawer()}
            />

            <div className="w-full pt-4">
                <FadeIn key={activeTab}>
                    {activeTab === "ratios" && (
                        <RatiosDashboard date={date} showComparison={showComparison} compDate={compDate} />
                    )}
                    {activeTab === "bi" && (
                        <BIAnalyticsDashboard date={date} />
                    )}
                </FadeIn>
            </div>
            
            <MappingConfigDrawer
                open={mappingOpen}
                onOpenChange={setMappingOpen}
                mappingType={resolvedMappingType} // Defaulting to Balance Sheet mappings for Ratios
                // Ratios data will be fetched inside RatiosView on next mount or we can't easily force refresh here 
                // since RatiosView does its own fetch on mount/date change. 
                // But saving mappings will take effect on next refresh.
            />
        </PageContainer>
    )
}
