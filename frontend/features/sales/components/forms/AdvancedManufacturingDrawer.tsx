"use client"

import { useState, useEffect, useMemo } from "react"
import { Drawer, FormFooter, CancelButton, SubmitButton, ManufacturingConfigFields, ManufacturingSpecsPanel, emptyManufacturingData } from "@/components/shared"
import type { ManufacturingData, ManufacturingContact, ManufacturingSpecsView } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formDrawerWidth } from "@/lib/form-widths"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import { DraftMaterialsStep, DraftOutsourcingStep } from "@/features/production"
import type { DraftMaterial, DraftOutsourcedService } from "@/features/production"

interface AdvancedManufacturingDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: { id: number; manufacturing_data?: Record<string, unknown>;[key: string]: unknown } | null | undefined
    onConfirm: (data: Record<string, unknown>) => void
    /** Customer of the sale being built; shown apart from the related contact. */
    customer?: { name: string; tax_id?: string | null } | null
}

interface MfgDataShape {
    contact?: ManufacturingContact | null
    phases?: { prepress?: boolean; press?: boolean; postpress?: boolean }
    specifications?: { prepress?: string; press?: string; postpress?: string }
    design_needed?: boolean
    design_files?: File[]
    folio_enabled?: boolean
    folio_start?: string
    print_type?: string | null
    description?: string
    product_description?: string
    materials_draft?: DraftMaterial[]
    outsourced_draft?: DraftOutsourcedService[]
}

type StepId = "config" | "materials" | "outsourcing"

const STEPS: { id: StepId; label: string; optional: boolean }[] = [
    { id: "config", label: "Fabricación", optional: false },
    { id: "materials", label: "Materiales", optional: true },
    { id: "outsourcing", label: "Tercerizados", optional: true },
]

