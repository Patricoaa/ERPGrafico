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

const TreasuryAccountModal = dynamic(() => import("@/features/treasury/components/TreasuryAccountModal").then(mod => mod.TreasuryAccountModal), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Cuenta...</div>
})

interface GlobalModalContextType {
    openWorkOrder: (id: number) => void
    openCommandCenter: (id: number | null, type: 'purchase' | 'sale' | 'obligation', invoiceId?: number | null) => void
    openContact: (id: number, contact?: any) => void
    openTreasuryAccount: (id: number | null) => void
}

const GlobalModalContext = createContext<GlobalModalContextType | undefined>(undefined)

export function GlobalModalProvider({ children }: { children: ReactNode }) {
    const [woId, setWoId] = useState<number | null>(null)
    const [occId, setOccId] = useState<number | null>(null)
    const [occInvoiceId, setOccInvoiceId] = useState<number | null>(null)
    const [occType, setOccType] = useState<'purchase' | 'sale' | 'obligation'>('sale')
    const [contactId, setContactId] = useState<number | null>(null)
    const [tempContact, setTempContact] = useState<any>(null)
    const [treasuryAccountId, setTreasuryAccountId] = useState<number | null>(null)

    const openWorkOrder = (id: number) => {
        // Keep occId/occInvoiceId if already open, allowing it to collapse
        if (!occId && !occInvoiceId) {
            setOccId(null)
            setOccInvoiceId(null)
        }
        setContactId(null)
        setTreasuryAccountId(null)
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
        // Keep occId/occInvoiceId if already open, allowing it to collapse
        if (!occId && !occInvoiceId) {
            setOccId(null)
            setOccInvoiceId(null)
        }
        setWoId(null)
        setTreasuryAccountId(null)
        setContactId(id)
        setTempContact(contact || null)
    }

    const openTreasuryAccount = (id: number | null) => {
        // Keep occId/occInvoiceId if already open, allowing it to collapse
        if (!occId && !occInvoiceId) {
            setOccId(null)
            setOccInvoiceId(null)
        }
        setWoId(null)
        setContactId(null)
        setTreasuryAccountId(id)
    }

    const handleContactSuccess = () => {
        setContactId(null)
        setTempContact(null)
    }

    return (
        <GlobalModalContext.Provider value={{ openWorkOrder, openCommandCenter, openContact, openTreasuryAccount }}>
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
                    isExternalModalOpen={!!(woId || contactId || treasuryAccountId)}
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
            {treasuryAccountId !== null && (
                <TreasuryAccountModal
                    open={treasuryAccountId !== null}
                    onOpenChange={(open) => !open && setTreasuryAccountId(null)}
                    accountId={treasuryAccountId}
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
