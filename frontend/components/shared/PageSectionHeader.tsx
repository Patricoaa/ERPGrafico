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
}

export function PageSectionHeader({ title, description, tabs }: PageSectionHeaderProps) {
    const pathname = usePathname()
    const router = useRouter()
    const pathSegments = pathname.split('/').filter(Boolean)
    const hasTabs = tabs && tabs.length > 0
    const activeTab = hasTabs ? (tabs.find(t => pathSegments.includes(t.value))?.value || tabs[0]?.value) : undefined

    if (!title && !description && !hasTabs) return null

    return (
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border">
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
                    value={activeTab!}
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
        </div>
    )
}
