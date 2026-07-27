"use client"

import { useRouter, useSearchParams } from "next/navigation"
import React, {useState, lazy, Suspense} from "react"
import { type ColumnDef } from "@tanstack/react-table"

import { getEntityIcon } from "@/lib/entity-registry"
import { DataTableView } from '@/components/shared'
import { AutoEntityCard } from '@/components/shared'
import { contactFields } from "@/features/contacts/contactFields"
import { contactActions, type ContactActionsCtx } from "@/features/contacts/contactActions"
import { useContacts, type Contact } from "@/features/contacts"
import { LoadingFallback, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { contactsUnifiedSearchDef } from "@/features/contacts/unifiedSearchDef"
import type { ContactFilters } from "@/features/contacts/types"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

// Lazy load heavy components
const ContactDrawer = lazy(() => import("./ContactDrawer"))
const ActionConfirmModal = lazy(() => import("@/components/shared/ActionConfirmModal").then(m => ({ default: m.ActionConfirmModal })))


interface ContactsClientViewProps {
    isNewModalOpen?: boolean
    createAction?: React.ReactNode
    initialContacts?: Contact[]
}

export function ContactsClientView({ isNewModalOpen = false, createAction, initialContacts }: ContactsClientViewProps) {
    const search = useUnifiedSearch(contactsUnifiedSearchDef)
    const { contacts, isLoading, isRefetching, deleteContact } = useContacts({
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

    const columns = React.useMemo<ColumnDef<Contact>[]>(() => [
        ...contactFields.toColumns(),
        contactActions.auto(actionsCtx),
    ] as ColumnDef<Contact>[], [actionsCtx])

    return (

        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="contacts.contact"
                        columns={columns}
                        data={contacts}
                        isLoading={isLoading}
                        isRefetching={isRefetching}
                        variant="embedded"
                        unifiedSearch={<UnifiedSearchBar
                            config={contactsUnifiedSearchDef}
                            chips={search.chips}
                            isFiltered={search.isFiltered}
                            inputValue={search.inputValue}
                            onInputChange={search.setInputValue}
                            onApply={search.applyFilter}
                            onRemove={search.removeFilter}
                            onClearAll={search.clearAll}
                            groupBy={search.groupBy}
                            onGroupBySelect={search.setGroupBy}
                            paramValues={search.paramValues}
                            placeholder="Buscar por nombre, RUT o email..."
                        />}
                        unifiedSearchConfig={contactsUnifiedSearchDef}
                        currentGroupBy={search.groupBy}
                        showReset={search.isFiltered}
                        onReset={search.clearAll}
                        defaultPageSize={20}
                        createAction={createAction}
                        isFiltered={search.isFiltered}
                        emptyState={{
                            context: "users",
                            title: "Aún no hay contactos",
                            description: "Crea tu primer cliente o proveedor para empezar a operar.",
                        }}
                        renderCard={(contact: Contact) => (
                            <AutoEntityCard 
                                key={contact.id}
                                data={contact}
                                fields={contactFields}
                                entityLabel="contacts.contact"
                                icon={getEntityIcon('contacts.contact')}
                                iconClassName="text-primary bg-primary/10"
                                actions={contactActions.render(contact, actionsCtx)}
                                defaultAction={contactActions.defaultAction(actionsCtx)?.(contact) ?? (() => openSelected(contact.id))}
                            />
                        )}
                    />
            </div>

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
