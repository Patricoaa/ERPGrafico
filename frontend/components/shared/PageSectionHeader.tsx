"use client"

import { usePathname, useRouter } from "next/navigation"
import { TabBar } from "@/components/shared"

interface PageSectionTab {
    value: string
    label: string
    href: string
}

/**
 * Pestañas internas de una vista (nivel por debajo del sidebar).
 * El título y la descripción de la página los publica la topbar del shell (ADR-0079).
 */
interface PageSectionHeaderProps {
    tabs?: PageSectionTab[]
    subTabs?: PageSectionTab[]
    /** Render subTabs as a full-width underline row */
    subTabsBelow?: boolean
}

export function PageSectionHeader({ tabs, subTabs, subTabsBelow = false }: PageSectionHeaderProps) {
    const pathname = usePathname()
    const router = useRouter()
    const pathSegments = pathname.split('/').filter(Boolean)
    const hasTabs = tabs && tabs.length > 0
    const activeTab = hasTabs ? (tabs.find(t => pathSegments.includes(t.value))?.value || tabs[0]?.value) : undefined
    const hasSubTabs = subTabs && subTabs.length > 0
    const activeSubTab = hasSubTabs ? (subTabs.find(t => pathSegments.includes(t.value))?.value ?? subTabs[0]?.value ?? "") : ""

    if (!hasTabs && !hasSubTabs) return null

    return (
        <div>
            <div className="flex items-center justify-end gap-4">
                {hasTabs && (
                    <TabBar
                        items={tabs.map(t => ({ value: t.value, label: t.label }))}
                        value={activeTab ?? ''}
                        onValueChange={(value) => {
                            const tab = tabs.find(t => t.value === value)
                            if (tab) router.push(tab.href)
                        }}
                        variant="toolbar"
                        className="w-full"
                        containerClassName="justify-start"
                    >
                        <div className="hidden" />
                    </TabBar>
                )}
                {hasSubTabs && !hasTabs && !subTabsBelow && (
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
            {hasSubTabs && subTabsBelow && (
                <div className="flex justify-start pt-2">
                    <TabBar
                        items={subTabs.map(t => ({ value: t.value, label: t.label }))}
                        value={activeSubTab}
                        onValueChange={(value) => {
                            const tab = subTabs.find(t => t.value === value)
                            if (tab) router.push(tab.href)
                        }}
                        variant="underline"
                        dense
                        className="w-full"
                        containerClassName="justify-start"
                    >
                        <div className="hidden" />
                    </TabBar>
                </div>
            )}
            {hasSubTabs && hasTabs && !subTabsBelow && (
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
