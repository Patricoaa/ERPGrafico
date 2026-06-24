"use client"

import { usePathname, useRouter } from "next/navigation"
import { TabBar } from "@/components/shared"
import type { TabItem } from "@/components/shared/TabBar"

interface PageSectionHeaderProps {
    title: string
    description?: string
    tabs: TabItem[]
    basePath: string
}

export function PageSectionHeader({ title, description, tabs, basePath }: PageSectionHeaderProps) {
    const pathname = usePathname()
    const router = useRouter()
    const activeTab = tabs.find(t => pathname.endsWith(t.value))?.value || tabs[0]?.value

    return (
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border">
            <div className="flex flex-col min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            <TabBar
                items={tabs}
                value={activeTab}
                onValueChange={(value) => router.push(`${basePath}/${value}`)}
                variant="toolbar"
                className="w-auto flex-none shrink-0"
                containerClassName="justify-end"
            >
                <div className="hidden" />
            </TabBar>
        </div>
    )
}
