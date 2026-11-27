"use client"

import {
    Bell,
    BriefcaseBusiness,
    Building,
    CheckCircle2,
    FileText,
    ListTodo,
    ListTree,
    Package,
    Palette,
    Receipt,
    Scale,
    ShieldCheck,
    ShoppingBag,
    Users,
    Wallet,
} from "lucide-react"
import { RailNav, type RailNavSection } from "@/components/shared"

interface GlobalSettingsSidebarProps {
    activeSection: string
    onSectionChange: (section: string) => void
}

const sections: RailNavSection[] = [
    {
        label: "Empresa",
        items: [
            { label: "General", value: "company_general", icon: Building },
            { label: "Identidad Visual", value: "company_branding", icon: Palette },
        ],
    },
    {
        label: "Cuentas Contables",
        items: [
            { label: "Estructura", value: "accounts_estructura", icon: ListTree },
            { label: "Ventas", value: "accounts_ventas", icon: Receipt },
            { label: "Facturación", value: "accounts_facturacion", icon: FileText },
            { label: "Compras", value: "accounts_compras", icon: ShoppingBag },
            { label: "Inventario", value: "accounts_inventario", icon: Package },
            { label: "Tesorería", value: "accounts_tesoreria", icon: Wallet },
            { label: "RRHH", value: "accounts_rrhh", icon: Users },
            { label: "Socios", value: "accounts_socios", icon: BriefcaseBusiness },
            { label: "Impuestos", value: "accounts_impuestos", icon: Scale },
        ],
    },
    {
        label: "Workflow",
        items: [
            { label: "Aprobaciones", value: "workflow_approvals", icon: CheckCircle2 },
            { label: "Tareas", value: "workflow_tasks", icon: ListTodo },
            { label: "Notificaciones", value: "workflow_notifications", icon: Bell },
            { label: "Políticas", value: "workflow_policies", icon: ShieldCheck },
        ],
    },
]

export function GlobalSettingsSidebar({ activeSection, onSectionChange }: GlobalSettingsSidebarProps) {
    return (
        <RailNav
            sections={sections}
            value={activeSection}
            onValueChange={onSectionChange}
            ariaLabel="Secciones de configuración global"
        />
    )
}
