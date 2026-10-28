"use client"

import { useState, useEffect, useMemo } from "react"
import { Drawer, FormFooter, CancelButton, SubmitButton, ManufacturingConfigFields, ManufacturingSpecsPanel, StepHeader, emptyManufacturingData } from "@/components/shared"
import type { ManufacturingData, ManufacturingContact, ManufacturingSpecsView, WizardSidebarStep } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Package, Settings, Truck, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { formDrawerWidth } from "@/lib/form-widths"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import { DraftMaterialsStep, DraftOutsourcingStep, ProductionStepsSidebar } from "@/features/production"
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

// Same icons and names as the work order's stages they pre-plan.
const STEPS: { id: StepId; label: string; description: string; icon: LucideIcon; optional: boolean }[] = [
    { id: "config", label: "Configuración de la OT", description: "Defina las fases, especificaciones y archivos de diseño del trabajo.", icon: Settings, optional: false },
    { id: "materials", label: "Asignación de Materiales", description: "Planifique los materiales de stock que consumirá la producción.", icon: Package, optional: true },
    { id: "outsourcing", label: "Asignación de Tercerizados", description: "Asigne los servicios externos y sus proveedores.", icon: Truck, optional: true },
]

export function AdvancedManufacturingDrawer({ open, onOpenChange, product, onConfirm, customer }: AdvancedManufacturingDrawerProps) {
    const [step, setStep] = useState<StepId>("config")
    // Folded like the work order's rail; the step header names the current step.
    const [railCollapsed, setRailCollapsed] = useState(true)
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

    const railSteps: WizardSidebarStep[] = STEPS.map((s, i) => ({
        id: s.id,
        label: s.label,
        icon: s.icon,
        status: i === stepIndex ? "active" : i < stepIndex ? "past" : "future",
        detail: counts[s.id] !== null ? `${counts[s.id]} agregado${counts[s.id] === 1 ? "" : "s"}` : s.optional ? "Opcional" : undefined,
        // Optional steps can be visited in any order once the configuration is valid.
        disabled: false,
    }))

    const goToStep = (index: number) => {
        const target = STEPS[index]
        if (target && (target.id === "config" || validateConfig())) setStep(target.id)
    }

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
            title="Fabricación"
            subtitle={productName}
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
                <ProductionStepsSidebar
                    steps={railSteps}
                    currentStep={stepIndex + 1}
                    onStepClick={goToStep}
                    collapsed={railCollapsed}
                    onToggleCollapsed={() => setRailCollapsed((v) => !v)}
                />
                <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-4">
                    <StepHeader title={STEPS[stepIndex].label} description={STEPS[stepIndex].description} />
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
                <aside aria-label="Resumen de fabricación" className="hidden xl:block w-72 shrink-0 self-stretch border-l overflow-y-auto p-5">
                    <ManufacturingSpecsPanel view={view} className="min-h-full" />
                </aside>
            </div>
        </Drawer>
    )
}
