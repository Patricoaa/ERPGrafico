"use client"

import React from "react"
import dynamic from "next/dynamic"
import { SkeletonShell } from "@/components/shared"

/**
 * Standard props every entity drawer receives from the global opener.
 * Per-entity adapters in ENTITY_DRAWERS map these to component-specific shapes.
 */
export interface EntityDrawerProps {
    id: number
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Optional pre-fetched data to avoid round-trip when caller already has it */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
    onSuccess?: () => void
}

const ContactDrawer = dynamic(() => import("@/features/contacts/components/ContactDrawer"), {
    ssr: false,
    loading: () => <SkeletonShell isLoading={true} ariaLabel="Cargando modal de contacto" />,
})

const TreasuryAccountDrawer = dynamic(
    () => import("@/features/treasury/components/TreasuryAccountDrawer").then((m) => m.TreasuryAccountDrawer),
    {
        ssr: false,
        loading: () => <SkeletonShell isLoading={true} ariaLabel="Cargando modal de cuenta de tesorería" />,
    }
)

const WorkOrderWizard = dynamic(
    () => import("@/features/production").then((m) => m.WorkOrderWizard),
    {
        ssr: false,
        loading: () => <SkeletonShell isLoading={true} ariaLabel="Cargando asistente de orden de trabajo" />,
    }
)

/**
 * Per-entity drawer renderers. Keyed by entity registry label.
 * Add a new entry here when you want an entity to open in-context
 * instead of navigating to its detail page.
 *
 * The corresponding entry in ENTITY_REGISTRY must also set `hasDrawer: true`.
 */
export const ENTITY_DRAWERS: Record<string, (props: EntityDrawerProps) => React.ReactNode> = {
    "contacts.contact": ({ id, open, onOpenChange, data, onSuccess }) => (
        <ContactDrawer
            open={open}
            onOpenChange={onOpenChange}
            contact={data ?? { id }}
            onSuccess={() => onSuccess?.()}
        />
    ),
    "treasury.treasuryaccount": ({ id, open, onOpenChange }) => (
        <TreasuryAccountDrawer open={open} onOpenChange={onOpenChange} accountId={id} />
    ),
    "production.workorder": ({ id, open, onOpenChange }) => (
        <WorkOrderWizard
            mode={{ kind: "manage", orderId: id }}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
}

export function hasEntityDrawer(label: string | undefined | null): boolean {
    return !!label && label in ENTITY_DRAWERS
}
