"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { getEntityIconName } from "@/lib/entity-registry"
import { useViewModePreference } from "@/hooks/useViewModePreference"

export function InventoryHeader() {
    const pathname = usePathname()
    const { getViewModeUrl } = useViewModePreference()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'products'

    const activeValue = currentSegment === 'settings' ? 'config' : currentSegment

    const subActiveValue = (() => {
        if (activeValue === 'products') return segments[2] || 'products'
        if (activeValue === 'stock') return segments[2] || 'report'
        if (activeValue === 'config') return segments[2] || 'valuation'
        return undefined
    })()

    const subSubActiveValue = (() => {
        if (activeValue === 'products' && segments[2] === 'uoms') return segments[3] || 'units'
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
                {
                    value: "uoms",
                    label: "Unidades de medida",
                    iconName: getEntityIconName('inventory.uom'),
                    href: "/inventory/products/uoms",
                    subTabs: [
                        { value: "units", label: "Unidades", href: "/inventory/products/uoms/units", iconName: getEntityIconName('inventory.uom') },
                        { value: "uom-categories", label: "Categorías de Medida", href: "/inventory/products/uoms/categories", iconName: getEntityIconName('inventory.uomcategory') },
                    ]
                },
                { value: "pricing-rules", label: "Precios", iconName: getEntityIconName('inventory.pricingrule'), href: getViewModeUrl('inventory.pricingrule', "/inventory/products/pricing-rules") },
                { value: "subscriptions", label: "Suscripciones", iconName: "calendar-clock", href: getViewModeUrl('inventory.subscription', "/inventory/products/subscriptions") },
                { value: "categories", label: "Categorías", iconName: getEntityIconName('inventory.productcategory'), href: "/inventory/products/categories" },
                { value: "attributes", label: "Atributos", iconName: getEntityIconName('inventory.attribute'), href: "/inventory/products/attributes" },
            ]
        },
        {
            value: "stock",
            label: "Existencias",
            iconName: getEntityIconName('inventory.stockmove'),
            href: "/inventory/stock",
            subTabs: [
                { value: "report", label: "Reporte", iconName: "file-text", href: "/inventory/stock/report" },
                { value: "documents", label: "Documentos", iconName: "file-text", href: "/inventory/stock/documents" },
                { value: "movements", label: "Movimientos", iconName: getEntityIconName('inventory.stockmove'), href: getViewModeUrl('inventory.stockmove', "/inventory/stock/movements") },
                { value: "warehouses", label: "Almacenes", iconName: getEntityIconName('inventory.warehouse'), href: getViewModeUrl('inventory.warehouse', "/inventory/stock/warehouses") },
            ]
        },
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
        moduleHref: getViewModeUrl('inventory.product', "/inventory/products"),
        tabs,
        activeValue,
        subActiveValue,
        subSubActiveValue,
    }

    const getHeaderConfig = () => {
        if (activeValue === 'products') {
            if (subActiveValue === 'uoms') {
                if (subSubActiveValue === 'uom-categories') return { title: "Categorías de Medida", description: "Clasificación de magnitudes compatibles (peso, volumen, longitud).", iconName: getEntityIconName('inventory.uomcategory') }
                return { title: "Unidades de Medida", description: "Configuración de métricas y factores de conversión estándar.", iconName: getEntityIconName('inventory.uom') }
            }
            if (subActiveValue === 'categories') return { title: "Categorías de Productos", description: "Organización y clasificación jerárquica del catálogo general.", iconName: getEntityIconName('inventory.productcategory') }
            if (subActiveValue === 'attributes') return { title: "Atributos de Variantes", description: "Propiedades variables: tallas, colores, materiales y más.", iconName: getEntityIconName('inventory.attribute') }
            if (subActiveValue === 'subscriptions') return { title: "Suscripciones y Recurrentes", description: "Gestión de servicios mensuales, contratos y facturación automática.", iconName: "calendar-clock" as const }
            if (subActiveValue === 'pricing-rules') return { title: "Reglas de Precios", description: "Políticas de tarifas, descuentos y márgenes por cliente o volumen.", iconName: getEntityIconName('inventory.pricingrule') }
            return { title: "Catálogo de Productos", description: "Gestión de bienes físicos, servicios y consumibles.", iconName: getEntityIconName('inventory.product') }
        }
        if (activeValue === 'stock') {
            if (subActiveValue === 'documents') return { title: "Documentos de Inventario", description: "Historial de recepciones, entregas, transferencias y ajustes físicos.", iconName: "file-text" as const }
            if (subActiveValue === 'movements') return { title: "Movimientos de Stock", description: "Histórico de entradas, salidas y transferencias entre ubicaciones.", iconName: getEntityIconName('inventory.stockmove') }
            if (subActiveValue === 'warehouses') return { title: "Almacenes y Ubicaciones", description: "Estructura física y lógica para el almacenamiento de mercadería.", iconName: getEntityIconName('inventory.warehouse') }
            return { title: "Reporte de Existencias", description: "Estado actual del inventario por almacén, valorizado en tiempo real.", iconName: "file-text" as const }
        }
        if (activeValue === 'config') return { title: "Configuración de Inventario", description: "Parámetros generales del módulo de inventario.", iconName: "settings" as const }
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
