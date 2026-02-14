import { Metadata } from "next"
import { ContactsClientView } from "@/components/contacts/ContactsClientView"

export const metadata: Metadata = {
    title: "Contactos | ERPGrafico",
    description: "Directorio centralizado de clientes, proveedores y colaboradores.",
}

export default function ContactsPage() {
    return <ContactsClientView />
}
