"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormSkeleton, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import api from "@/lib/api"
import type { Contact } from "@/features/contacts/types"
import { formatRUT } from "@/lib/utils/format"
import { StatusBadge } from "@/components/shared/StatusBadge"
import ContactModal from "@/features/contacts/components/ContactModal"

interface ContactDetailClientProps {
    contactId: string
}

export function ContactDetailClient({ contactId }: ContactDetailClientProps) {
    const router = useRouter()
    const [contact, setContact] = useState<Contact | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [modalOpen, setModalOpen] = useState(false)

    const fetchContact = async () => {
        try {
            const response = await api.get(`/contacts/${contactId}/`)
            setContact(response.data)
        } catch (err: any) {
            setError(err.response?.status || 500)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchContact()
    }, [contactId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar contacto
        </div>
    )

    if (loading || !contact) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const displayId = contact.display_id || `#${contactId}`

    return (
        <EntityDetailPage
            entityType="contact"
            title="Ficha de Contacto"
            displayId={displayId}
            icon="user"
            breadcrumb={[
                { label: "Contactos", href: "/contacts" },
                { label: displayId, href: `/contacts/${contactId}` },
            ]}
            instanceId={parseInt(contactId)}
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
                        <p className="font-semibold">{contact.name}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">RUT</p>
                        <p className="font-semibold">{contact.tax_id ? formatRUT(contact.tax_id) : '—'}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Tipo</p>
                        <div>
                            <StatusBadge status={contact.contact_type} size="sm" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-semibold">{contact.email || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Teléfono</p>
                        <p className="font-semibold">{contact.phone || "—"}</p>
                    </div>
                    <div className="space-y-2 col-span-2">
                        <p className="text-sm text-muted-foreground">Dirección</p>
                        <p className="font-semibold">
                            {contact.address ? `${contact.address}${contact.city ? `, ${contact.city}` : ''}` : '—'}
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
    )
}
