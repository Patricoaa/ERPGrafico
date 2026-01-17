"use client"

import { useState, useEffect } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Plus } from "lucide-react"
import api from "@/lib/api"
import { ContactModal } from "@/components/contacts/ContactModal"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { formatRUT } from "@/lib/utils/format"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

interface Contact {
    id: number
    name: string
    tax_id: string | null
    contact_type: string
    email: string | null
    phone: string | null
    address: string | null
}

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<any>(null)

    const fetchContacts = async () => {
        setLoading(true)
        try {
            const res = await api.get("/contacts/")
            setContacts(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching contacts", error)
            toast.error("No se pudieron cargar los contactos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchContacts()
    }, [])

    const handleDelete = async (contact: any, isConfirmed = false) => {
        if (!contact) return

        if (!isConfirmed) {
            setContactToDelete(contact)
            setIsDeleteModalOpen(true)
            return
        }

        try {
            await api.delete(`/contacts/${contact.id}/`)
            toast.success("El contacto ha sido eliminado exitosamente")
            setIsDeleteModalOpen(false)
            fetchContacts()
        } catch (error) {
            toast.error("No se pudo eliminar el contacto. Puede que tenga documentos asociados.")
        }
    }

    const getContactTypeBadge = (type: string) => {
        switch (type) {
            case 'CUSTOMER':
                return <Badge className="bg-blue-500 hover:bg-blue-600">Cliente</Badge>
            case 'SUPPLIER':
                return <Badge className="bg-purple-500 hover:bg-purple-600">Proveedor</Badge>
            case 'BOTH':
                return <Badge className="bg-green-500 hover:bg-green-600">Ambos</Badge>
            default:
                return <Badge variant="outline">Sin Clasificar</Badge>
        }
    }

    // Definición de columnas para DataTable
    const columns: ColumnDef<Contact>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "tax_id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="RUT / Identificación" />
            ),
            cell: ({ row }) => {
                const taxId = row.getValue("tax_id") as string | null
                return taxId ? formatRUT(taxId) : 'S/Rut'
            },
        },
        {
            accessorKey: "contact_type",
            header: "Tipo",
            cell: ({ row }) => getContactTypeBadge(row.getValue("contact_type")),
        },
        {
            accessorKey: "email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email" />
            ),
            cell: ({ row }) => {
                const email = row.getValue("email") as string | null
                return email || "-"
            },
        },
        {
            accessorKey: "phone",
            header: "Teléfono",
            cell: ({ row }) => {
                const phone = row.getValue("phone") as string | null
                return phone || "-"
            },
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => {
                const contact = row.original
                return (
                    <div className="flex justify-center space-x-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setSelectedContact(contact)
                                setModalOpen(true)
                            }}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(contact)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Contactos</h2>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => { setSelectedContact(null); setModalOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Contacto
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center">
                    Cargando contactos...
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={contacts}
                    globalFilterFields={["name", "tax_id"]}
                    searchPlaceholder="Buscar por nombre o RUT..."
                    defaultPageSize={20}
                />
            )}

            <ContactModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                contact={selectedContact}
                onSuccess={() => {
                    setModalOpen(false)
                    setSelectedContact(null)
                    fetchContacts()
                }}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
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
        </div>
    )
}
