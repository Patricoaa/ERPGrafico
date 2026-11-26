"use client"

import React, { useState } from "react"
import { RailNav, TabBar } from "@/components/shared"
import { AnalyticsLayout } from "./AnalyticsLayout"
import type { AnalyticsTab, AnalyticsPanelContentProps } from "./types"
import { cn } from "@/lib/utils"
import { GranularityControl } from "./GranularityControl"
import { AnalyticsDrillDownProvider } from "./drill-down"

export interface AnalyticsTabBarProps {
    tabs: AnalyticsTab[]
    activeTab?: string
    onTabChange?: (value: string) => void
}

export function AnalyticsTabBar({
    tabs,
    activeTab: activeTabProp,
    onTabChange,
}: AnalyticsTabBarProps) {
    const [internalTab, setInternalTab] = useState(tabs[0]?.value ?? "")

    const currentTab = activeTabProp ?? internalTab
    const handleTabChange = onTabChange ?? setInternalTab

    return (
        <TabBar
            items={tabs.map((t) => ({
                value: t.value,
                label: t.label,
                icon: t.icon,
                badge: t.badge,
            }))}
            value={currentTab}
            onValueChange={handleTabChange}
            orientation="horizontal"
            className="flex-none w-auto shrink-0"
        >
            <div className="hidden" />
        </TabBar>
    )
}

export function AnalyticsPanelContent({
    entityName,
    tabs,
    activeTab: activeTabProp,
    onTabChange,
    granularity,
    onGranularityChange,
    onDrillDown,
}: AnalyticsPanelContentProps) {
    const [internalTab, setInternalTab] = useState(tabs[0]?.value ?? "")

    const currentTab = activeTabProp ?? internalTab
    const handleTabChange = onTabChange ?? setInternalTab

    const content = (
        <div className="flex-1 flex flex-row gap-4 w-full h-full min-h-0 overflow-hidden bg-transparent">
            <div className="w-14 shrink-0 sm:w-56">
                <RailNav
                    ariaLabel={`Secciones de análisis de ${entityName}`}
                    sections={[{ items: tabs }]}
                    value={currentTab}
                    onValueChange={handleTabChange}
                    className="bg-transparent px-1.5 py-0 sm:px-0"
                    bottom={granularity && onGranularityChange
                        ? <GranularityControl value={granularity} onChange={onGranularityChange} />
                        : undefined}
                />
            </div>
            <div className="flex-1 flex flex-col min-w-0 h-full p-0">
                {granularity && onGranularityChange && (
                    <div className="mb-2 shrink-0 sm:hidden">
                        <GranularityControl value={granularity} onChange={onGranularityChange} />
                    </div>
                )}
                {tabs.map((tab) => (
                    <AnalyticsTabContent
                        key={tab.value}
                        tab={tab}
                        isActive={tab.value === currentTab}
                    />
                ))}
            </div>
        </div>
    )
    // Inside `Collection.Analytics` a provider is already set; an explicit handler wins.
    return onDrillDown ? <AnalyticsDrillDownProvider onDrillDown={onDrillDown}>{content}</AnalyticsDrillDownProvider> : content
}

function AnalyticsTabContent({ tab, isActive }: { tab: AnalyticsTab; isActive: boolean }) {
    if (!isActive && typeof window !== "undefined") return null

    return (
        <div className={cn("flex-1 flex flex-col min-h-0 h-full w-full", !isActive && "hidden")}>
            {tab.columns?.length ? (
                <AnalyticsLayout columns={tab.columns} gridRows={tab.gridRows} />
            ) : null}
        </div>
    )
}
