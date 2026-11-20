"use client"

import React, { useState } from "react"
import { LayoutDashboard } from "lucide-react"
import { Drawer, RailNav, TabBar } from "@/components/shared"
import { AnalyticsLayout } from "./AnalyticsLayout"
import type { AnalyticsPanelProps, AnalyticsTab, AnalyticsPanelContentProps } from "./types"
import { cn } from "@/lib/utils"
import { GranularityControl } from "./GranularityControl"

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
}: AnalyticsPanelContentProps) {
    const [internalTab, setInternalTab] = useState(tabs[0]?.value ?? "")

    const currentTab = activeTabProp ?? internalTab
    const handleTabChange = onTabChange ?? setInternalTab

    return (
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
}

export function AnalyticsPanel({
    open,
    onOpenChange,
    entityName,
    tabs,
    activeTab,
    onTabChange,
    granularity,
    onGranularityChange,
}: AnalyticsPanelProps) {
    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title={`Análisis · ${entityName}`}
            icon={<LayoutDashboard />}
            side="right"
            defaultSize="60%"
            boundary="embedded"
        >
            <AnalyticsPanelContent
                entityName={entityName}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={onTabChange}
                granularity={granularity}
                onGranularityChange={onGranularityChange}
            />
        </Drawer>
    )
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
