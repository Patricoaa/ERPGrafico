"use client"

import React, { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, CancelButton, ActionSlideButton, Chip, SkeletonShell } from "@/components/shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { formatRUT } from "@/lib/utils/format"
import { useContact } from "@/features/contacts/hooks/useContacts"
import type { Contact } from "@/features/contacts/types"
import ContactModal from "./ContactModal"

interface ContactDetailClientProps {
    contactId: string
}

// Placeholder tipado para el esqueleto - sigue el patrón del contrato
const CONTACT_DETAIL_SKELETON: Contact = {
    id: 0,
    code: "————————————",
    display_id: "————————————",
    name: "————————————",
    tax_id: "————————————",
    contact_type: 'CUSTOMER', // valor por defecto válido
    email: "————————————",
    phone: "————————————",
    address: "————————————",
    city: "————————————",
    payment_terms: "————————————",
    is_default_customer: false,
    is_default_vendor: false,
}

export function ContactDetailClient({ contactId }: ContactDetailClientProps) {
    const router = useRouter()
    const { data: contact, isLoading: loading, error: queryError, refetch: fetchContact } = useContact(Number(contactId))
    const [modalOpen, setModalOpen] = useState(false)

    const error = queryError ? (queryError as any)?.response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar contacto
        </div>
    )


    return (
        <SkeletonShell isLoading={loading || !contact} ariaLabel="Cargando detalle de contacto">
            <EntityDetailPage
                entityLabel="contacts.contact"
                displayId={formatEntityDisplay('contacts.contact', contact ?? CONTACT_DETAIL_SKELETON)}
                breadcrumb={[
                    { label: "Contactos", href: "/contacts" },
                    { label: formatEntityDisplay('contacts.contact', contact ?? CONTACT_DETAIL_SKELETON), href: `/contacts/${contactId}` },
                ]}
                instanceId={contact?.id ?? 0}
                readonly={true}
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => router.push("/contacts")}>Volver</CancelButton>
                                <ActionSlideButton onClick={() => setModalOpen(true)}>
                                    Editar Contacto
                                </ActionSlideButton>
                            </>
                        }
                    />
                }
            >
                <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Nombre / Razón Social</p>
                            <p className="font-semibold">{contact?.name ?? CONTACT_DETAIL_SKELETON.name}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">RUT</p>
                            <p className="font-semibold">
                                {contact?.tax_id ? formatRUT(contact.tax_id) : 
                                 CONTACT_DETAIL_SKELETON.tax_id ? formatRUT(CONTACT_DETAIL_SKELETON.tax_id) : '—'}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Roles</p>
                            <div className="flex flex-wrap gap-2">
                                {contact?.active_roles ? contact.active_roles.map(role => (
                                    <Chip.Category 
                                        key={role}
                                        domain="contact_type" 
                                        value={role} 
                                        size="sm" 
                                    />
                                )) : (
                                    <Chip.Category 
                                        domain="contact_type" 
                                        value={CONTACT_DETAIL_SKELETON.contact_type} 
                                        size="sm" 
                                    />
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-semibold">{contact?.email ?? CONTACT_DETAIL_SKELETON.email}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Teléfono</p>
                            <p className="font-semibold">{contact?.phone ?? CONTACT_DETAIL_SKELETON.phone}</p>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <p className="text-sm text-muted-foreground">Dirección</p>
                            <p className="font-semibold">
                                {contact?.address || contact?.city ? (
                                    `${contact.address || ""}${contact.address && contact.city ? ", " : ""}${contact.city || ""}`
                                ) : (
                                    CONTACT_DETAIL_SKELETON.address
                                )}
                            </p>
                        </div>
                    </div>

                    {modalOpen && (
                        <ContactModal 
                            open={modalOpen} 
                            onOpenChange={setModalOpen} 
                            contact={contact} 
                            onSuccess={() => {
                                setModalOpen(false)
                                fetchContact()
                                router.refresh()
                            }} 
                        />
                    )}
                </div>
            </EntityDetailPage>
        </SkeletonShell>
    )
}