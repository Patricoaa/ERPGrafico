"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import { TabsContent } from "@/components/ui/tabs"
import { DateRangeFilter } from "@/components/shared"
import { DateRange } from "react-day-picker"
import { startOfYear, subYears } from "date-fns"
import { useServerDate } from "@/hooks/useServerDate"
import { CardSkeleton } from "@/components/shared"
import { MappingConfigDrawer } from "@/features/finance/components/MappingConfigDrawer"
import { useMappingDrawer } from "@/features/finance/hooks/useMappingDrawer"
import { PageContainer, FadeIn } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ChevronDown, GitCompare } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu"

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
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-card/60 backdrop-blur-md p-4 rounded-md border border-border/50 shadow-card shadow-black/5 transition-all">
                <div className="flex items-center gap-3">
                    {/* ButtonGroup for Mapeo and Vista */}
                    <div className="flex items-center -space-x-px shadow-xs rounded-sm">
                        {activeTab === "ratios" ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openMappingDrawer()}
                                    className="text-[10px] font-black uppercase tracking-wider text-primary gap-1.5 bg-primary/5 hover:bg-primary/10 border border-border/50 px-3.5 py-2 rounded-l-md rounded-r-none transition-all duration-300 shadow-card hover:scale-[1.01]"
                                >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    Mapeo
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[10px] font-black uppercase tracking-wider rounded-r-md rounded-l-none border border-border/50 px-3.5 py-2 transition-all gap-1 bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                                        >
                                            Vista: {headerFormat === 'year' ? 'Año' : headerFormat === 'month-year' ? 'Mes/Año' : 'Día/Mes/Año'}
                                            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40 bg-card/95 backdrop-blur-md border border-border/50 rounded-sm shadow-floating p-1 z-50">
                                        <DropdownMenuRadioGroup value={headerFormat} onValueChange={(val) => setHeaderFormat(val as HeaderFormat)}>
                                            <DropdownMenuRadioItem value="year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                                Año
                                            </DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="month-year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                                Mes/Año
                                            </DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="day-month-year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                                Día/Mes/Año
                                            </DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-[10px] font-black uppercase tracking-wider rounded-md border border-border/50 px-3.5 py-2 transition-all gap-1 bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                                    >
                                        Vista: {headerFormat === 'year' ? 'Año' : headerFormat === 'month-year' ? 'Mes/Año' : 'Día/Mes/Año'}
                                        <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-40 bg-card/95 backdrop-blur-md border border-border/50 rounded-sm shadow-floating p-1 z-50">
                                    <DropdownMenuRadioGroup value={headerFormat} onValueChange={(val) => setHeaderFormat(val as HeaderFormat)}>
                                        <DropdownMenuRadioItem value="year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                            Año
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="month-year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                            Mes/Año
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="day-month-year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                            Día/Mes/Año
                                        </DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {/* Standalone Comparar Toggle Button on the right of the ButtonGroup */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowComparison(!showComparison)}
                        className={cn(
                            "text-[10px] font-black uppercase tracking-wider rounded-md border border-border/50 px-3.5 py-2 transition-all gap-1.5 shadow-xs hover:scale-[1.01]",
                            showComparison
                                ? "bg-primary/10 text-primary font-black border-primary/20"
                                : "bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                        )}
                    >
                        <GitCompare className="h-3.5 w-3.5" />
                        Comparar
                    </Button>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground mb-1 tracking-tighter">Período Actual</span>
                        <DateRangeFilter date={date} onDateChange={setDate} label="Período Actual" />
                    </div>
                    {showComparison && (
                        <div className="flex flex-col items-end border-l pl-4 border-muted-foreground/20">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground mb-1 tracking-tighter">Período Comparativo</span>
                            <DateRangeFilter date={compDate} onDateChange={setCompDate} label="Período Comparativo" />
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto w-full pt-4">
                <FadeIn key={activeTab}>
                    <TabsContent value="ratios">
                        {activeTab === "ratios" && (
                            <RatiosDashboard date={date} showComparison={showComparison} compDate={compDate} />
                        )}
                    </TabsContent>

                    <TabsContent value="bi">
                        {activeTab === "bi" && (
                            <BIAnalyticsDashboard date={date} />
                        )}
                    </TabsContent>
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
