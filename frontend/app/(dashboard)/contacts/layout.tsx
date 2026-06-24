import { type Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { ContactsHeader } from "./ContactsHeader"

export const metadata: Metadata = {
    title: "Contactos | ERPGrafico",
    description: "Gestión de clientes, proveedores y contactos generales.",
}

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <ContactsHeader />
            <div className="h-full flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
