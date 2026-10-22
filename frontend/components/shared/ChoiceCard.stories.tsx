import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Banknote, Building2, Calendar, ClipboardList, CreditCard, FileText, Layers, Package, Receipt, Truck } from "lucide-react"
import type { Contact } from "@/types/entities"
import { ChoiceCard, ChoiceGroup } from "./ChoiceCard"
import { ContactCard } from "./ContactSelector"

const meta = {
    title: "Shared/ChoiceCard",
    component: ChoiceCard,
    args: { selected: false, onSelect: () => {}, title: "Boleta Electrónica" },
} satisfies Meta<typeof ChoiceCard>
export default meta
type Story = StoryObj<typeof meta>

function Pick<T extends string>({ initial, options, children }: { initial: T; options: readonly T[]; children: (value: T, set: (v: T) => void, options: readonly T[]) => React.ReactNode }) {
    const [value, setValue] = useState<T>(initial)
    return <>{children(value, setValue, options)}</>
}

/** Documento tributario: 2 columns, exempt documents tinted. */
export const TaxDocument: Story = {
    render: () => (
        <Pick initial="FACTURA" options={["BOLETA", "FACTURA", "BOLETA_EXENTA", "FACTURA_EXENTA"] as const}>
            {(value, set) => (
                <div className="w-[34rem]">
                    <ChoiceGroup label="Documento tributario" columns="grid-cols-2">
                        <ChoiceCard selected={value === "BOLETA"} onSelect={() => set("BOLETA")} icon={Receipt} meta="Código SII 39" title="Boleta Electrónica" description="Venta a consumidor final." />
                        <ChoiceCard selected={value === "FACTURA"} onSelect={() => set("FACTURA")} icon={FileText} meta="Código SII 33" title="Factura Electrónica" description="Venta afecta a IVA con crédito fiscal." />
                        <ChoiceCard selected={value === "BOLETA_EXENTA"} onSelect={() => set("BOLETA_EXENTA")} icon={Receipt} tone="warning" meta="Código SII 41" title="Boleta Exenta" description="Venta a consumidor final exenta de IVA." />
                        <ChoiceCard selected={value === "FACTURA_EXENTA"} onSelect={() => set("FACTURA_EXENTA")} icon={FileText} tone="warning" meta="Código SII 34" title="Factura Exenta" description="Venta exenta de IVA." />
                    </ChoiceGroup>
                </div>
            )}
        </Pick>
    ),
}

/** Entrega: three options, the first one ruled out by manufacturing. */
export const Delivery: Story = {
    render: () => (
        <Pick initial="SCHEDULED" options={["IMMEDIATE", "SCHEDULED", "PARTIAL"] as const}>
            {(value, set) => (
                <div className="w-[48rem]">
                    <ChoiceGroup label="Tipo de entrega" columns="grid-cols-3">
                        <ChoiceCard selected={value === "IMMEDIATE"} onSelect={() => set("IMMEDIATE")} disabled icon={Package} title="Despacho Inmediato" description="No disponible: hay productos que requieren fabricación." />
                        <ChoiceCard selected={value === "SCHEDULED"} onSelect={() => set("SCHEDULED")} icon={Calendar} title="Programar Entrega" description="Reservar para fecha futura." />
                        <ChoiceCard selected={value === "PARTIAL"} onSelect={() => set("PARTIAL")} icon={Truck} title="Despacho Parcial" description="Entregar disponibles hoy." />
                    </ChoiceGroup>
                </div>
            )}
        </Pick>
    ),
}

/** Métodos de pago: compact strip, amount pinned in the footer once chosen. */
export const PaymentMethods: Story = {
    render: () => (
        <Pick initial="CASH" options={["CASH", "CARD", "CHECK", "TRANSFER"] as const}>
            {(value, set) => (
                <div className="w-[40rem]">
                    <ChoiceGroup label="Método de pago" columns="grid-cols-3" activation="focus">
                        <ChoiceCard size="compact" selected={value === "CASH"} onSelect={() => set("CASH")} icon={Banknote} iconClassName="text-success" title="Efectivo" description="Pago en efectivo"
                            footer={value === "CASH" && (<span className="flex flex-col"><span className="text-3xs text-muted-foreground">Monto</span><span className="text-sm font-semibold tabular-nums">$ 23.800</span></span>)} />
                        <ChoiceCard size="compact" selected={value === "CARD"} onSelect={() => set("CARD")} icon={CreditCard} title="Tarjeta" description="Débito / Crédito" />
                        <ChoiceCard size="compact" selected={value === "CHECK"} onSelect={() => set("CHECK")} icon={ClipboardList} iconClassName="text-warning" title="Cheque" description="Cheque bancario" />
                        <ChoiceCard size="compact" selected={value === "TRANSFER"} onSelect={() => set("TRANSFER")} icon={Building2} disabled title="Transferencia" description="No disponible" />
                        <ChoiceCard size="compact" selected={false} onSelect={() => {}} icon={Layers} title="Múltiple" description="Varios métodos" />
                    </ChoiceGroup>
                </div>
            )}
        </Pick>
    ),
}

const CONTACTS = [
    { id: 1, name: "Imprenta Los Andes SpA", tax_id: "76123456-7", contact_type: "COMPANY", credit_available: 1850000, credit_balance_used: 0, last_sale_date: "2026-10-12" },
    { id: 2, name: "María Fernanda Soto", tax_id: "12345678-5", contact_type: "PERSON", credit_available: 250000, credit_balance_used: 98700, last_sale_date: "2026-09-30" },
    { id: 3, name: "Cliente sin RUT registrado", tax_id: "", contact_type: "PERSON", credit_available: 0, credit_balance_used: 0, last_sale_date: null },
] as unknown as Contact[] // fixtures carry only the fields the card reads

/** Contactos: Blobatar on the strip, RUT in mono, credit position pinned at the bottom. */
export const Contacts: Story = {
    render: () => {
        const [selected, setSelected] = useState("2")
        return (
            <div className="w-[52rem]">
                <ChoiceGroup label="Contactos" columns="grid-cols-3">
                    {CONTACTS.map((contact) => (
                        <ContactCard key={contact.id} contact={contact} selected={selected === String(contact.id)} onSelect={(c) => setSelected(String(c.id))} />
                    ))}
                </ChoiceGroup>
            </div>
        )
    },
}

export const ContactsDark: Story = { ...Contacts, globals: { theme: "dark" } }
export const PaymentMethodsDark: Story = { ...PaymentMethods, globals: { theme: "dark" } }
