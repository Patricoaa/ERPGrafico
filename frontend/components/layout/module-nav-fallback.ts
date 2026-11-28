import type { NavigationConfig, NavigationTabConfig } from "@/components/providers/HeaderProvider"
import type { NavTabConfig } from "@/lib/navigation-types"
import { ACCOUNTING_TABS } from "@/features/accounting/navigation"
import { FINANCES_TABS } from "@/features/finances/navigation"
import { HR_TABS } from "@/features/hr/navigation"
import { INVENTORY_TABS } from "@/features/inventory/navigation"
import { PURCHASING_TABS } from "@/features/purchasing/navigation"
import { SALES_TABS } from "@/features/sales/navigation"
import { SECURITY_TABS } from "@/features/security/navigation"
import { TREASURY_TABS } from "@/features/treasury/navigation"

/**
 * Árbol de vistas para los módulos que no son el activo. El shell sólo recibe
 * el `navigation` del módulo actual (HeaderProvider.moduleNavigation), así que
 * el primer nivel necesita una fuente adicional para poder desplegar cualquier
 * módulo. Reutiliza las constantes canónicas `*_TABS`; el módulo activo siempre
 * usa la navegación publicada por su `[Module]Header` (con bancos y preferencias
 * de vista resueltos).
 */
const toNavTab = (tab: NavTabConfig): NavigationTabConfig => ({
    value: tab.value,
    label: tab.label,
    href: tab.href,
    iconName: tab.iconName,
    ...(tab.subTabs?.length ? { subTabs: tab.subTabs.map(toNavTab) } : {}),
})

/** Dos módulos del registro no tienen `navigation.ts`: sus pestañas viven en su header. */
const LOCAL_TABS: Record<string, NavTabConfig[]> = {
    contacts: [{
        value: "contacts",
        label: "Directorio",
        href: "/contacts",
        iconName: "users",
        headerTitle: "Contactos",
        headerDescription: "Directorio de clientes, proveedores y contactos.",
        metadataTitle: "Contactos | ERPGrafico",
    }],
    production: [
        {
            value: "orders",
            label: "Órdenes de Trabajo",
            href: "/production/orders",
            iconName: "clipboard-list",
            headerTitle: "Órdenes de Trabajo",
            headerDescription: "Planificación y seguimiento de procesos fabriles.",
            metadataTitle: "Órdenes de Trabajo | ERPGrafico",
        },
        {
            value: "boms",
            label: "Listas de Materiales",
            href: "/production/boms",
            iconName: "layers",
            headerTitle: "Listas de Materiales",
            headerDescription: "Estructuras de productos, componentes y costos de fabricación.",
            metadataTitle: "Listas de Materiales | ERPGrafico",
        },
    ],
}

const FALLBACK_TABS: Record<string, NavTabConfig[]> = {
    accounting: ACCOUNTING_TABS,
    sales: SALES_TABS,
    contacts: LOCAL_TABS.contacts,
    inventory: INVENTORY_TABS,
    production: LOCAL_TABS.production,
    treasury: TREASURY_TABS,
    purchasing: PURCHASING_TABS,
    finances: FINANCES_TABS,
    hr: HR_TABS,
    security: SECURITY_TABS,
}

/** Navegación de un módulo inactivo; `undefined` si no publica vistas. */
export function getFallbackModuleNavigation(moduleId: string): NavigationConfig | undefined {
    const tabs = FALLBACK_TABS[moduleId]
    if (!tabs?.length) return undefined
    return { tabs: tabs.map(toNavTab), activeValue: "" }
}
