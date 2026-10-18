"use client"

import { useRouter, useSearchParams } from "next/navigation"
import React, {useState, lazy, Suspense} from "react"
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { contactActions, type ContactActionsCtx } from "@/features/contacts/contactActions"
import { useContacts, type Contact } from "@/features/contacts"
import { LoadingFallback, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { contactsUnifiedSearchDef } from "@/features/contacts/unifiedSearchDef"
import type { ContactFilters } from "@/features/contacts/types"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { contactEntity, contactViews } from "../entity-view/contact.entity"

// Lazy load heavy components
const ContactDrawer = lazy(() => import("./ContactDrawer"))
const ActionConfirmModal = lazy(() => import("@/components/shared/ActionConfirmModal").then(m => ({ default: m.ActionConfirmModal })))


/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const CONTACT_GROUPS: Record<string, FieldId<typeof contactEntity.fields>> = { contact_type: "contactType", credit_risk_level: "riskLevel" }

interface ContactsClientViewProps {
    isNewModalOpen?: boolean
    createAction?: React.ReactNode
    initialContacts?: Contact[]
}

export function ContactsClientView({ isNewModalOpen = false, createAction, initialContacts }: ContactsClientViewProps) {
    const search = useUnifiedSearch(contactsUnifiedSearchDef)
    const { contacts, isLoading, isRefetching, isError, refetch, deleteContact } = useContacts({
        filters: search.filters as ContactFilters,
        initialData: initialContacts,
    })
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { openSelected } = useEntityRouteActions()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Contact>({
        endpoint: '/contacts'
    })

    const isCreateOpen = searchParams.get("modal") === "new" || isNewModalOpen
    const isEditOpen = !!selectedFromUrl
    const drawerOpen = isCreateOpen || isEditOpen

    const handleCloseModal = (open: boolean) => {
        if (!open) {
            if (isEditOpen) clearSelection()
            if (isCreateOpen && searchParams.get("modal") === "new") {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`)
            }
        }
    }

    const handleDelete = async (contact: Contact, isConfirmed = false) => {
        if (!contact) return
        if (!isConfirmed) {
            setContactToDelete(contact)
            setIsDeleteModalOpen(true)
            return
        }
        try {
            await deleteContact(contact.id)
            setIsDeleteModalOpen(false)
        } catch {
            // Error handling is done in the hook
        }
    }

    const actionsCtx: ContactActionsCtx = {
        onEdit: (id) => openSelected(id),
        onDelete: (contact) => handleDelete(contact),
    }

    const groupBy = search.groupBy ? CONTACT_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("contacts.contact")
    const collection = useEntityCollection(
        contactEntity,
        { rows: contacts, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, defaultSort: contactViews.table.defaultSort },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(contact) => openSelected(contact.id)}
                actions={contactActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={contactsUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar por nombre, RUT o email..." />
                </Collection.Toolbar>
                <Collection.View
                    table={contactViews.table}
                    card={contactViews.card}
                    emptyTitle="Aún no hay contactos"
                    emptyDescription="Crea tu primer cliente o proveedor para empezar a operar."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <Suspense fallback={<LoadingFallback />}>
                <ContactDrawer
                    open={drawerOpen}
                    onOpenChange={handleCloseModal}
                    contact={selectedFromUrl ?? undefined}
                    onSuccess={() => {
                        handleCloseModal(false)
                        // Automatic invalidation handles refetch
                    }}
                />
            </Suspense>

            <Suspense fallback={<LoadingFallback />}>
                <ActionConfirmModal
                    open={isDeleteModalOpen}
                    onOpenChange={(open: boolean) => setIsDeleteModalOpen(open)}
                    title="Eliminar Contacto"
                    variant="destructive"
                    onConfirm={() => { if (contactToDelete) return handleDelete(contactToDelete, true) }}
                    confirmText="Eliminar"
                    description={
                        <p>
                            ¿Está seguro de que desea eliminar el contacto <strong>{contactToDelete?.name}</strong>?
                            Esta acción no se puede deshacer y puede afectar documentos asociados.
                        </p>
                    }
                />
            </Suspense>
        </div>
    )
}
