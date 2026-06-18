"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"

export function InventoryHeader() {
    const pathname = usePathname()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'products'

    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment

    // Determine subActiveValue from path segments
    const subActiveValue = (() => {
        if (activeValue === 'config') return segments[2] || 'valuation'
        if (activeValue === 'products') return segments[2] || 'products'
        if (activeValue === 'stock') return segments[2] || 'report'
        if (activeValue === 'uoms') return segments[2] || 'units'
        return undefined
    })()

    const tabs = [
        {
            value: "products",
            label: "Productos",
            iconName: getEntityIconName('inventory.product'),
            href: "/inventory/products",
            subTabs: [
                { value: "products", label: "Catálogo", iconName: getEntityIconName('inventory.product'), href: "/inventory/products" },
                { value: "categories", label: "Categorías", iconName: getEntityIconName('inventory.productcategory'), href: "/inventory/products/categories" },
                { value: "pricing-rules", label: "Precios", iconName: getEntityIconName('inventory.pricingrule'), href: "/inventory/products/pricing-rules" },
                { value: "subscriptions", label: "Suscripciones", iconName: "calendar-clock", href: "/inventory/products/subscriptions" },
            ]
        },
        {
            value: "stock",
            label: "Existencias",
            iconName: getEntityIconName('inventory.stockmove'),
            href: "/inventory/stock",
            subTabs: [
                { value: "report", label: "Reporte", iconName: "file-text", href: "/inventory/stock/report" },
                { value: "movements", label: "Movimientos", iconName: getEntityIconName('inventory.stockmove'), href: "/inventory/stock/movements" },
                { value: "warehouses", label: "Almacenes", iconName: getEntityIconName('inventory.warehouse'), href: "/inventory/stock/warehouses" },
            ]
        },
        {
            value: "uoms",
            label: "Unidades",
            iconName: getEntityIconName('inventory.uom'),
            href: "/inventory/uoms",
            subTabs: [
                { value: "units", label: "Unidades de Medida", iconName: getEntityIconName('inventory.uom'), href: "/inventory/uoms/units" },
                { value: "categories", label: "Categorías de Medida", iconName: getEntityIconName('inventory.uomcategory'), href: "/inventory/uoms/categories" },
            ]
        },
        { value: "attributes", label: "Atributos", iconName: "tags", href: "/inventory/attributes" },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/inventory/settings",
            subTabs: [
                { value: "valuation", label: "Valorización", href: "/inventory/settings", iconName: "package" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Inventario",
        moduleHref: "/inventory/products",
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'config') return { title: "Configuración de Inventario", description: "Gestione el método de valorización de inventario.", iconName: "settings" as const }
        if (activeValue === 'attributes') return { title: "Atributos de Variantes", description: "Gestión de atributos para variaciones.", iconName: "tags" as const }
        if (activeValue === 'uoms') {
            if (subActiveValue === 'categories') return { title: "Categorías de Medida", description: "Clasificación de magnitudes compatibles (peso, volumen, longitud).", iconName: getEntityIconName('inventory.uomcategory') }
            return { title: "Unidades de Medida", description: "Configuración de métricas y factores de conversión estándar.", iconName: getEntityIconName('inventory.uom') }
        }
        if (activeValue === 'stock') {
            if (subActiveValue === 'movements') return { title: "Movimientos de Stock", description: "Histórico de entradas, salidas y transferencias entre ubicaciones.", iconName: getEntityIconName('inventory.stockmove') }
            if (subActiveValue === 'warehouses') return { title: "Almacenes y Ubicaciones", description: "Estructura física y lógica para el almacenamiento de mercadería.", iconName: getEntityIconName('inventory.warehouse') }
            return { title: "Reporte de Existencias", description: "Estado actual del inventario por almacén, valorizado en tiempo real.", iconName: "file-text" as const }
        }
        if (activeValue === 'products') {
            if (subActiveValue === 'subscriptions') return { title: "Suscripciones y Recurrentes", description: "Gestión de servicios mensuales, contratos y facturación automática.", iconName: "calendar-clock" as const }
            if (subActiveValue === 'categories') return { title: "Categorías de Productos", description: "Organización y clasificación jerárquica del catálogo general.", iconName: getEntityIconName('inventory.productcategory') }
            if (subActiveValue === 'pricing-rules') return { title: "Reglas de Precios", description: "Políticas de tarifas, descuentos y márgenes por cliente o volumen.", iconName: getEntityIconName('inventory.pricingrule') }
            return { title: "Catálogo de Productos", description: "Gestión de bienes físicos, servicios y consumibles.", iconName: getEntityIconName('inventory.product') }
        }
        return { title: "Inventario", description: "", iconName: getEntityIconName('inventory.product') ?? "package" }
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
