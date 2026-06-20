"use client"

import React, { useState, useEffect, lazy, Suspense } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { CardSkeleton, SkeletonShell, FadeIn } from "@/components/shared"

const PosTerminalList = lazy(() => import("@/features/sales/components/PosTerminalList"))
const POSSessionsView = lazy(() => import("@/features/sales/components/POSSessionsView").then(m => ({ default: m.POSSessionsView })))

interface SalesPosViewProps {
    activeTab: string
    modal?: string
    createAction?: React.ReactNode
}

export const SalesPosView: React.FC<SalesPosViewProps> = ({ activeTab, modal, createAction }) => {
    const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => {
            if (modal === "new-terminal") setIsTerminalModalOpen(true)
        })
    }, [modal])

    return (
        <Tabs value={activeTab} className="h-full flex flex-col">
            <TabsContent value="cajas" className="mt-0 outline-none flex-1 min-h-0">
                <Suspense fallback={<CardSkeleton variant="grid" count={3} />}>
                    <FadeIn className="h-full">
                        <PosTerminalList
                            externalOpen={isTerminalModalOpen}
                            onExternalOpenChange={setIsTerminalModalOpen}
                            createAction={activeTab === "cajas" ? createAction : undefined}
                        />
                    </FadeIn>
                </Suspense>
            </TabsContent>

            <TabsContent value="sessions" className="mt-0 outline-none flex-1 min-h-0">
                <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                    <FadeIn className="h-full">
                        <POSSessionsView hideHeader />
                    </FadeIn>
                </Suspense>
            </TabsContent>
        </Tabs>
    )
}

export default SalesPosView
