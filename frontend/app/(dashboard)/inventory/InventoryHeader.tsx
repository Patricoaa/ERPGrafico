"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function InventoryHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { getViewModeUrl } = useViewModePreference()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'products'

    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment

    const subActiveValue = (() => {
        if (activeValue === 'products') {
            return segments[2] || 'products'
        }
        if (activeValue === 'reports') return segments[2] || 'stock'
        if (activeValue === 'operations') return segments[2] || 'warehouses'
        if (activeValue === 'config') return segments[2] || 'valuation'
        return undefined
    })()

    const tabs = [
        {
            value: "products",
            label: "Productos",
            iconName: getEntityIconName('inventory.product'),
            href: getViewModeUrl('inventory.product', "/inventory/products"),
            subTabs: [
                { value: "products", label: "Catálogo", iconName: getEntityIconName('inventory.product'), href: getViewModeUrl('inventory.product', "/inventory/products") },
                { value: "uoms", label: "Unidades de medida", iconName: getEntityIconName('inventory.uom'), href: "/inventory/products/uoms/units" },
                { value: "pricing-rules", label: "Precios", iconName: getEntityIconName('inventory.pricingrule'), href: getViewModeUrl('inventory.pricingrule', "/inventory/products/pricing-rules") },
                { value: "attributes", label: "Atributos", iconName: getEntityIconName('inventory.attribute'), href: "/inventory/products/attributes" },
            ]
        },
        {
            value: "reports",
            label: "Reportes",
            iconName: "file-text",
            href: "/inventory/reports",
            subTabs: [
                { value: "stock", label: "Existencias", iconName: "package", href: getViewModeUrl('inventory.stockreport', "/inventory/reports/stock") },
                { value: "movements", label: "Movimientos de stock", iconName: getEntityIconName('inventory.stockmove'), href: getViewModeUrl('inventory.stockmove', "/inventory/reports/movements") },
            ]
        },
        {
            value: "operations",
            label: "Operaciones",
            iconName: "activity",
            href: "/inventory/operations",
            subTabs: [
                { value: "warehouses", label: "Almacenes", iconName: getEntityIconName('inventory.warehouse'), href: getViewModeUrl('inventory.warehouse', "/inventory/operations/warehouses") },
                { value: "documents", label: "Recepciones, entregas y ajustes", iconName: "file-text", href: "/inventory/operations/documents" },
                { value: "counts", label: "Conteo de Inventario", iconName: "clipboard-check", href: "/inventory/operations/counts" },
            ]
        },
        {
            value: "config",
            label: "Configuración",
            iconName: "settings",
            href: "/inventory/settings",
            subTabs: [
                { value: "valuation", label: "Valorización", href: "/inventory/settings", iconName: "package" },
                { value: "categories", label: "Categorías de Productos", href: "/inventory/settings/categories", iconName: getEntityIconName('inventory.category') },
                { value: "measure-categories", label: "Categorías de Medidas", href: "/inventory/settings/measure-categories", iconName: getEntityIconName('inventory.uomcategory') },
            ]
        },
    ]

    const navigation = {
        moduleName: "Inventario",
        moduleHref: getViewModeUrl('inventory.product', "/inventory/products"),
        tabs,
        activeValue,
        subActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'products') {
            if (subActiveValue === 'uoms') {
                return { title: "Unidades de Medida", description: "Configuración de métricas y factores de conversión estándar.", iconName: getEntityIconName('inventory.uom') }
            }
            if (subActiveValue === 'attributes') return { title: "Atributos de Variantes", description: "Propiedades variables: tallas, colores, materiales y más.", iconName: getEntityIconName('inventory.attribute') }
            if (subActiveValue === 'pricing-rules') return { title: "Reglas de Precios", description: "Políticas de tarifas, descuentos y márgenes por cliente o volumen.", iconName: getEntityIconName('inventory.pricingrule') }
            return { title: "Catálogo de Productos", description: "Gestión de bienes físicos, servicios y consumibles.", iconName: getEntityIconName('inventory.product') }
        }
        if (activeValue === 'reports') {
            const productName = searchParams.get('product_name')
            if (subActiveValue === 'stock' && productName) return { title: productName, description: "Insights y movimientos históricos del producto.", iconName: "bar-chart-3" as const }
            if (subActiveValue === 'movements') return { title: "Movimientos de Stock", description: "Histórico de entradas, salidas y transferencias entre ubicaciones.", iconName: getEntityIconName('inventory.stockmove') }
            return { title: "Existencias", description: "Estado actual del inventario por almacén, valorizado en tiempo real.", iconName: "package" as const }
        }
        if (activeValue === 'operations') {
            if (subActiveValue === 'documents') return { title: "Recepciones, Entregas y Ajustes", description: "Historial y gestión de movimientos físicos, transferencias y mermas.", iconName: "file-text" as const }
            if (subActiveValue === 'counts') return { title: "Conteo de Inventario", description: "Conteo rápido de stock teórico vs real y generación de ajustes.", iconName: "clipboard-check" as const }
            return { title: "Almacenes y Ubicaciones", description: "Estructura física y lógica para el almacenamiento de mercadería.", iconName: getEntityIconName('inventory.warehouse') }
        }
        if (activeValue === 'config') {
            if (subActiveValue === 'categories') return { title: "Categorías de Productos", description: "Organización y clasificación jerárquica del catálogo general.", iconName: getEntityIconName('inventory.category') }
            if (subActiveValue === 'measure-categories') return { title: "Categorías de Medidas", description: "Clasificación de magnitudes compatibles (peso, volumen, longitud).", iconName: getEntityIconName('inventory.uomcategory') }
            return { title: "Configuración de Inventario", description: "Parámetros generales del módulo de inventario.", iconName: "settings" as const }
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
