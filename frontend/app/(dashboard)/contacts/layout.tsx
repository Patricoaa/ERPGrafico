import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { ContactsHeader } from "./ContactsHeader"

export const metadata: Metadata = {
    title: "Contactos | ERPGrafico",
    description: "Gestión de clientes, proveedores y contactos generales.",
}

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <ContactsHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
