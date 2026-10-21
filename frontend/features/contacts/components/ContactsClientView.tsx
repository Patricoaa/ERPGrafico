"use client"

import { useRouter, useSearchParams } from "next/navigation"
import React, {useState, lazy, Suspense} from "react"
import { toast } from "sonner"
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
    const { contacts, isLoading, isRefetching, isError, refetch, archiveContact } = useContacts({
        filters: search.filters as ContactFilters,
        initialData: initialContacts,
    })
    const [archiveTarget, setArchiveTarget] = useState<Contact | null>(null)
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
        onEdit: (id) => openSelected(id),
        onArchive: (contact) => setArchiveTarget(contact),
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
