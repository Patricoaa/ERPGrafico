"use client"

import React, { useState } from "react"
import { LayoutDashboard } from "lucide-react"
import { Drawer } from "@/components/shared"
import { AnalyticsLayout } from "./AnalyticsLayout"
import type { AnalyticsPanelProps, AnalyticsTab } from "./types"
import { cn } from "@/lib/utils"

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
        <div className="flex-1 flex flex-row w-full h-full min-h-0 overflow-hidden bg-transparent">
            <div className="w-56 shrink-0 flex flex-col pr-4 py-0 gap-2 overflow-y-auto bg-transparent">
                {tabs.map((t) => {
                    const Icon = t.icon
                    const isActive = t.value === currentTab
                    return (
                        <button
                            key={t.value}
                            onClick={() => handleTabChange(t.value)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all duration-200",
                                isActive 
                                    ? "bg-primary text-primary-foreground shadow-md" 
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {Icon && <Icon className="w-4 h-4 shrink-0" />}
                            <span className="truncate">{t.label}</span>
                            {t.badge && (
                                <span className={cn(
                                    "ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                    isActive ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
                                )}>
                                    {t.badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
            <div className="flex-1 flex flex-col min-w-0 h-full p-0">
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
        <div className={cn("flex-1 flex flex-col min-h-0 h-full w-full", !isActive && "hidden")}>
            {tab.columns?.length ? (
                <AnalyticsLayout columns={tab.columns} />
            ) : null}
        </div>
    )
}
