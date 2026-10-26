import type { NavigationConfig, SubTabConfig } from "@/components/providers/HeaderProvider"

export interface PageTab {
    key: string
    label: string
    href: string
    active: boolean
}

const stripQuery = (href: string) => href.split("?")[0]

type Node = SubTabConfig

const containsPath = (node: Node, pathname: string): boolean =>
    stripQuery(node.href) === pathname || (node.subTabs ?? []).some((child) => containsPath(child, pathname))

/**
 * Pestañas de navegación de la barra de trabajo (ADR-0101): las páginas hermanas de la vista actual.
 * Si el grupo activo del módulo tiene subvistas, esas son las pestañas; si no, los grupos del módulo.
 * Los nodos sin permiso se omiten y los hijos de un grupo sin permiso se promueven (como en el sidebar).
 */
export function resolvePageTabs(
    navigation: NavigationConfig | undefined,
    pathname: string,
    hasPermission: (permission: string) => boolean,
): PageTab[] {
    if (!navigation || navigation.tabs.length === 0) return []
    const canSee = (node: Node) => !node.permission || hasPermission(node.permission)

    const level1: Node[] = []
    for (const tab of navigation.tabs) {
        if (canSee(tab)) level1.push(tab)
        else level1.push(...(tab.subTabs ?? []).filter(canSee))
    }

    const group = level1.find((tab) => tab.value === navigation.activeValue)
    const children = (group?.subTabs ?? []).filter(canSee)
    const siblings = children.length > 1 ? children : level1

    return siblings.map((node) => {
        const byValue = children.length > 1
            ? node.value === navigation.subActiveValue
            : node.value === navigation.activeValue
        return {
            key: node.value,
            label: node.label,
            href: node.href,
            active: byValue || containsPath(node, pathname),
        }
    })
}
