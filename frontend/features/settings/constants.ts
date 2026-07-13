export const ACCOUNT_TABS = [
    { value: "estructura", label: "Estructura" },
    { value: "ventas", label: "Ventas" },
    { value: "facturacion", label: "Facturación" },
    { value: "compras", label: "Compras" },
    { value: "inventario", label: "Inventario" },
    { value: "tesoreria", label: "Tesorería" },
    { value: "rrhh", label: "RRHH" },
    { value: "socios", label: "Socios" },
    { value: "impuestos", label: "Impuestos" },
] as const

export const VALID_ACCOUNT_TABS: readonly string[] = ACCOUNT_TABS.map(t => t.value)
export const DEFAULT_ACCOUNT_TAB = "ventas"
