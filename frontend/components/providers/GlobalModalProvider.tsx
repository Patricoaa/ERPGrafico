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

const ContactModal = dynamic(() => import("@/features/contacts/components/ContactModal"), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Ficha...</div>
})

interface GlobalModalContextType {
    openWorkOrder: (id: number) => void
    openCommandCenter: (id: number | null, type: 'purchase' | 'sale' | 'obligation', invoiceId?: number | null) => void
    openContact: (id: number, contact?: any) => void
}

const GlobalModalContext = createContext<GlobalModalContextType | undefined>(undefined)

export function GlobalModalProvider({ children }: { children: ReactNode }) {
    const [woId, setWoId] = useState<number | null>(null)
    const [occId, setOccId] = useState<number | null>(null)
    const [occInvoiceId, setOccInvoiceId] = useState<number | null>(null)
    const [occType, setOccType] = useState<'purchase' | 'sale' | 'obligation'>('sale')
    const [contactId, setContactId] = useState<number | null>(null)
    const [tempContact, setTempContact] = useState<any>(null)

    const openWorkOrder = (id: number) => {
        setOccId(null)
        setOccInvoiceId(null)
        setContactId(null)
        setWoId(id)
    }

    const openCommandCenter = (id: number | null, type: 'purchase' | 'sale' | 'obligation', invoiceId?: number | null) => {
        setWoId(null)
        setContactId(null)
        setOccId(id)
        setOccInvoiceId(invoiceId || null)
        setOccType(type)
    }

    const openContact = (id: number, contact?: any) => {
        setWoId(null)
        setOccId(null)
        setOccInvoiceId(null)
        setContactId(id)
        setTempContact(contact || null)
    }

    const handleContactSuccess = () => {
        setContactId(null)
        setTempContact(null)
    }

    return (
        <GlobalModalContext.Provider value={{ openWorkOrder, openCommandCenter, openContact }}>
            {children}
            {woId !== null && (
                <WorkOrderWizard
                    orderId={woId}
                    open={woId !== null}
                    onOpenChange={(open) => !open && setWoId(null)}
                />
            )}
            {(occId !== null || occInvoiceId !== null) && (
                <OrderCommandCenter
                    orderId={occId}
                    invoiceId={occInvoiceId}
                    type={occType}
                    open={occId !== null || occInvoiceId !== null}
                    onOpenChange={(open) => { if (!open) { setOccId(null); setOccInvoiceId(null); } }}
                />
            )}
            {contactId !== null && (
                <ContactModal
                    open={contactId !== null}
                    onOpenChange={(open) => !open && setContactId(null)}
                    contact={tempContact || { id: contactId }} // Pass ID if full contact not available
                    onSuccess={handleContactSuccess}
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
