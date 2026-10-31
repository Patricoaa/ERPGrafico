import api from "@/lib/api"

export interface CatalogPermission {
    code: string
    name: string
    model: string | null
    kind: "module" | "view" | "add" | "change" | "delete" | "business"
    bundles: string[]
}

export interface CatalogApp {
    app: string
    label: string
    permissions: CatalogPermission[]
}

export interface RbacBundle {
    key: string
    label: string
    description: string
    sensitive: boolean
    permissions: string[]
}

export interface Composition {
    bundles: string[]
    extra_permissions: string[]
    excluded_permissions: string[]
    effective_permissions: string[]
}

export interface CompositionSaveResult {
    status: string
    sod_warnings: Array<{ rule: string; label: string; user: string }>
}

export const rbacApi = {
    getBundles: (): Promise<RbacBundle[]> =>
        api.get("/core/permissions/bundles/").then((r) => r.data),
    getCatalog: (): Promise<CatalogApp[]> =>
        api.get("/core/permissions/catalog/").then((r) => r.data),
    getComposition: (groupId: number): Promise<Composition> =>
        api.get(`/core/groups/${groupId}/composition/`).then((r) => r.data),
    setComposition: (
        groupId: number,
        data: Omit<Composition, "effective_permissions">
    ): Promise<CompositionSaveResult> =>
        api.put(`/core/groups/${groupId}/composition/`, data).then((r) => r.data),
}
