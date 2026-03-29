"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname } from "next/navigation"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { QuickActionsMenu } from "@/components/layout/QuickActionsMenu"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { HubPanelProvider, useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { OrderHubPanel } from "@/components/orders/OrderHubPanel"
import { ActionCategory } from "@/components/orders/ActionCategory"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { useOrderHubData } from "@/hooks/useOrderHubData"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/components/layout/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()

    const [activeCategory, setActiveCategory] = useState<string | null>("dashboard")
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
    const [isSidebarVisible, setIsSidebarVisible] = useState(false)
    const [isInboxOpen, setIsInboxOpen] = useState(false)

    const { isHubOpen, hubConfig, closeHub, isHubTemporarilyHidden, actionEngineRef } = useHubPanel()
    const { activeDoc, fetchOrderDetails, userPermissions } = useOrderHubData({ 
        orderId: hubConfig?.orderId, 
        invoiceId: hubConfig?.invoiceId, 
        type: hubConfig?.type || 'sale', 
        enabled: isHubOpen 
    })

    const { isSubModalActive } = useGlobalModals()

    const isHubEffectivelyOpen = isHubOpen && !isSubModalActive && !isHubTemporarilyHidden

    useEffect(() => {
        // Sync active category with URL
        const path = pathname.split('/')[1] || "dashboard"
        setActiveCategory(path)
    }, [pathname])

    useEffect(() => {
        let timeout: NodeJS.Timeout
        if (hoveredCategory) {
            setIsSidebarVisible(true)
        } else {
            timeout = setTimeout(() => {
                setIsSidebarVisible(false)
            }, 300)
        }
        return () => clearTimeout(timeout)
    }, [hoveredCategory])

    // Mutually exclusive: close inbox when Hub opens
    useEffect(() => {
        if (isHubOpen && isInboxOpen) {
            setIsInboxOpen(false)
        }
    }, [isHubOpen]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleInboxToggle = () => {
        const next = !isInboxOpen
        setIsInboxOpen(next)
        // Close Hub when opening inbox
        if (next && isHubOpen) {
            closeHub()
        }
    }

    const categoryToUrl: Record<string, string> = {
        "dashboard": "/",
        "accounting": "/accounting/accounts",
        "contacts": "/contacts",
        "sales": "/sales/orders",
        "billing": "/billing/sales",
        "inventory": "/inventory/products",
        "production": "/production/orders",
        "treasury": "/treasury/movements",
        "purchasing": "/purchasing/orders",
        "finances": "/finances/statements",
        "tax": "/tax/declarations",
        "hr": "/hr/employees",
    }

    const displayCategory = hoveredCategory || activeCategory

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            {/* Mini Sidebar (Left) */}
            <MiniSidebar
                activeCategory={activeCategory}
                onCategoryChange={(cat: string) => {
                    if (categoryToUrl[cat]) {
                        router.push(categoryToUrl[cat])
                    }
                }}
                onHoverCategory={setHoveredCategory}
            />

            {/* Detailed Sidebar (Floating Glass Effect) */}
            <AppSidebar
                activeCategory={displayCategory}
                isVisible={isSidebarVisible}
                onMouseEnter={() => setHoveredCategory(displayCategory)}
                onMouseLeave={() => setHoveredCategory(null)}
            />

            {/* Main Content Area */}
            <div
                className={cn(
                    "flex-1 flex flex-col min-w-0 relative transition-all duration-500 ease-in-out",
                    isInboxOpen && "mr-[320px] xl:mr-[25%] 2xl:mr-[450px]",
                    isHubEffectivelyOpen && "mr-[500px]"
                )}
            >
                <main className={cn(
                    "flex-1 overflow-y-auto pb-24",
                    pathname.includes('/sales/pos') && "flex flex-col overflow-hidden"
                )}>
                    <div className={cn(
                        "p-0 w-full",
                        pathname.includes('/sales/pos') && "flex-1 flex flex-col overflow-hidden"
                    )}>
                        {children}
                    </div>
                </main>
                <QuickActionsMenu
                    isInboxOpen={isInboxOpen}
                    onInboxToggle={handleInboxToggle}
                />
            </div>

            {/* Hub Panel (Right) - Fixed position, NO Dialog/Portal */}
            <div 
                className={cn(
                    "fixed top-0 right-0 h-screen w-[500px] z-30 border-l shadow-2xl transition-transform duration-500 ease-in-out bg-background",
                    isHubEffectivelyOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {isHubOpen && hubConfig && (
                    <OrderHubPanel
                        orderId={hubConfig.orderId}
                        invoiceId={hubConfig.invoiceId}
                        type={hubConfig.type}
                        onClose={closeHub}
                        onActionSuccess={hubConfig.onActionSuccess}
                        posSessionId={hubConfig.posSessionId}
                    />
                )}
            </div>

            {/* Task Inbox Sidebar (Right) - Fixed position */}
            <div className="fixed right-0 top-0 h-screen z-40">
                <TaskInboxSidebar
                    isOpen={isInboxOpen}
                    onClose={() => setIsInboxOpen(false)}
                />
            </div>

            {/* 
                STABLE ACTION ENGINE (Headless) 
                Mounted outside the sliding sidebar to ensure modal stability.
            */}
            {/* 
                STABLE ACTION ENGINE (Headless) 
                Mounted outside the sliding sidebar to ensure modal stability.
            */}
            {isHubOpen && (
                <div className="sr-only" aria-hidden="true" id="global-action-engine">
                    <ActionCategory
                        key={hubConfig?.orderId || hubConfig?.invoiceId || 'engine'}
                        ref={actionEngineRef}
                        category={{ 
                            id: 'hub-engine', 
                            label: 'Global Engine', 
                            icon: null as any, 
                            actions: Object.values(hubConfig?.type === 'purchase' || hubConfig?.type === 'obligation' ? purchaseOrderActions : saleOrderActions).flatMap(c => c.actions) 
                        }}
                        order={activeDoc}
                        userPermissions={userPermissions || []}
                        onActionSuccess={() => { fetchOrderDetails(); hubConfig?.onActionSuccess?.() }}
                        posSessionId={hubConfig?.posSessionId}
                        headless={true}
                    />
                </div>
            )}

            <Toaster />
        </div>
    )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShellInner>{children}</DashboardShellInner>
    )
}
