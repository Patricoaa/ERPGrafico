"use client"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/contexts/AuthContext"
import { useBundles, useComposition, useSaveComposition } from "../hooks/useRbac"
import type { AppGroup } from "@/types/entities"
import type { RbacBundle } from "../api/rbacApi"
import { compositionSchema, type CompositionFormValues } from "./RoleCompositionEditor.schema"

interface RoleCompositionEditorProps {
    group: AppGroup
    onSuccess?: () => void
    readOnly?: boolean
}

const SOD_RULES = [
    { key: "purchasing_treasury", bundles: ["purchasing.operate", "treasury.payments"], label: "Compras + Pagos de Tesorería" },
    { key: "payroll_treasury", bundles: ["hr.payroll", "treasury.payments"], label: "Nómina + Pagos de Tesorería" },
    { key: "billing_cashier", bundles: ["billing.manage", "treasury.cashier"], label: "Facturación + Caja" },
]

function actorCanGrantBundle(bundle: RbacBundle, can: (p: string) => boolean): boolean {
    return bundle.permissions.every(p => can(p))
}

function implyRead(bundles: string[], changed: string, checked: boolean): string[] {
    const parts = changed.split(".")
    if (parts.length < 2) return bundles
    const [app, level] = parts
    if (!checked) return bundles

    const implied: string[] = []
    if (level === "operate" || level === "manage") implied.push(`${app}.read`)
    if (level === "manage") implied.push(`${app}.operate`)

    const result = [...bundles]
    for (const b of implied) {
        if (!result.includes(b)) result.push(b)
    }
    return result
}

function implyDown(bundles: string[], changed: string, checked: boolean): string[] {
    const parts = changed.split(".")
    if (parts.length < 2) return bundles
    const [app, level] = parts
    if (checked) return bundles

    let result = [...bundles]
    if (level === "read") result = result.filter(b => b !== `${app}.operate` && b !== `${app}.manage`)
    if (level === "operate") result = result.filter(b => b !== `${app}.manage`)
    return result
}

export function RoleCompositionEditor({ group, onSuccess, readOnly }: RoleCompositionEditorProps) {
    const { can } = useAuth()
    const { data: allBundles = [], isLoading: bundlesLoading } = useBundles()
    const { data: composition, isLoading: compLoading } = useComposition(group.id)
    const saveComposition = useSaveComposition()

    const isDisabled = readOnly || group.is_system

    const form = useForm<CompositionFormValues>({
        resolver: zodResolver(compositionSchema),
        defaultValues: { bundles: [], extra_permissions: [], excluded_permissions: [] },
    })

    useEffect(() => {
        if (composition) {
            form.reset({
                bundles: composition.bundles,
                extra_permissions: composition.extra_permissions,
                excluded_permissions: composition.excluded_permissions,
            })
        }
    }, [composition, form])

    const watchedBundles = form.watch("bundles")

    const normalBundles = allBundles.filter(b => !b.sensitive)
    const sensitiveBundles = allBundles.filter(b => b.sensitive)

    const activeSodWarnings = SOD_RULES.filter(rule =>
        rule.bundles.every(b => watchedBundles.includes(b))
    )

    const handleBundleChange = (key: string, checked: boolean) => {
        let next = checked
            ? [...watchedBundles, key]
            : watchedBundles.filter(b => b !== key)

        next = checked ? implyRead(next, key, checked) : implyDown(next, key, checked)
        form.setValue("bundles", next)
    }

    const onSubmit = (values: CompositionFormValues) => {
        saveComposition.mutate({ groupId: group.id, data: values }, { onSuccess })
    }

    if (bundlesLoading || compLoading) {
        return <div className="p-4 text-muted-foreground">Cargando...</div>
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {group.is_system && (
                <div data-testid="system-role-banner" className="rounded-md bg-muted p-3 text-sm text-muted-foreground border border-border">
                    Este rol del sistema no es editable.
                </div>
            )}

            {activeSodWarnings.length > 0 && (
                <div className="rounded-md bg-warning/10 border border-warning p-3 text-sm text-warning-foreground space-y-1">
                    <p className="font-medium">Conflictos de separación de funciones:</p>
                    {activeSodWarnings.map(w => (
                        <p key={w.key}>• {w.label}</p>
                    ))}
                </div>
            )}

            <div>
                <h3 className="text-sm font-medium mb-3">Permisos por módulo</h3>
                <div className="space-y-2">
                    {normalBundles.map(bundle => {
                        const isChecked = watchedBundles.includes(bundle.key)
                        const canGrant = can("auth.change_group") && actorCanGrantBundle(bundle, can)
                        const disabled = isDisabled || !canGrant
                        return (
                            <label key={bundle.key} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    data-testid={`bundle-checkbox-${bundle.key}`}
                                    checked={isChecked}
                                    disabled={disabled}
                                    onChange={e => handleBundleChange(bundle.key, e.target.checked)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">{bundle.label}</span>
                                {bundle.description && (
                                    <span className="text-xs text-muted-foreground">{bundle.description}</span>
                                )}
                            </label>
                        )
                    })}
                </div>
            </div>

            {sensitiveBundles.length > 0 && (
                <div data-testid="sensitive-section">
                    <h3 className="text-sm font-medium mb-3">Capacidades sensibles</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {sensitiveBundles.map(bundle => {
                            const isChecked = watchedBundles.includes(bundle.key)
                            const canGrant = can("auth.change_group") && actorCanGrantBundle(bundle, can)
                            const disabled = isDisabled || !canGrant
                            return (
                                <label key={bundle.key} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        data-testid={`bundle-checkbox-${bundle.key}`}
                                        checked={isChecked}
                                        disabled={disabled}
                                        onChange={e => handleBundleChange(bundle.key, e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <span className="text-sm">{bundle.label}</span>
                                </label>
                            )
                        })}
                    </div>
                </div>
            )}

            {!isDisabled && (
                <button
                    type="submit"
                    disabled={saveComposition.isPending}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                    {saveComposition.isPending ? "Guardando..." : "Guardar"}
                </button>
            )}
        </form>
    )
}
