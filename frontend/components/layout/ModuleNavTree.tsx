"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import type { NavigationConfig, SubTabConfig } from "@/components/providers/HeaderProvider"
import { SidebarNavItem } from "./SidebarNavItem"

/** Nodo genérico: `NavigationTabConfig` y `SubTabConfig` comparten esta forma. */
type NavNode = SubTabConfig

interface ResolvedNode {
    key: string
    label: string
    href: string
    iconName?: string
    /** El propio ítem corresponde a la vista actual. */
    selfActive: boolean
    /** El ítem o algún descendiente es la vista actual (abre el grupo). */
    containsActive: boolean
    children: ResolvedNode[]
}

interface ModuleNavTreeProps {
    navigation: NavigationConfig
    /** Se invoca al navegar (p. ej. cerrar el drawer móvil). */
    onNavigate?: () => void
}

const stripQuery = (href: string) => href.split("?")[0]

/**
 * Árbol de navegación del módulo activo (ADR-0079).
 * Tab sin subTabs → ítem plano. Tab con subTabs → grupo colapsable.
 * Niveles 0/1 resuelven el activo con `activeValue`/`subActiveValue`; nivel 2 por pathname.
 */
export function ModuleNavTree({ navigation, onNavigate }: ModuleNavTreeProps) {
    const pathname = usePathname()
    const { can } = useAuth()
    const { tabs, activeValue, subActiveValue } = navigation
    const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({})

    const visibleTabs = useMemo(() => {
        const canSee = (n: NavNode) => !n.permission || can(n.permission)
        const prune = (nodes: NavNode[]): NavNode[] => nodes
            .filter(canSee)
            .map(n => (n.subTabs ? { ...n, subTabs: prune(n.subTabs) } : n))

        // Un tab sin permiso
        // se oculta pero sus hijos visibles se promueven a la raíz.
        const result: NavNode[] = []
        for (const tab of tabs) {
            if (tab.permission && !can(tab.permission)) {
                result.push(...prune(tab.subTabs ?? []))
            } else {
                result.push(tab.subTabs ? { ...tab, subTabs: prune(tab.subTabs) } : tab)
            }
        }
        return result
    }, [tabs, can])

    const tree = useMemo(() => {
        const resolve = (node: NavNode, depth: number, parentActive: boolean, parentKey: string): ResolvedNode => {
            const key = `${parentKey}/${node.value}`
            const selfActive = depth === 0
                ? node.value === activeValue
                : depth === 1
                    ? parentActive && node.value === subActiveValue
                    : stripQuery(node.href) === pathname
            const children = (node.subTabs ?? []).map(c => resolve(c, depth + 1, selfActive, key))
            return {
                key,
                label: node.label,
                href: node.href,
                iconName: node.iconName,
                selfActive,
                containsActive: selfActive || children.some(c => c.containsActive),
                children,
            }
        }
        // Grupo con un único hijo: se aplana mostrando el hijo con la etiqueta/ícono del padre.
        const flatten = (node: ResolvedNode): ResolvedNode => {
            const children = node.children.map(flatten)
            if (children.length !== 1) return { ...node, children }
            const only = children[0]
            return {
                ...only,
                key: node.key,
                label: node.label,
                iconName: node.iconName,
                selfActive: only.children.length === 0 ? node.selfActive || only.selfActive : only.selfActive,
                containsActive: node.containsActive,
            }
        }
        return visibleTabs.map(t => flatten(resolve(t, 0, true, "")))
    }, [visibleTabs, activeValue, subActiveValue, pathname])

    const renderNode = (node: ResolvedNode, depth: number): React.ReactNode => {
        if (node.children.length === 0) {
            return (
                <SidebarNavItem
                    key={node.key}
                    label={node.label}
                    href={node.href}
                    iconName={node.iconName}
                    depth={depth}
                    isActive={node.selfActive}
                    onClick={onNavigate}
                />
            )
        }

        const expanded = manualOpen[node.key] ?? node.containsActive
        return (
            <div key={node.key} className="flex flex-col gap-px">
                <SidebarNavItem
                    label={node.label}
                    iconName={node.iconName}
                    depth={depth}
                    expanded={expanded}
                    onClick={() => setManualOpen(prev => ({ ...prev, [node.key]: !expanded }))}
                />
                {expanded && node.children.map(child => renderNode(child, depth + 1))}
            </div>
        )
    }

    return (
        <nav aria-label={navigation.moduleName ?? "Módulo"} className="flex flex-col gap-px">
            {tree.map(node => renderNode(node, 0))}
        </nav>
    )
}
