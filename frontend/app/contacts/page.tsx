"use client"

import { useState, useEffect } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Phone, Mail, Plus } from "lucide-react"
import api from "@/lib/api"
import { ContactModal } from "@/components/contacts/ContactModal"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { Input } from "@/components/ui/input"
import { formatRUT } from "@/lib/utils/format"

export default function ContactsPage() {
    const [contacts, setContacts] = useState<any[]>([])
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



            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>RUT / Identificación</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                    Cargando...
                                </TableCell>
                            </TableRow>
                        ) : contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No se encontraron contactos
                                </TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => (
                                <TableRow key={contact.id} className="group hover:bg-muted/20 transition-colors">
                                    <TableCell className="font-medium">{contact.name}</TableCell>
                                    <TableCell>{contact.tax_id ? formatRUT(contact.tax_id) : 'S/Rut'}</TableCell>
                                    <TableCell>{getContactTypeBadge(contact.contact_type)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                            {contact.phone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" /> {contact.phone}
                                                </div>
                                            )}
                                            {contact.email && (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {contact.email}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => { setSelectedContact(contact); setModalOpen(true); }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive/90"
                                            onClick={() => handleDelete(contact)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <ContactModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                contact={selectedContact}
                onSuccess={fetchContacts}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Eliminar Contacto"
                variant="destructive"
                onConfirm={() => { if (contactToDelete) return handleDelete(contactToDelete, true) }}
                confirmText="Eliminar Contacto"
                description={
                    <div className="space-y-3">
                        <p>¿Está seguro de que desea eliminar al contacto <strong>{contactToDelete?.name}</strong>?</p>
                        <p className="text-xs text-muted-foreground border-l-2 pl-3 border-amber-400">
                            <strong>Nota:</strong> Solo podrá eliminar este contacto si no tiene facturas, órdenes o movimientos contables asociados. De lo contrario, la acción fallará por integridad de datos.
                        </p>
                    </div>
                }
            />
        </div>
    )
}
