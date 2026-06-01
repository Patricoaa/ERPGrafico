"use client"

import { useState, useEffect } from "react"
import { Drawer, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { User, Paintbrush, X } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { ManufacturingSpecsEditor,
    emptyManufacturingData,
    type ManufacturingData, } from '@/components/shared'

interface AdvancedManufacturingDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: { id: number; manufacturing_data?: Record<string, unknown>;[key: string]: unknown } | null | undefined
    onConfirm: (data: Record<string, unknown>) => void
}

type ContactData = { id: number; name: string; tax_id: string | null; rut?: string | null } | null

export function AdvancedManufacturingDrawer({
    open, onOpenChange, product, onConfirm
}: AdvancedManufacturingDrawerProps) {
    const [contact, setContact] = useState<ContactData>(null)
    const [data, setData] = useState<ManufacturingData>(() => emptyManufacturingData())

    // Sync from product on open
    useEffect(() => {
        if (!open || !product) return

        const prod = product as any
        const mfgData = prod?.manufacturing_data as any

        if (mfgData) {
            setContact(mfgData.contact || null)
            setData({
                phases: {
                    prepress: mfgData.phases?.prepress ?? !!prod.mfg_enable_prepress,
                    press: mfgData.phases?.press ?? !!prod.mfg_enable_press,
                    postpress: mfgData.phases?.postpress ?? !!prod.mfg_enable_postpress,
                },
                specifications: {
                    prepress: mfgData.specifications?.prepress || '',
                    press: mfgData.specifications?.press || '',
                    postpress: mfgData.specifications?.postpress || '',
                },
                design_needed: mfgData.design_needed || false,
                design_files: mfgData.design_files || [],
                existing_design_files: [],
                folio_enabled: mfgData.folio_enabled || false,
                folio_start: mfgData.folio_start || '',
                print_type: mfgData.print_type || null,
                internal_notes: mfgData.description || '',
                product_description: mfgData.product_description || '',
            })
        } else {
            setContact(null)
            setData(emptyManufacturingData({
                mfg_enable_prepress: prod?.mfg_enable_prepress,
                mfg_enable_press: prod?.mfg_enable_press,
                mfg_enable_postpress: prod?.mfg_enable_postpress,
                mfg_prepress_design: prod?.mfg_prepress_design,
                mfg_prepress_folio: prod?.mfg_prepress_folio,
                mfg_press_offset: prod?.mfg_press_offset,
                mfg_press_digital: prod?.mfg_press_digital,
                mfg_press_special: prod?.mfg_press_special,
            }))
        }
    }, [open, product])

    if (!product) return null

    const showProductDescription = (product as any).product_type === 'MANUFACTURABLE' && !(product as any).has_bom
    const anyPhaseEnabled = data.phases.prepress || data.phases.press || data.phases.postpress

    const handleConfirm = () => {
        if (showProductDescription && !data.product_description?.trim()) {
            toast.error("La descripción del producto es obligatoria para productos sin lista de materiales.")
            return
        }
        if (!anyPhaseEnabled) {
            toast.error("Debe habilitar al menos una etapa de fabricación")
            return
        }
        onConfirm({
            design_needed: data.design_needed,
            contact: contact ? { id: contact.id, name: contact.name, tax_id: contact.tax_id || contact.rut } : null,
            description: data.internal_notes,
            product_description: data.product_description,
            design_files: data.design_files,
            folio_enabled: data.folio_enabled,
            folio_start: data.folio_start,
            phases: data.phases,
            specifications: data.specifications,
            print_type: data.print_type,
        })
        onOpenChange(false)
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize="75%"
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-6 p-4">
                    <motion.div
                        initial={{ rotate: -15, scale: 0.8 }}
                        animate={{ rotate: 0, scale: 1 }}
                        className="p-4 rounded-md bg-primary text-primary-foreground shadow-xl"
                    >
                        <Paintbrush className="h-8 w-8" />
                    </motion.div>
                    <div className="space-y-1">
                        <div className="text-3xl font-black tracking-tighter uppercase font-heading text-foreground">Fabricación</div>
                        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                            {(product as any).name} {"// REF:"} {(product as any).code}
                        </p>
                    </div>
                </div>
            }
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton onClick={handleConfirm}>
                                Validar Producción
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <div className="flex-1 overflow-y-auto">
                <div className="grid gap-8 p-8 py-6">
                    {/* Contact */}
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">01. Contacto / Referencia</span>
                        {contact ? (
                            <div className="flex items-center justify-between p-2 bg-primary/5 border-l-4 border-primary">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <User className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-sm font-bold tracking-tight">{contact.name}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setContact(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <AdvancedContactSelector
                                onSelectContact={setContact as any}
                                onChange={() => { }}
                                placeholder="IDENTIFICAR CLIENTE O RESPONSABLE..."
                                className="border-none shadow-none focus-visible:ring-0 h-9"
                            />
                        )}
                    </div>

                    {/* Manufacturing specs */}
                    <ManufacturingSpecsEditor
                        value={data}
                        onChange={setData}
                        showProductDescription={showProductDescription}
                        showInternalNotes
                        variant="modal"
                    />
                </div>
            </div>
        </Drawer>
    )
}
