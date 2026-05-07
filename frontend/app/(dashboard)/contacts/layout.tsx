import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { ContactsHeader } from "./ContactsHeader"

export const metadata: Metadata = {
    title: "Contactos | ERPGrafico",
    description: "Gestión de clientes, proveedores y contactos generales.",
}

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer>
            <ContactsHeader />
            <div className="pt-2">
                {children}
            </div>
        </PageContainer>
    )
}
