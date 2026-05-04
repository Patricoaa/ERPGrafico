"use client"

import { useState, useMemo, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    User, Paintbrush, FileText, X, Upload, FileIcon, Printer
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { LabeledContainer, LabeledInput, FormSection } from "@/components/shared"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface AdvancedManufacturingModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: { id: number; manufacturing_data?: Record<string, unknown>;[key: string]: unknown } | null | undefined
    onConfirm: (data: Record<string, unknown>) => void
}

export function AdvancedManufacturingModal({
    open, onOpenChange, product, onConfirm
}: AdvancedManufacturingModalProps) {
    const [designNeeded, setDesignNeeded] = useState(false)
    const [contact, setContact] = useState<{ id: number; name: string; tax_id: string | null; rut?: string | null } | null>(null)
    const [description, setDescription] = useState("")
    const [productDescription, setProductDescription] = useState("")
    const [designFiles, setDesignFiles] = useState<File[]>([])
    const [folioEnabled, setFolioEnabled] = useState(false)
    const [folioStart, setFolioStart] = useState("")

    // Phase Switches
    const [enablePrepress, setEnablePrepress] = useState(false)
    const [enablePress, setEnablePress] = useState(false)
    const [enablePostpress, setEnablePostpress] = useState(false)

    // Specifications for each stage
    const [prepressSpecs, setPrepressSpecs] = useState("")
    const [pressSpecs, setPressSpecs] = useState("")
    const [postpressSpecs, setPostpressSpecs] = useState("")

    // Print type
    const [printType, setPrintType] = useState<string | null>(null)

    const [prevOpen, setPrevOpen] = useState(false)
    const [prevProductId, setPrevProductId] = useState<number | null>(null)

    useEffect(() => {
        if (open && (open !== prevOpen || product?.id !== prevProductId)) {
            setPrevOpen(open)
            setPrevProductId(product?.id ?? null)

            const prod = product as any;
            const mfgData = prod?.manufacturing_data as any;

            if (mfgData) {
                setDesignNeeded(mfgData.design_needed || false)
                setContact(mfgData.contact || null)
                setDescription(mfgData.description || "")
                setProductDescription(mfgData.product_description || "")
                setDesignFiles(mfgData.design_files || [])
                setFolioEnabled(mfgData.folio_enabled || false)
                setFolioStart(mfgData.folio_start || "")
                setPrintType(mfgData.print_type || null)

                if (mfgData.phases) {
                    setEnablePrepress(mfgData.phases.prepress ?? !!prod.mfg_enable_prepress)
                    setEnablePress(mfgData.phases.press ?? !!prod.mfg_enable_press)
                    setEnablePostpress(mfgData.phases.postpress ?? !!prod.mfg_enable_postpress)
                } else {
                    setEnablePrepress(!!prod.mfg_enable_prepress)
                    setEnablePress(!!prod.mfg_enable_press)
                    setEnablePostpress(!!prod.mfg_enable_postpress)
                }

                if (mfgData.specifications) {
                    setPrepressSpecs(mfgData.specifications.prepress || "")
                    setPressSpecs(mfgData.specifications.press || "")
                    setPostpressSpecs(mfgData.specifications.postpress || "")
                } else {
                    setPrepressSpecs("")
                    setPressSpecs("")
                    setPostpressSpecs("")
                }
            } else if (prod) {
                setDesignNeeded(!!prod.mfg_prepress_design)
                setContact(null)
                setDescription("")
                setProductDescription("")
                setDesignFiles([])
                setFolioEnabled(!!prod.mfg_prepress_folio)
                setFolioStart("")
                setPrepressSpecs("")
                setPressSpecs("")
                setPostpressSpecs("")

                // Initialize printType from product flags
                if (prod.mfg_press_offset) setPrintType('offset')
                else if (prod.mfg_press_digital) setPrintType('digital')
                else if (prod.mfg_press_special) setPrintType('especial')
                else setPrintType(null)

                // Initialize switches from product configuration
                setEnablePrepress(!!prod.mfg_enable_prepress)
                setEnablePress(!!prod.mfg_enable_press)
                setEnablePostpress(!!prod.mfg_enable_postpress)
            }
        }
    }, [open, prevOpen, product, prevProductId])

    useEffect(() => {
        if (!open && prevOpen) {
            setPrevOpen(false)
        }
    }, [open, prevOpen])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setDesignFiles(prev => [...prev, ...Array.from(e.target.files!)])
        }
    }

    const removeFile = (index: number) => {
        setDesignFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleConfirm = () => {
        // Validation: Product description is required if shown
        if (showProductDescription && !productDescription?.trim()) {
            toast.error("La descripción del producto es obligatoria para productos sin lista de materiales.")
            return
        }

        // Validation: at least one stage must be enabled
        if (!enablePrepress && !enablePress && !enablePostpress) {
            toast.error("Debe habilitar al menos una etapa de fabricación")
            return
        }

        onConfirm({
            design_needed: designNeeded,
            contact: contact ? { id: contact.id, name: contact.name, tax_id: contact.tax_id || contact.rut } : null,
            description, // Internal notes
            product_description: productDescription,
            design_files: designFiles,
            folio_enabled: folioEnabled,
            folio_start: folioStart,
            // Include phase capability flags in the result
            phases: {
                prepress: enablePrepress,
                press: enablePress,
                postpress: enablePostpress
            },
            specifications: {
                prepress: prepressSpecs,
                press: pressSpecs,
                postpress: postpressSpecs
            },
            print_type: printType
        })
        onOpenChange(false)
    }

    if (!product) return null

    // Check if product description should be shown: Manufacturable but NO BOM
    const showProductDescription = product.product_type === 'MANUFACTURABLE' && !product.has_bom

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            className="max-w-[1000px] border-primary/30 shadow-[0_30px_60px_rgba(0,0,0,0.5)] p-0 border-t-4 border-t-primary"
            hideScrollArea
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
                        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">{(product as any).name} {"// REF:"} {(product as any).code}</p>
                    </div>
                </div>
            }
            footer={
                <div className="bg-muted p-6 border-t border-border flex flex-row items-center justify-between gap-4 w-full">
                    <div className="hidden md:block text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                        ESTADO DE FICHA: {(enablePrepress || enablePress || enablePostpress) ? 'ACTIVA' : 'INCOMPLETA'}
                    </div>
                    <div className="flex items-center gap-4 ml-auto">
                        <Button variant="ghost" className="font-bold text-xs uppercase tracking-widest hover:bg-background" onClick={() => onOpenChange(false)}>Anular</Button>
                        <Button
                            className="px-10 h-12 font-black text-xs uppercase tracking-[0.3em] shadow-[8px_8px_0_rgba(var(--primary),0.2)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0_rgba(var(--primary),0.3)] transition-all"
                            onClick={handleConfirm}
                        >
                            Validar Producción
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex-1 overflow-y-auto">

                <div className="grid gap-8 p-8 py-6">
                    {/* Contact Row */}
                    <LabeledContainer label="01. Contacto / Referencia" labelClassName="text-primary">
                        {contact ? (
                            <motion.div
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="flex items-center justify-between p-2 bg-primary/5 border-l-4 border-primary"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <User className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-sm font-bold tracking-tight">{contact.name}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    onClick={() => setContact(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        ) : (
                            <AdvancedContactSelector
                                onSelectContact={setContact}
                                onChange={() => { }}
                                placeholder="IDENTIFICAR CLIENTE O RESPONSABLE..."
                                className="border-none shadow-none focus-visible:ring-0 h-9"
                            />
                        )}
                    </LabeledContainer>

                    {(product as any).product_type === 'MANUFACTURABLE' && (
                        <>
                            {showProductDescription && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <LabeledContainer label="02. Descripción del Trabajo" labelClassName="text-primary">
                                        <div className="relative">
                                            <Input
                                                placeholder="DETALLES ESPECÍFICOS DEL PRODUCTO..."
                                                className="h-9 text-sm font-bold border-none shadow-none focus-visible:ring-0 bg-transparent"
                                                value={productDescription}
                                                onChange={(e) => setProductDescription(e.target.value)}
                                            />
                                        </div>
                                    </LabeledContainer>
                                </motion.div>
                            )}

                            <FormSection title="Etapas de Fabricación" icon={Paintbrush} />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Pre-Press Column */}
                                <div className={cn("flex flex-col p-5 border-2 transition-all duration-500 rounded-lg", enablePrepress ? "border-primary bg-primary/[0.02]" : "border-border/40 opacity-50")}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", enablePrepress ? "bg-primary animate-pulse" : "bg-muted")} />
                                            <span className="text-[11px] font-black uppercase tracking-widest">Pre-Impresión</span>
                                        </div>
                                        <Switch
                                            checked={enablePrepress}
                                            onCheckedChange={setEnablePrepress}
                                        />
                                    </div>

                                    <div className="space-y-5">
                                        <LabeledContainer label="Especificaciones" labelClassName="text-[10px] opacity-60">
                                            <Textarea
                                                placeholder="INGRESAR DATOS TÉCNICOS..."
                                                className="text-xs font-mono bg-background min-h-[100px] border-none shadow-none focus-visible:ring-0"
                                                value={prepressSpecs}
                                                onChange={(e) => setPrepressSpecs(e.target.value)}
                                            />
                                        </LabeledContainer>

                                        <div className="flex items-center justify-between py-3 border-y border-border/40">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider">Diseño Requerido</Label>
                                            <Switch
                                                checked={designNeeded}
                                                onCheckedChange={setDesignNeeded}
                                                className="scale-90"
                                            />
                                        </div>

                                        <AnimatePresence>
                                            {designNeeded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="space-y-3 overflow-hidden"
                                                >
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-accent">Adjuntos de Diseño</Label>
                                                    <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group">
                                                        <Upload className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors" />
                                                        <span className="text-[10px] font-black uppercase tracking-tighter">Subir Planos / Arte</span>
                                                        <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                                    </label>

                                                    {designFiles.length > 0 && (
                                                        <div className="space-y-2">
                                                            {designFiles.map((file, index) => (
                                                                <div key={index} className="flex items-center justify-between p-2 bg-muted/40 text-[10px] font-mono">
                                                                    <span className="truncate max-w-[150px]">{file.name}</span>
                                                                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFile(index)} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Press Column */}
                                <div className={cn("flex flex-col p-5 border-2 transition-all duration-500 rounded-none", enablePress ? "border-primary bg-primary/[0.02]" : "border-border/40 opacity-50")}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", enablePress ? "bg-primary animate-pulse" : "bg-muted")} />
                                            <span className="text-[11px] font-black uppercase tracking-widest">Impresión</span>
                                        </div>
                                        <Switch
                                            checked={enablePress}
                                            onCheckedChange={setEnablePress}
                                        />
                                    </div>

                                    <div className="space-y-5">
                                        <LabeledContainer label="Ficha de Prensa" labelClassName="text-[10px] opacity-60">
                                            <Textarea
                                                placeholder="DETALLES DE MÁQUINA, TINTAS..."
                                                className="text-xs font-mono bg-background min-h-[100px] border-none shadow-none focus-visible:ring-0"
                                                value={pressSpecs}
                                                onChange={(e) => setPressSpecs(e.target.value)}
                                            />
                                        </LabeledContainer>

                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider">Sistema de Impresión</Label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {['offset', 'digital', 'especial'].map((t) => (
                                                    <Button
                                                        key={t}
                                                        variant={printType === t ? "default" : "outline"}
                                                        size="sm"
                                                        className={cn(
                                                            "h-9 text-[10px] font-black uppercase tracking-[0.2em] border-2",
                                                            printType === t ? "border-primary shadow-[4px_4px_0_rgba(var(--primary),0.2)]" : "border-border"
                                                        )}
                                                        onClick={() => setPrintType(t)}>
                                                        {t}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Post-Press Column */}
                                <div className={cn("flex flex-col p-5 border-2 transition-all duration-500 rounded-none", enablePostpress ? "border-primary bg-primary/[0.02]" : "border-border/40 opacity-50")}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", enablePostpress ? "bg-primary animate-pulse" : "bg-muted")} />
                                            <span className="text-[11px] font-black uppercase tracking-widest">Post-Impresión</span>
                                        </div>
                                        <Switch
                                            checked={enablePostpress}
                                            onCheckedChange={setEnablePostpress}
                                        />
                                    </div>

                                    <LabeledContainer label="Acabados & Logística" labelClassName="text-[10px] opacity-60">
                                        <Textarea
                                            placeholder="LAMINADO, TROQUEL, CORTE..."
                                            className="text-xs font-mono bg-background min-h-[100px] border-none shadow-none focus-visible:ring-0"
                                            value={postpressSpecs}
                                            onChange={(e) => setPostpressSpecs(e.target.value)}
                                        />
                                    </LabeledContainer>
                                </div>
                            </div>
                        </>
                    )}

                    <FormSection title="Instrucciones de Taller" icon={FileText} />

                    <div className="p-0">
                        <Textarea
                            placeholder="INSTRUCCIONES CRÍTICAS PARA EL EQUIPO DE PRODUCCIÓN..."
                            className="min-h-[100px] text-sm font-medium border-none shadow-none focus-visible:ring-0 bg-transparent"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </BaseModal >
    )
}
