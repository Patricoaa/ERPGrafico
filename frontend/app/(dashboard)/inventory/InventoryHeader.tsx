"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function InventoryHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'products'

    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment

    // Sub-tab params still live in ?tab= for within-route navigation
    const subTabParam = searchParams.get('tab')
    const modalParam = searchParams.get('modal')

    // Determine subActiveValue based on route + query param
    const subActiveValue = (() => {
        if (activeValue === 'config') return subTabParam || 'accounts'
        if (activeValue === 'products') return subTabParam || 'products'
        if (activeValue === 'stock') return subTabParam || 'report'
        if (activeValue === 'uoms') return subTabParam || 'units'
        return undefined
    })()

    const tabs = [
        {
            value: "products",
            label: "Productos",
            iconName: "package",
            href: "/inventory/products",
            subTabs: [
                { value: "products", label: "Catálogo", iconName: "package", href: "/inventory/products?tab=products" },
                { value: "categories", label: "Categorías", iconName: "layout-grid", href: "/inventory/products?tab=categories" },
                { value: "pricing-rules", label: "Precios", iconName: "banknote", href: "/inventory/products?tab=pricing-rules" },
                { value: "subscriptions", label: "Suscripciones", iconName: "calendar-clock", href: "/inventory/products?tab=subscriptions" },
            ]
        },
        {
            value: "stock",
            label: "Existencias",
            iconName: "warehouse",
            href: "/inventory/stock",
            subTabs: [
                { value: "report", label: "Reporte", iconName: "file-text", href: "/inventory/stock?tab=report" },
                { value: "movements", label: "Movimientos", iconName: "arrow-left-right", href: "/inventory/stock?tab=movements" },
                { value: "warehouses", label: "Almacenes", iconName: "warehouse", href: "/inventory/stock?tab=warehouses" },
            ]
        },
        {
            value: "uoms",
            label: "Unidades",
            iconName: "scale",
            href: "/inventory/uoms",
            subTabs: [
                { value: "units", label: "Unidades de Medida", iconName: "scale", href: "/inventory/uoms?tab=units" },
                { value: "categories", label: "Categorías de Medida", iconName: "layout-grid", href: "/inventory/uoms?tab=categories" },
            ]
        },
        { value: "attributes", label: "Atributos", iconName: "tags", href: "/inventory/attributes" },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/inventory/settings",
            subTabs: [
                { value: "accounts", label: "Cuentas", href: "/inventory/settings?tab=accounts", iconName: "package" },
                { value: "adjustments", label: "Ajustes", href: "/inventory/settings?tab=adjustments", iconName: "arrow-left-right" },
                { value: "cogs", label: "Costo Ventas", href: "/inventory/settings?tab=cogs", iconName: "dollar-sign" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Inventario",
        moduleHref: "/inventory/products?tab=products",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Inventario", description: "Gestione las cuentas de stock, ajustes y costo de ventas.", iconName: "settings" as const }
        if (activeValue === 'attributes') return { title: "Atributos de Variantes", description: "Gestión de atributos para variaciones.", iconName: "tags" as const }
        if (activeValue === 'uoms') {
            if (subActiveValue === 'categories') return { title: "Categorías de Medida", description: "Clasificación de magnitudes compatibles (peso, volumen, longitud).", iconName: "layout-grid" as const }
            return { title: "Unidades de Medida", description: "Configuración de métricas y factores de conversión estándar.", iconName: "scale" as const }
        }
        if (activeValue === 'stock') {
            if (subActiveValue === 'movements') return { title: "Movimientos de Stock", description: "Histórico de entradas, salidas y transferencias entre ubicaciones.", iconName: "arrow-left-right" as const }
            if (subActiveValue === 'warehouses') return { title: "Almacenes y Ubicaciones", description: "Estructura física y lógica para el almacenamiento de mercadería.", iconName: "warehouse" as const }
            return { title: "Reporte de Existencias", description: "Estado actual del inventario por almacén, valorizado en tiempo real.", iconName: "file-text" as const }
        }
        if (activeValue === 'products') {
            if (subActiveValue === 'subscriptions') return { title: "Suscripciones y Recurrentes", description: "Gestión de servicios mensuales, contratos y facturación automática.", iconName: "calendar-clock" as const }
            if (subActiveValue === 'categories') return { title: "Categorías de Productos", description: "Organización y clasificación jerárquica del catálogo general.", iconName: "layout-grid" as const }
            if (subActiveValue === 'pricing-rules') return { title: "Reglas de Precios", description: "Políticas de tarifas, descuentos y márgenes por cliente o volumen.", iconName: "banknote" as const }
            return { title: "Catálogo de Productos", description: "Gestión de bienes físicos, servicios y consumibles.", iconName: "package" as const }
        }
        return { title: "Inventario", description: "", iconName: "package" as const }
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
