"use client"

import React, { useState } from "react"
import { LayoutDashboard } from "lucide-react"
import { Drawer, TabBar, TabBarContent } from "@/components/shared"
import { AnalyticsLayout } from "./AnalyticsLayout"
import { AnalyticsSegmentation } from "./AnalyticsSegmentation"
import type { AnalyticsPanelProps, AnalyticsTab } from "./types"

export function AnalyticsPanel({
    open,
    onOpenChange,
    entityName,
    tabs,
    activeTab: activeTabProp,
    onTabChange,
    granularity,
    onGranularityChange,
    dateRange,
    onDateRangeChange,
    cardAccounts,
    cardAccountId,
    onCardAccountChange,
    scope,
    onScopeChange,
}: AnalyticsPanelProps) {
    const [internalTab, setInternalTab] = useState(tabs[0]?.value ?? "")

    const currentTab = activeTabProp ?? internalTab
    const handleTabChange = onTabChange ?? setInternalTab

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title={`Análisis · ${entityName}`}
            icon={<LayoutDashboard />}
            side="bottom"
            defaultSize="70vh"
        >
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
                className="flex-1 flex flex-col overflow-hidden"
                contentClassName="flex flex-col"
                listClassName="pt-2"
            >
                {tabs.map((tab) => (
                    <AnalyticsTabContent
                        key={tab.value}
                        tab={tab}
                        isActive={tab.value === currentTab}
                    />
                ))}
            </TabBar>
            <AnalyticsSegmentation
                cardAccounts={cardAccounts}
                cardAccountId={cardAccountId}
                onCardAccountChange={onCardAccountChange}
                scope={scope}
                onScopeChange={onScopeChange}
                granularity={granularity}
                onGranularityChange={onGranularityChange}
                dateRange={dateRange}
                onDateRangeChange={onDateRangeChange}
            />
        </Drawer>
    )
}

function AnalyticsTabContent({ tab, isActive }: { tab: AnalyticsTab; isActive: boolean }) {
    if (!isActive && typeof window !== "undefined") return null

    return (
        <TabBarContent
            key={tab.value}
            value={tab.value}
            className="flex-1 flex flex-col"
        >
            <div className="p-6 flex flex-col min-h-0 h-full">
                {tab.description && (
                    <p className="text-xs text-muted-foreground/70 font-medium mb-4 shrink-0">
                        {tab.description}
                    </p>
                )}
                {tab.columns?.length ? (
                    <AnalyticsLayout columns={tab.columns} />
                ) : null}
            </div>
        </TabBarContent>
    )
}
