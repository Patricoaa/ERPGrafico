"use client"

import { useState, useEffect } from "react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    User, Paintbrush, FileText, Plus, X, Upload, FileIcon
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { toast } from "sonner"

interface AdvancedManufacturingDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: any
    onConfirm: (data: any) => void
}

export function AdvancedManufacturingDialog({
    open, onOpenChange, product, onConfirm
}: AdvancedManufacturingDialogProps) {
    const [designNeeded, setDesignNeeded] = useState(false)
    const [contact, setContact] = useState<any>(null)
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

    useEffect(() => {
        if (open && product) {
            const mfgData = product.manufacturing_data

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
                    setEnablePrepress(mfgData.phases.prepress ?? !!product.mfg_enable_prepress)
                    setEnablePress(mfgData.phases.press ?? !!product.mfg_enable_press)
                    setEnablePostpress(mfgData.phases.postpress ?? !!product.mfg_enable_postpress)
                } else {
                    setEnablePrepress(!!product.mfg_enable_prepress)
                    setEnablePress(!!product.mfg_enable_press)
                    setEnablePostpress(!!product.mfg_enable_postpress)
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
            } else {
                setDesignNeeded(!!product.mfg_prepress_design)
                setContact(null)
                setDescription("")
                setProductDescription("")
                setDesignFiles([])
                setFolioEnabled(!!product.mfg_prepress_folio)
                setFolioStart("")
                setPrepressSpecs("")
                setPressSpecs("")
                setPostpressSpecs("")

                // Initialize printType from product flags
                if (product.mfg_press_offset) setPrintType('offset')
                else if (product.mfg_press_digital) setPrintType('digital')
                else if (product.mfg_press_special) setPrintType('especial')
                else setPrintType(null)

                // Initialize switches from product configuration
                setEnablePrepress(!!product.mfg_enable_prepress)
                setEnablePress(!!product.mfg_enable_press)
                setEnablePostpress(!!product.mfg_enable_postpress)
            }
        }
    }, [open, product])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setDesignFiles(Array.from(e.target.files))
        }
    }

    const removeFile = (index: number) => {
        setDesignFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleConfirm = () => {
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

    // Check if product description should be shown: Manufacturable, Advanced, but NO BOM
    const showProductDescription = product.product_type === 'MANUFACTURABLE' &&
        product.requires_advanced_manufacturing &&
        !product.has_bom

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] border-primary/20 shadow-2xl overflow-y-auto max-h-[90vh]">
                <DialogHeader className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Paintbrush className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Detalles de Fabricación</DialogTitle>
                            <p className="text-sm text-muted-foreground">{product.name} ({product.code})</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Contact Row */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Contacto / Referencia</Label>
                        {contact ? (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <User className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-sm truncate font-medium">{contact.name}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setContact(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <AdvancedContactSelector
                                onSelectContact={setContact}
                                onChange={() => { }}
                                placeholder="Buscar contacto..."
                            />
                        )}
                    </div>

                    {product.product_type === 'MANUFACTURABLE' && (
                        <>
                            {showProductDescription && (
                                <>
                                    <div className="space-y-2 pt-2 border-t font-medium text-xs text-primary flex items-center gap-2 uppercase tracking-wider">
                                        <FileText className="h-3 w-3" /> Descripción del Trabajo
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Descripción del Producto</Label>
                                        <Input
                                            placeholder="Ej: Trípticos 10x21cm, Papel Couche 170gr..."
                                            className="h-10"
                                            value={productDescription}
                                            onChange={(e) => setProductDescription(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Pre-Press Column */}
                                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePrepress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                                            <Paintbrush className="h-3 w-3" /> Pre-Impresión
                                        </h4>
                                        <Switch
                                            checked={enablePrepress}
                                            onCheckedChange={setEnablePrepress}
                                            className="scale-75"
                                        />
                                    </div>

                                    {enablePrepress && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium">Especificaciones</Label>
                                                <Textarea
                                                    placeholder="Detalles técnicos de pre-impresión..."
                                                    className="text-xs bg-background min-h-[60px]"
                                                    value={prepressSpecs}
                                                    onChange={(e) => setPrepressSpecs(e.target.value)}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-2 rounded-md bg-background">
                                                <Label className="text-xs font-medium">Diseño Requerido</Label>
                                                <Switch
                                                    checked={designNeeded}
                                                    onCheckedChange={setDesignNeeded}
                                                    className="scale-75"
                                                />
                                            </div>

                                            {designNeeded && (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <Label className="text-[10px] uppercase text-muted-foreground">Adjuntos de Diseño</Label>
                                                    <div className="space-y-2">
                                                        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                                            <Upload className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">Cargar archivos</span>
                                                            <input
                                                                type="file"
                                                                multiple
                                                                className="hidden"
                                                                onChange={handleFileChange}
                                                                accept="image/*,.pdf,.ai,.psd,.eps"
                                                            />
                                                        </label>
                                                        <p className="text-[9px] text-muted-foreground italic">
                                                            Formatos: Imágenes, PDF, AI, PSD, EPS
                                                        </p>
                                                        {designFiles.length > 0 && (
                                                            <div className="space-y-1">
                                                                {designFiles.map((file, index) => (
                                                                    <div key={index} className="flex items-center justify-between p-2 bg-background rounded text-xs">
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <FileIcon className="h-3 w-3 shrink-0" />
                                                                            <span className="truncate">{file.name}</span>
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5"
                                                                            onClick={() => removeFile(index)}
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between p-2 rounded-md bg-background">
                                                <Label className="text-xs font-medium">Folio</Label>
                                                <Switch
                                                    checked={folioEnabled}
                                                    onCheckedChange={setFolioEnabled}
                                                    className="scale-75"
                                                />
                                            </div>

                                            {folioEnabled && (
                                                <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <Label className="text-[10px] uppercase text-muted-foreground">Folio Inicial</Label>
                                                    <Input
                                                        placeholder="N° Folio inicial..."
                                                        className="h-8 text-xs bg-background"
                                                        value={folioStart}
                                                        onChange={(e) => setFolioStart(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Press Column */}
                                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                                            <Plus className="h-3 w-3" /> Impresión
                                        </h4>
                                        <Switch
                                            checked={enablePress}
                                            onCheckedChange={setEnablePress}
                                            className="scale-75"
                                        />
                                    </div>

                                    {enablePress && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium">Especificaciones</Label>
                                                <Textarea
                                                    placeholder="Detalles técnicos de impresión..."
                                                    className="text-xs bg-background min-h-[60px]"
                                                    value={pressSpecs}
                                                    onChange={(e) => setPressSpecs(e.target.value)}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium">Tipo de Impresión</Label>
                                                <div className="grid grid-cols-3 gap-1">
                                                    <Button
                                                        variant={printType === 'offset' ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-8 text-[10px]"
                                                        onClick={() => setPrintType('offset')}>
                                                        Offset
                                                    </Button>
                                                    <Button
                                                        variant={printType === 'digital' ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-8 text-[10px]"
                                                        onClick={() => setPrintType('digital')}>
                                                        Digital
                                                    </Button>
                                                    <Button
                                                        variant={printType === 'especial' ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-8 text-[10px]"
                                                        onClick={() => setPrintType('especial')}>
                                                        Especial
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Post-Press Column */}
                                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePostpress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                                            <FileText className="h-3 w-3" /> Post-Impresión
                                        </h4>
                                        <Switch
                                            checked={enablePostpress}
                                            onCheckedChange={setEnablePostpress}
                                            className="scale-75"
                                        />
                                    </div>

                                    {enablePostpress && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium">Especificaciones</Label>
                                                <Textarea
                                                    placeholder="Acabados, barniz, laminado, encuadernación, troquelado..."
                                                    className="text-xs bg-background min-h-[60px]"
                                                    value={postpressSpecs}
                                                    onChange={(e) => setPostpressSpecs(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="space-y-2 border-t pt-4">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Instrucciones / Observaciones Internas</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                                placeholder="Notas internas para producción..."
                                className="pl-9 min-h-[80px]"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-muted/10 p-4 -m-6 mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button className="px-8 font-bold" onClick={handleConfirm}>Confirmar Detalles</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
