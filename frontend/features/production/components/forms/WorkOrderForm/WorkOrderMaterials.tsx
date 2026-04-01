import React from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FileIcon, Paintbrush, Printer, FileText, Upload, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkOrderMaterialsProps {
    // Phases Enablers
    enablePrepress: boolean
    setEnablePrepress: (v: boolean) => void
    enablePress: boolean
    setEnablePress: (v: boolean) => void
    enablePostpress: boolean
    setEnablePostpress: (v: boolean) => void

    // Specifications
    prepressSpecs: string
    setPrepressSpecs: (v: string) => void
    pressSpecs: string
    setPressSpecs: (v: string) => void
    postpressSpecs: string
    setPostpressSpecs: (v: string) => void

    // Design & Files
    designNeeded: boolean
    setDesignNeeded: (v: boolean) => void
    designFiles: File[]
    setDesignFiles: React.Dispatch<React.SetStateAction<File[]>>
    existingDesignFiles: string[]
    setExistingDesignFiles: React.Dispatch<React.SetStateAction<string[]>>

    // Folio & Print Type
    folioEnabled: boolean
    setFolioEnabled: (v: boolean) => void
    folioStart: string
    setFolioStart: (v: string) => void
    printType: string | null
    setPrintType: (v: string | null) => void
}

export function WorkOrderMaterials({
    enablePrepress, setEnablePrepress,
    enablePress, setEnablePress,
    enablePostpress, setEnablePostpress,
    prepressSpecs, setPrepressSpecs,
    pressSpecs, setPressSpecs,
    postpressSpecs, setPostpressSpecs,
    designNeeded, setDesignNeeded,
    designFiles, setDesignFiles,
    existingDesignFiles, setExistingDesignFiles,
    folioEnabled, setFolioEnabled,
    folioStart, setFolioStart,
    printType, setPrintType
}: WorkOrderMaterialsProps) {

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setDesignFiles(prev => [...prev, ...Array.from(e.target.files!)])
        }
    }

    const removeNewFile = (index: number) => {
        setDesignFiles(prev => prev.filter((_, i) => i !== index))
    }

    const removeExistingFile = (index: number) => {
        setExistingDesignFiles(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-4">
            <Label className="uppercase text-xs font-bold text-muted-foreground">Detalles de Producción</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Pre-Impresión */}
                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePrepress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Paintbrush className="h-4 w-4 text-muted-foreground" /> Pre-Impresión
                        </h4>
                        <Switch checked={enablePrepress} onCheckedChange={setEnablePrepress} className="scale-75" />
                    </div>
                    {enablePrepress && (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Especificaciones</Label>
                                <Textarea value={prepressSpecs} onChange={e => setPrepressSpecs(e.target.value)} className="min-h-[60px] text-xs" />
                            </div>
                            <div className="flex items-center justify-between p-2 rounded bg-background border">
                                <Label className="text-xs">Diseño Requerido</Label>
                                <Switch checked={designNeeded} onCheckedChange={setDesignNeeded} className="scale-75" />
                            </div>
                            {(designNeeded || existingDesignFiles.length > 0) && (
                                <div className="space-y-3 pt-2 border-t">
                                    <div className="space-y-2">
                                        {existingDesignFiles.length > 0 && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Archivos del Checkout</Label>
                                                {existingDesignFiles.map((file, idx) => (
                                                    <div key={`existing-${idx}`} className="flex items-center justify-between p-1.5 bg-primary/5 rounded text-xs border border-primary/10">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <FileIcon className="h-3 w-3 shrink-0 text-primary" />
                                                            <span className="truncate font-medium">{file}</span>
                                                        </div>
                                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => removeExistingFile(idx)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {designFiles.length > 0 && <Label className="text-[10px] uppercase text-muted-foreground font-bold">Nuevos Archivos</Label>}
                                            {designFiles.map((file, idx) => (
                                                <div key={`new-${idx}`} className="flex items-center justify-between p-1.5 bg-background rounded text-xs border">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Upload className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{file.name}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeNewFile(idx)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <label className="flex items-center gap-2 text-xs text-primary cursor-pointer hover:underline p-1 w-fit">
                                            <Plus className="h-3 w-3" /> Agregar archivo
                                            <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between p-2 rounded bg-background border">
                                <Label className="text-xs">Folio</Label>
                                <Switch checked={folioEnabled} onCheckedChange={setFolioEnabled} className="scale-75" />
                            </div>
                            {folioEnabled && (
                                <Input placeholder="N° Inicial" value={folioStart} onChange={e => setFolioStart(e.target.value)} className="h-8 text-xs" />
                            )}
                        </div>
                    )}
                </div>

                {/* Impresión */}
                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Printer className="h-4 w-4 text-muted-foreground" /> Impresión
                        </h4>
                        <Switch checked={enablePress} onCheckedChange={setEnablePress} className="scale-75" />
                    </div>
                    {enablePress && (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Especificaciones</Label>
                                <Textarea value={pressSpecs} onChange={e => setPressSpecs(e.target.value)} className="min-h-[60px] text-xs" />
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                {['offset', 'digital', 'especial'].map(type => (
                                    <Button
                                        key={type}
                                        type="button"
                                        variant={printType === type ? "default" : "outline"}
                                        size="sm"
                                        className="h-7 text-[10px] capitalize"
                                        onClick={() => setPrintType(type)}
                                    >
                                        {type}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Post-Impresión */}
                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePostpress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" /> Post-Impresión
                        </h4>
                        <Switch checked={enablePostpress} onCheckedChange={setEnablePostpress} className="scale-75" />
                    </div>
                    {enablePostpress && (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Especificaciones</Label>
                                <Textarea value={postpressSpecs} onChange={e => setPostpressSpecs(e.target.value)} placeholder="Acabados, laminado, troquel, etc." className="min-h-[60px] text-xs" />
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
