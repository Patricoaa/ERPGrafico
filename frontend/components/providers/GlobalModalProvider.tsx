"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"
import dynamic from "next/dynamic"

const OrderCommandCenter = dynamic(() => import("@/components/orders/OrderCommandCenter").then(mod => mod.OrderCommandCenter), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Centro de Comando...</div>
})

const WorkOrderWizard = dynamic(() => import("@/components/production/WorkOrderWizard").then(mod => mod.WorkOrderWizard), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Gestor de OT...</div>
})

interface GlobalModalContextType {
    openWorkOrder: (id: number) => void
    openCommandCenter: (id: number, type: 'purchase' | 'sale' | 'obligation') => void
}

const GlobalModalContext = createContext<GlobalModalContextType | undefined>(undefined)

export function GlobalModalProvider({ children }: { children: ReactNode }) {
    const [woId, setWoId] = useState<number | null>(null)
    const [occId, setOccId] = useState<number | null>(null)
    const [occType, setOccType] = useState<'purchase' | 'sale' | 'obligation'>('sale')

    const openWorkOrder = (id: number) => {
        setWoId(id)
    }

    const openCommandCenter = (id: number, type: 'purchase' | 'sale' | 'obligation') => {
        setOccId(id)
        setOccType(type)
    }

    return (
        <GlobalModalContext.Provider value={{ openWorkOrder, openCommandCenter }}>
            {children}
            {woId !== null && (
                <WorkOrderWizard
                    orderId={woId}
                    open={woId !== null}
                    onOpenChange={(open) => !open && setWoId(null)}
                />
            )}
            {occId !== null && (
                <OrderCommandCenter
                    orderId={occId}
                    type={occType}
                    open={occId !== null}
                    onOpenChange={(open) => !open && setOccId(null)}
                />
            )}
        </GlobalModalContext.Provider>
    )
}

export function useGlobalModals() {
    const context = useContext(GlobalModalContext)
    if (context === undefined) {
        throw new Error("useGlobalModals must be used within a GlobalModalProvider")
    }
    return context
}
