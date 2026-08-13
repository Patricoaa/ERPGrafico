"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { TabBar } from "@/components/shared"

interface PageSectionTab {
    value: string
    label: string
    href: string
}

interface PageSectionHeaderProps {
    title?: string
    description?: string
    tabs?: PageSectionTab[]
    subTabs?: PageSectionTab[]
}

export function PageSectionHeader({ title, description, tabs, subTabs }: PageSectionHeaderProps) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathSegments = pathname.split('/').filter(Boolean)
    const hasTabs = tabs && tabs.length > 0
    const activeTab = hasTabs ? (tabs.find(t => pathSegments.includes(t.value))?.value || tabs[0]?.value) : undefined
    const hasSubTabs = subTabs && subTabs.length > 0
    const activeSubTab = hasSubTabs ? (subTabs.find(t => pathSegments.includes(t.value))?.value ?? subTabs[0]?.value ?? "") : ""

    const currentView = searchParams.get('view')
    const displayTitle = currentView === 'analytics' && title ? `Análisis de ${title}` : title

    if (!title && !description && !hasTabs && !hasSubTabs) return null

    return (
        <div>
            <div className="flex items-center justify-between gap-4">
                {(displayTitle || description) && (
                    <div className="flex flex-col min-w-0">
                        {displayTitle && (
                            <h2 className="text-lg font-semibold tracking-tight text-foreground">{displayTitle}</h2>
                        )}
                        {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                        )}
                    </div>
                )}
                {hasTabs && (
                    <TabBar
                        items={tabs.map(t => ({ value: t.value, label: t.label }))}
                        value={activeTab ?? ''}
                        onValueChange={(value) => {
                            const tab = tabs.find(t => t.value === value)
                            if (tab) router.push(tab.href)
                        }}
                        variant="toolbar"
                        className={title || description ? "w-auto flex-none shrink-0" : "w-full"}
                        containerClassName={title || description ? "justify-end" : "justify-start"}
                    >
                        <div className="hidden" />
                    </TabBar>
                )}
                {hasSubTabs && !hasTabs && (
                    <TabBar
                        items={subTabs.map(t => ({ value: t.value, label: t.label }))}
                        value={activeSubTab}
                        onValueChange={(value) => {
                            const tab = subTabs.find(t => t.value === value)
                            if (tab) router.push(tab.href)
                        }}
                        variant="toolbar"
                        dense
                        className="w-auto flex-none shrink-0"
                        containerClassName="justify-end"
                    >
                        <div className="hidden" />
                    </TabBar>
                )}
            </div>
            {hasSubTabs && hasTabs && (
                <div className="flex justify-end pb-2">
                    <TabBar
                        items={subTabs.map(t => ({ value: t.value, label: t.label }))}
                        value={activeSubTab}
                        onValueChange={(value) => {
                            const tab = subTabs.find(t => t.value === value)
                            if (tab) router.push(tab.href)
                        }}
                        variant="toolbar"
                        dense
                        className="w-auto flex-none shrink-0"
                        containerClassName="justify-end"
                    >
                        <div className="hidden" />
                    </TabBar>
                </div>
            )}
        </div>
    )
}