export function AdvancedManufacturingDrawer({ open, onOpenChange, product, onConfirm, customer }: AdvancedManufacturingDrawerProps) {
    const [step, setStep] = useState<StepId>("config")
    const [contact, setContact] = useState<ManufacturingContact | null>(null)
    const [data, setData] = useState<ManufacturingData>(() => emptyManufacturingData())
    const [materials, setMaterials] = useState<DraftMaterial[]>([])
    const [outsourced, setOutsourced] = useState<DraftOutsourcedService[]>([])

    // Sync from product on open
    useEffect(() => {
        if (!open || !product) return
        const prod = product as Record<string, unknown>
        const saved = prod.manufacturing_data as MfgDataShape | undefined

        requestAnimationFrame(() => {
            setStep("config")
            setContact(saved?.contact ?? null)
            setMaterials(saved?.materials_draft ?? [])
            setOutsourced(saved?.outsourced_draft ?? [])
            setData(saved
                ? {
                    phases: {
                        prepress: saved.phases?.prepress ?? !!prod.mfg_enable_prepress,
                        press: saved.phases?.press ?? !!prod.mfg_enable_press,
                        postpress: saved.phases?.postpress ?? !!prod.mfg_enable_postpress,
                    },
                    specifications: {
                        prepress: saved.specifications?.prepress || '',
                        press: saved.specifications?.press || '',
                        postpress: saved.specifications?.postpress || '',
                    },
                    design_needed: saved.design_needed || false,
                    design_files: saved.design_files || [],
                    existing_design_files: [],
                    folio_enabled: saved.folio_enabled || false,
                    folio_start: saved.folio_start || '',
                    print_type: (saved.print_type as ManufacturingData['print_type']) || null,
                    internal_notes: saved.description || '',
                    product_description: saved.product_description || '',
                }
                : emptyManufacturingData({
                    mfg_enable_prepress: prod.mfg_enable_prepress as boolean | undefined,
                    mfg_enable_press: prod.mfg_enable_press as boolean | undefined,
                    mfg_enable_postpress: prod.mfg_enable_postpress as boolean | undefined,
                    mfg_prepress_design: prod.mfg_prepress_design as boolean | undefined,
                    mfg_prepress_folio: prod.mfg_prepress_folio as boolean | undefined,
                    mfg_press_offset: prod.mfg_press_offset as boolean | undefined,
                    mfg_press_digital: prod.mfg_press_digital as boolean | undefined,
                    mfg_press_special: prod.mfg_press_special as boolean | undefined,
                }))
        })
    }, [open, product])

    const p = (product ?? {}) as Record<string, unknown>
    const productName = (p.product_name ?? p.name ?? p.description ?? "Producto") as string
    const qty = (p.qty ?? p.quantity) as number | string | undefined
    const uomName = (p.uom_name as string | undefined) ?? "und"
    const requiresDescription = p.product_type === 'MANUFACTURABLE' && !p.has_bom
    const anyPhaseEnabled = data.phases.prepress || data.phases.press || data.phases.postpress

    const view = useMemo<ManufacturingSpecsView>(() => ({
        product: { name: productName, quantity: qty ?? null, uomName },
        productDescription: data.product_description,
        customer: customer ? { name: customer.name, taxId: customer.tax_id } : null,
        contact: contact ? { name: contact.name, taxId: contact.tax_id } : null,
        phases: data.phases,
        specifications: data.specifications,
        designNeeded: data.design_needed,
        designFiles: [...data.existing_design_files, ...data.design_files.map(f => f.name)],
        folioEnabled: data.folio_enabled,
        folioStart: data.folio_start,
        printType: data.print_type,
    }), [productName, qty, uomName, data, contact, customer])

    if (!product) return null

    const counts: Record<StepId, number | null> = {
        config: null,
        materials: materials.length || null,
        outsourcing: outsourced.length || null,
    }

    const validateConfig = (): boolean => {
        if (requiresDescription && !data.product_description?.trim()) {
            toast.error(`La descripción del producto es obligatoria para productos sin ${getDomainConceptTitle('ldm').toLowerCase()}.`)
            setStep("config")
            return false
        }
        if (!anyPhaseEnabled) {
            toast.error("Debe habilitar al menos una etapa de fabricación")
            setStep("config")
            return false
        }
        return true
    }

    const stepIndex = STEPS.findIndex(s => s.id === step)
    const isLast = stepIndex === STEPS.length - 1

    const goNext = () => {
        if (step === "config" && !validateConfig()) return
        setStep(STEPS[stepIndex + 1].id)
    }

    const handleConfirm = () => {
        if (!validateConfig()) return
        onConfirm({
            design_needed: data.design_needed,
            contact: contact ? { id: contact.id, name: contact.name, tax_id: contact.tax_id } : null,
            description: data.internal_notes,
            product_description: data.product_description,
            design_files: data.design_files,
            folio_enabled: data.folio_enabled,
            folio_start: data.folio_start,
            phases: data.phases,
            specifications: data.specifications,
            print_type: data.print_type,
            materials_draft: materials,
            outsourced_draft: outsourced,
        })
        onOpenChange(false)
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("master", false)}
            contentClassName="p-0"
            fillContent
            title={
                <div className="px-6 pt-5 pb-3 space-y-3">
                    <div>
                        <div className="text-xl font-black tracking-tight text-foreground">Fabricación</div>
                        <p className="text-xs font-medium text-muted-foreground truncate">{productName}</p>
                    </div>
                    <nav aria-label="Pasos de fabricación" className="flex gap-1">
                        {STEPS.map((s, i) => (
                            <Button
                                key={s.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-current={s.id === step ? "step" : undefined}
                                onClick={() => (s.id === "config" || validateConfig()) && setStep(s.id)}
                                className={cn(
                                    "h-8 gap-2 rounded-md px-3 text-3xs font-black uppercase tracking-wider",
                                    s.id === step ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "text-muted-foreground"
                                )}
                            >
                                <span className="font-mono tabular-nums">{i + 1}</span>
                                {s.label}
                                {counts[s.id] !== null && <span className="font-mono tabular-nums opacity-80">({counts[s.id]})</span>}
                                {s.optional && s.id !== step && <span className="text-4xs font-black opacity-70">opcional</span>}
                            </Button>
                        ))}
                    </nav>
                </div>
            }
            footer={
                <FormFooter
                    actions={
                        <>
                            {stepIndex === 0
                                ? <CancelButton onClick={() => onOpenChange(false)} />
                                : <Button type="button" variant="outline" onClick={() => setStep(STEPS[stepIndex - 1].id)}>Atrás</Button>}
                            {!isLast && <Button type="button" variant="outline" onClick={goNext}>Siguiente</Button>}
                            <SubmitButton onClick={handleConfirm}>Validar Producción</SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="flex flex-1 min-h-0 h-full">
                <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-4">
                    {step === "config" && (
                        <ManufacturingConfigFields data={data} onDataChange={setData} contact={contact} onContactChange={setContact} />
                    )}
                    {step === "materials" && (
                        <DraftMaterialsStep items={materials} onChange={setMaterials} />
                    )}
                    {step === "outsourcing" && (
                        <DraftOutsourcingStep items={outsourced} onChange={setOutsourced} />
                    )}
                </div>
                <aside aria-label="Resumen de fabricación" className="hidden xl:block w-64 shrink-0 self-stretch border-l overflow-y-auto p-5">
                    <ManufacturingSpecsPanel view={view} />
                </aside>
            </div>
        </Drawer>
    )
}
