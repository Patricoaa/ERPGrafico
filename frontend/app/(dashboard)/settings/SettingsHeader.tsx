"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"

export const SETTINGS_TABS = [
    {
        value: "overview",
        label: "Resumen",
        iconName: "layout-dashboard",
        href: "/settings",
    },
    {
        value: "company",
        label: "Empresa",
        iconName: "building-2",
        href: "/settings/company",
        subTabs: [
            { value: "general", label: "General", iconName: "building", href: "/settings/company?tab=general" },
            { value: "branding", label: "Identidad Visual", iconName: "palette", href: "/settings/company?tab=branding" },
        ]
    },
    {
        value: "users",
        label: "Usuarios",
        iconName: "shield-check",
        href: "/settings/users",
        subTabs: [
            { value: "users", label: "Usuarios", iconName: "users", href: "/settings/users?tab=users" },
            { value: "groups", label: "Grupos y Equipos", iconName: "user-plus", href: "/settings/users?tab=groups" },
        ]
    },
    {
        value: "audit",
        label: "Auditoría",
        iconName: "history",
        href: "/settings/audit",
    },
    {
        value: "workflow",
        label: "Workflow",
        iconName: "git-branch",
        href: "/settings/workflow",
        subTabs: [
            { value: "approvals", label: "Aprobaciones", iconName: "check-circle-2", href: "/settings/workflow?tab=approvals" },
            { value: "tasks", label: "Tareas", iconName: "list-todo", href: "/settings/workflow?tab=tasks" },
            { value: "notif", label: "Notificaciones", iconName: "bell", href: "/settings/workflow?tab=notif" },
        ]
    },
]

export function SettingsHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'overview'

    const activeValue = currentSegment
    const subActiveValue = searchParams.get('tab')

    const navigation = {
        moduleName: "Configuración Global",
        moduleHref: "/settings",
        tabs: SETTINGS_TABS,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        switch (activeValue) {
            case 'company':
                if (subActiveValue === 'branding') {
                    return { 
                        title: "Identidad Visual", 
                        description: "Logotipos, colores corporativos y apariencia de documentos.", 
                        iconName: "palette" 
                    }
                }
                return { 
                    title: "Datos de la Empresa", 
                    description: "Configure la información fiscal, logotipos y presencia de su organización.", 
                    iconName: "building-2" 
                }
            case 'users':
                if (subActiveValue === 'groups') {
                    return { 
                        title: "Grupos y Equipos", 
                        description: "Organice a sus colaboradores por departamentos o funciones específicas.", 
                        iconName: "user-plus" 
                    }
                }
                return { 
                    title: "Usuarios y Permisos", 
                    description: "Gestione el acceso al sistema, roles y políticas de seguridad.", 
                    iconName: "shield-check" 
                }
            case 'audit':
                return { 
                    title: "Registro de Auditoría", 
                    description: "Trazabilidad completa de acciones y cambios realizados en el sistema.", 
                    iconName: "history" 
                }
            case 'workflow':
                if (subActiveValue === 'tasks') return { title: "Tareas Automáticas", description: "Configuración de responsables y disparadores de tareas.", iconName: "list-todo" }
                if (subActiveValue === 'notif') return { title: "Notificaciones", description: "Reglas de envío de alertas y correos del sistema.", iconName: "bell" }
                return { 
                    title: "Flujos de Trabajo", 
                    description: "Automatización de procesos y reglas de negocio transversales.", 
                    iconName: "git-branch" 
                }
            default:
                return { 
                    title: "Configuración Global", 
                    description: "Panel de administración y parámetros transversales del sistema.", 
                    iconName: "settings" 
                }
        }
    }

    const config = getHeaderConfig()

    return (
        <PageHeader 
            title={config.title} 
            description={config.description} 
            iconName={config.iconName} 
            variant="minimal" 
            navigation={navigation} 
        />
    )
}
