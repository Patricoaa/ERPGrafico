"use client"

import { usePathname, useRouter } from "next/navigation"
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
    const pathSegments = pathname.split('/').filter(Boolean)
    const hasTabs = tabs && tabs.length > 0
    const activeTab = hasTabs ? (tabs.find(t => pathSegments.includes(t.value))?.value || tabs[0]?.value) : undefined
    const hasSubTabs = subTabs && subTabs.length > 0
    const activeSubTab = hasSubTabs ? (subTabs.find(t => pathSegments.includes(t.value))?.value ?? subTabs[0]?.value ?? "") : ""

    if (!title && !description && !hasTabs && !hasSubTabs) return null

    return (
        <div>
            <div className="flex items-center justify-between gap-4 py-3">
                {(title || description) && (
                    <div className="flex flex-col min-w-0">
                        {title && (
                            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
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
