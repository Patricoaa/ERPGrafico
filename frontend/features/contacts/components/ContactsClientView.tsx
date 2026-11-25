"use client"

import { EntityPanelTab } from "@/components/providers"

import React, {useState, lazy, Suspense} from "react"
import { toast } from "sonner"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { contactActions, type ContactActionsCtx } from "@/features/contacts/contactActions"
import { useContacts, type Contact } from "@/features/contacts"
import { LoadingFallback } from "@/components/shared"
import type { ContactFilters } from "@/features/contacts/types"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useGlobalModals } from "@/components/providers"
import { contactEntity, contactViews } from "../entity-view/contact.entity"

// Lazy load heavy components
const ContactDrawer = lazy(() => import("./ContactDrawer"))
const ActionConfirmModal = lazy(() => import("@/components/shared/ActionConfirmModal").then(m => ({ default: m.ActionConfirmModal })))


interface ContactsClientViewProps {
    isNewModalOpen?: boolean
    createAction?: React.ReactNode
    initialContacts?: Contact[]
}

export function ContactsClientView({ isNewModalOpen = false, createAction, initialContacts }: ContactsClientViewProps) {
    const query = useCollectionQuery(contactEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { contacts, isLoading, isRefetching, isError, refetch, archiveContact } = useContacts({
        filters: query.params as ContactFilters,
        initialData: initialContacts,
   })
    const [archiveTarget, setArchiveTarget] = useState<Contact | null>(null)
    const { openEntity } = useGlobalModals()

    // Editar un contacto abre su pestaña (varias a la vez, ADR-0152); `?selected` solo es enlace profundo.
    useDeepLinkEntity("contacts.contact")
    // Esta pestaña de página queda solo para crear: `resolved: false` ignora `?selected`.
    const panel = useCreatePanelRoute<Contact>({ external: { open: isNewModalOpen }, resolved: false })

    const confirmArchive = async () => {
        if (!archiveTarget) return
        const isArchiving = archiveTarget.is_active
        try {
            await archiveContact({ id: archiveTarget.id, is_active: !archiveTarget.is_active })
            toast.success(`Contacto ${isArchiving ? "archivado" : "restaurado"} correctamente`)
        } catch {
            // Error handling is done in the hook
        } finally {
            setArchiveTarget(null)
        }
    }

    const actionsCtx: ContactActionsCtx = {
        onEdit: (contact) => openEntity("contacts.contact", contact.id, contact),
        onArchive: (contact) => setArchiveTarget(contact),
    }

    const { view, onViewChange } = useCollectionViewMode("contacts.contact")
    const collection = useEntityCollection(
        contactEntity,
        { rows: contacts, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, sorting: query.sorting },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                actions={contactActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
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
                <EntityPanelTab label="contacts.contact" {...panel.tab}>
                    {(open) => (
                        <ContactDrawer
                            open={open}
                            onOpenChange={(open) => { if (!open) panel.close() }}
                            onSuccess={() => {
                                panel.close()
                                // Automatic invalidation handles refetch
                            }}
                        />
                    )}
                </EntityPanelTab>
            </Suspense>

            <Suspense fallback={<LoadingFallback />}>
                <ActionConfirmModal
                    open={archiveTarget !== null}
                    onOpenChange={(open: boolean) => { if (!open) setArchiveTarget(null) }}
                    title={archiveTarget?.is_active ? "Archivar Contacto" : "Restaurar Contacto"}
                    variant={archiveTarget?.is_active ? "warning" : "default"}
                    onConfirm={confirmArchive}
                    confirmText={archiveTarget?.is_active ? "Archivar" : "Restaurar"}
                    description={
                        archiveTarget?.is_active ? (
                            <p>
                                ¿Está seguro de que desea archivar el contacto <strong>{archiveTarget?.name}</strong>?
                                Dejará de estar disponible para nuevas operaciones. Puede restaurarlo más adelante.
                            </p>
                        ) : (
                            <p>
                                ¿Está seguro de que desea restaurar el contacto <strong>{archiveTarget?.name}</strong>?
                            </p>
                        )
                    }
                />
            </Suspense>
        </div>
    )
}
