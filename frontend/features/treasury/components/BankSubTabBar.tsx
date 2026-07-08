"use client"

import { usePathname, useRouter } from "next/navigation"
import { TabBar } from "@/components/shared"

interface BankSubTabItem {
    value: string
    label: string
    href: string
}

interface BankSubTabBarProps {
    tabs: BankSubTabItem[]
}

export function BankSubTabBar({ tabs }: BankSubTabBarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const pathSegments = pathname.split('/').filter(Boolean)
    const activeTab = tabs.find(t => pathSegments.includes(t.value))?.value || tabs[0]?.value

    return (
        <div className="px-6">
            <TabBar
                items={tabs.map(t => ({ value: t.value, label: t.label }))}
                value={activeTab}
                onValueChange={(value) => {
                    const tab = tabs.find(t => t.value === value)
                    if (tab) router.push(tab.href)
                }}
                variant="toolbar"
                dense
            >
                <div className="hidden" />
            </TabBar>
        </div>
    )
}
