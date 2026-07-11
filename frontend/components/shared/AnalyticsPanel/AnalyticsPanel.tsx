"use client"

import React, { useState } from "react"
import { LayoutDashboard } from "lucide-react"
import { Drawer, TabBar, TabBarContent } from "@/components/shared"
import { AnalyticsLayout } from "./AnalyticsLayout"
import type { AnalyticsPanelProps, AnalyticsTab } from "./types"

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

export interface AnalyticsPanelContentProps {
    entityName: string
    tabs: AnalyticsTab[]
    activeTab?: string
    onTabChange?: (value: string) => void
}

export function AnalyticsPanelContent({
    entityName,
    tabs,
    activeTab: activeTabProp,
    onTabChange,
}: AnalyticsPanelContentProps) {
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
            className="flex-1 flex flex-col overflow-hidden"
            contentClassName="flex flex-col"
        >
            {tabs.map((tab) => (
                <AnalyticsTabContent
                    key={tab.value}
                    tab={tab}
                    isActive={tab.value === currentTab}
                />
            ))}
        </TabBar>
    )
}

export function AnalyticsPanel({
    open,
    onOpenChange,
    entityName,
    tabs,
    activeTab,
    onTabChange,
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
            <div className="p-6 flex flex-col min-h-0">
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
