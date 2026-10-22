"use client"

import { Building2, User as UserIcon } from "lucide-react"
import { DataCell } from "@/components/shared"
import { Blobatar } from "@/components/ui/blobatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { resolveCategory } from "@/lib/badge-resolvers"
import { formatRUT } from "@/lib/utils/format"
import type { Contact } from "../types"

/**
 * Feature extension: contact name with the "default customer / default vendor" badges
 * (replaces the `computed` name column). Used by one entity → lives with it.
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        contactName: { value: Contact; options: Record<never, never> }
    }
}

function RoleBadge({ label, className, children }: { label: string; className: string; children: React.ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${className}`} aria-label={label}>{children}</span>
            </TooltipTrigger>
            <TooltipContent className="rounded-sm">{label}</TooltipContent>
        </Tooltip>
    )
}

function ContactNameCell({ value: contact, align }: ValueRenderProps<"contactName">) {
    return (
        <TooltipProvider>
            <div className={`flex w-full items-center gap-2 ${align === "center" ? "justify-center" : ""}`}>
                {contact.is_default_customer && (
                    <RoleBadge label="Cliente por defecto" className="bg-primary/15 text-primary"><UserIcon className="h-3 w-3" /></RoleBadge>
                )}
                {contact.is_default_vendor && (
                    <RoleBadge label="Proveedor por defecto" className="bg-success/15 text-success"><Building2 className="h-3 w-3" /></RoleBadge>
                )}
                <DataCell.Text>{contact.name}</DataCell.Text>
            </div>
        </TooltipProvider>
    )
}

function ContactAvatar({ row }: { row: Contact }) {
    return <Blobatar name={row.name} className="h-12 w-12 shrink-0 rounded-md" />
}

let registered = false
function registerContactValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("contactName", {
        format: (c) => c.name,
        shrink: true,
        render: ContactNameCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerContactValueKinds()

const RISK_LABEL: Record<NonNullable<Contact["credit_risk_level"]>, string> = {
    LOW: "Bajo Riesgo",
    MEDIUM: "Riesgo Medio",
    HIGH: "Alto Riesgo",
    CRITICAL: "Riesgo Crítico / Incobrable",
}

/** Contact (ADR-0087 oleada A4). Replaces contactFields.tsx (1 computed) + renderCard. */
export const contactEntity = defineEntity<Contact>()((f) => ({
    label: "contacts.contact",
    fields: {
        name: f.value("contactName", (c) => c, { label: "Nombre" }),
        taxId: f.text((c) => (c.tax_id ? formatRUT(c.tax_id) : "S/Rut"), { label: "RUT / Identificación", align: "center" }),
        displayId: f.code("display_id", { label: "Código Interno" }),
        email: f.text("email", { label: "Email" }),
        phone: f.text("phone", { label: "Teléfono" }),
        roles: f.tags((c) => c.active_roles ?? [], { label: "Roles", domain: "contact_type", sortable: false }),
        // Grouping dimension only (search "Tipo"): the readable type, not the enum code.
        contactType: f.text((c) => resolveCategory("contact_type", c.contact_type).label, { label: "Tipo" }),
        // Grouping dimension only (search "Riesgo").
        riskLevel: f.text((c) => (c.credit_risk_level ? RISK_LABEL[c.credit_risk_level] : null), { label: "Riesgo" }),
        isActive: f.status((c) => (c.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
    },
}))

export const contactViews = contactEntity.views({
    table: { columns: ["name", "taxId", "displayId", "isActive", "email", "phone", "roles"], defaultSort: "name" },
    card: { code: "displayId", title: "name", subtitle: ["taxId"], meta: ["email", "phone"], trailing: ["roles", "isActive"], media: { placement: "top", avatar: ContactAvatar } },
})
