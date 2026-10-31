"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2, Pencil, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BaseModal, CardSkeleton } from "@/components/shared"
import { useApprovalPolicies } from "../hooks/useWorkflowQueries"
import { useSaveApprovalPolicy, useDeleteApprovalPolicy } from "../hooks/useWorkflowMutations"
import type { ApprovalPolicy } from "../api/workflowApi"

// ─── Schema ───────────────────────────────────────────────────────────────────

const policySchema = z.object({
    document_type: z.string().min(1, "Campo requerido"),
    min_amount: z.string().optional().nullable(),
    required_permission: z.string().optional(),
    forbid_self_approval: z.boolean(),
    approvals_required: z.number().int().min(1, "Mínimo 1 aprobación"),
})

type PolicyFormValues = z.infer<typeof policySchema>

// ─── PolicyForm ───────────────────────────────────────────────────────────────

interface PolicyFormProps {
    defaultValues?: Partial<PolicyFormValues>
    onSubmit: (values: PolicyFormValues) => void
}

function PolicyForm({ defaultValues, onSubmit }: PolicyFormProps) {
    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<PolicyFormValues>({
        resolver: zodResolver(policySchema),
        defaultValues: {
            document_type: "",
            min_amount: null,
            required_permission: "",
            forbid_self_approval: false,
            approvals_required: 1,
            ...defaultValues,
        },
    })
    const forbidSelf = watch("forbid_self_approval")

    return (
        <form id="policy-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
                <Label htmlFor="document_type">Tipo de documento <span className="text-destructive">*</span></Label>
                <Input id="document_type" {...register("document_type")} placeholder="ej. OV, OC, FACTURA" />
                {errors.document_type && <p className="text-xs text-destructive">{errors.document_type.message}</p>}
            </div>

            <div className="space-y-1">
                <Label htmlFor="min_amount">Monto mínimo (opcional)</Label>
                <Input id="min_amount" {...register("min_amount")} placeholder="ej. 500000" type="number" step="0.01" />
                <p className="text-3xs text-muted-foreground">Aplica la política solo si el documento supera este monto.</p>
            </div>

            <div className="space-y-1">
                <Label htmlFor="required_permission">Permiso requerido (opcional)</Label>
                <Input id="required_permission" {...register("required_permission")} placeholder="ej. sales.approve_saleorder" />
                <p className="text-3xs text-muted-foreground">Si se especifica, solo usuarios con este permiso pueden aprobar.</p>
            </div>

            <div className="space-y-1">
                <Label htmlFor="approvals_required">Aprobaciones requeridas</Label>
                <Input id="approvals_required" {...register("approvals_required", { valueAsNumber: true })} type="number" min={1} />
                {errors.approvals_required && <p className="text-xs text-destructive">{errors.approvals_required.message}</p>}
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                    <p className="text-sm font-medium">Prohibir auto-aprobación</p>
                    <p className="text-3xs text-muted-foreground">El creador del documento no podrá aprobarlo.</p>
                </div>
                <Switch
                    checked={forbidSelf}
                    onCheckedChange={(v) => setValue("forbid_self_approval", v)}
                />
            </div>

        </form>
    )
}

// ─── ApprovalPoliciesView ─────────────────────────────────────────────────────

export function ApprovalPoliciesView() {
    const { data: policies, isLoading } = useApprovalPolicies()
    const { mutate: save, isPending: isSaving } = useSaveApprovalPolicy()
    const { mutate: remove } = useDeleteApprovalPolicy()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<ApprovalPolicy | null>(null)

    function openNew() {
        setEditing(null)
        setDialogOpen(true)
    }

    function openEdit(policy: ApprovalPolicy) {
        setEditing(policy)
        setDialogOpen(true)
    }

    function handleSubmit(values: PolicyFormValues) {
        save(
            { ...values, id: editing?.id },
            { onSuccess: () => setDialogOpen(false) },
        )
    }

    if (isLoading) {
        return <CardSkeleton count={3} variant="list" />
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Define reglas de aprobación por tipo de documento.
                </p>
                <Button size="sm" variant="outline" onClick={openNew} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Nueva política
                </Button>
            </div>

            {(!policies || policies.length === 0) ? (
                <Card className="border-dashed border-2 bg-muted/5">
                    <CardHeader className="py-6 text-center">
                        <CardTitle className="text-sm text-muted-foreground">Sin políticas configuradas</CardTitle>
                        <CardDescription className="text-xs">
                            Crea una política para controlar quién puede aprobar cada tipo de documento.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <div className="grid gap-2">
                    {policies.map((policy) => (
                        <div
                            key={policy.id}
                            className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5"
                        >
                            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{policy.document_type}</p>
                                <p className="text-3xs text-muted-foreground truncate">
                                    {[
                                        policy.approvals_required > 1 ? `${policy.approvals_required} aprob.` : "1 aprob.",
                                        policy.min_amount ? `≥ $${policy.min_amount}` : null,
                                        policy.required_permission ? `perm: ${policy.required_permission}` : null,
                                        policy.forbid_self_approval ? "no auto-aprob." : null,
                                    ].filter(Boolean).join(" · ")}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(policy)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => remove(policy.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Card className="border-dashed border-2 bg-muted/5">
                <CardHeader className="py-4">
                    <CardTitle className="text-xs flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Cómo funcionan las políticas
                    </CardTitle>
                    <CardDescription className="text-3xs space-y-1">
                        <p>Una política se activa cuando se aprueba un documento del tipo indicado.</p>
                        <p>Si se define un monto mínimo, la política solo aplica si el documento supera ese valor.</p>
                        <p>La prohibición de auto-aprobación es un aviso de separación de funciones (SoD); no bloquea la operación.</p>
                    </CardDescription>
                </CardHeader>
            </Card>

            <BaseModal
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={editing ? "Editar política" : "Nueva política de aprobación"}
                size="md"
                footer={
                    <Button type="submit" form="policy-form" disabled={isSaving}>
                        {isSaving ? "Guardando…" : "Guardar"}
                    </Button>
                }
            >
                <PolicyForm
                    defaultValues={editing ? {
                        document_type: editing.document_type,
                        min_amount: editing.min_amount,
                        required_permission: editing.required_permission,
                        forbid_self_approval: editing.forbid_self_approval,
                        approvals_required: editing.approvals_required,
                    } : undefined}
                    onSubmit={handleSubmit}
                />
            </BaseModal>
        </div>
    )
}
