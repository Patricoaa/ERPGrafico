import React from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FileIcon, Paintbrush, Printer, FileText, Upload, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { FormSection, LabeledContainer, LabeledInput } from "@/components/shared"

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
        <div className="space-y-6">
            <FormSection title="Especificaciones Técnicas" icon={Paintbrush} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Pre-Impresión */}
                <div className={cn(
                    "relative group p-6 rounded-md border transition-all duration-300",
                    enablePrepress 
                        ? "bg-white shadow-sm border-primary/30 ring-1 ring-primary/5" 
                        : "bg-muted/30 border-border/40 opacity-60 grayscale-[0.5]"
                )}>
                    <FormSection title="Pre-Impresión" icon={Paintbrush} className="pt-0 pb-4" />
                    
                    <div className="flex items-center justify-between mb-4 mt-1">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Habilitar Fase</span>
                        <Switch checked={enablePrepress} onCheckedChange={setEnablePrepress} className="scale-75 data-[state=checked]:bg-primary" />
                    </div>

                    {enablePrepress && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="relative group/field">
                                <label className="absolute -top-2 left-2 px-1 bg-background text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-focus-within/field:text-primary z-10">
                                    Especificaciones
                                </label>
                                <Textarea 
                                    value={prepressSpecs} 
                                    onChange={e => setPrepressSpecs(e.target.value)} 
                                    placeholder="Instrucciones de diseño..."
                                    className="min-h-[80px] text-xs bg-transparent border-border/40 focus:border-primary/40 transition-all resize-none" 
                                />
                            </div>

                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-border/40">
                                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Diseño Requerido</span>
                                <Switch checked={designNeeded} onCheckedChange={setDesignNeeded} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>

                            {(designNeeded || existingDesignFiles.length > 0) && (
                                <div className="space-y-3 pt-2 border-t border-dashed">
                                    {existingDesignFiles.length > 0 && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] uppercase text-muted-foreground/80 font-black tracking-widest pl-1">Archivos Originales</Label>
                                            <div className="space-y-1">
                                                {existingDesignFiles.map((file, idx) => (
                                                    <div key={`existing-${idx}`} className="flex items-center justify-between px-2 py-1.5 bg-primary/5 rounded-md text-[11px] border border-primary/20 group/file">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <FileIcon className="h-3 w-3 shrink-0 text-primary" />
                                                            <span className="truncate font-bold">{file}</span>
                                                        </div>
                                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive transition-colors" onClick={() => removeExistingFile(idx)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        {designFiles.length > 0 && <Label className="text-[9px] uppercase text-muted-foreground/80 font-black tracking-widest pl-1">Nuevos Archivos</Label>}
                                        <div className="space-y-1">
                                            {designFiles.map((file, idx) => (
                                                <div key={`new-${idx}`} className="flex items-center justify-between px-2 py-1.5 bg-muted/40 rounded-md text-[11px] border border-border/40">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Upload className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                        <span className="truncate">{file.name}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => removeNewFile(idx)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <label className="flex items-center justify-center gap-2 py-2 border border-dashed border-primary/30 rounded-md text-[10px] text-primary font-black uppercase tracking-widest cursor-pointer hover:bg-primary/5 transition-all">
                                            <Plus className="h-3 w-3" /> Adjuntar Diseño
                                            <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pt-2 border-t border-dashed">
                                <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-border/40">
                                    <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Numeración (Folio)</span>
                                    <Switch checked={folioEnabled} onCheckedChange={setFolioEnabled} className="scale-75 data-[state=checked]:bg-primary" />
                                </div>
                                {folioEnabled && (
                                    <div className="relative group/folio animate-in zoom-in-95 duration-200">
                                        <label className="absolute -top-2 left-2 px-1 bg-background text-[9px] font-bold uppercase tracking-wider text-muted-foreground z-10">
                                            N° Inicial
                                        </label>
                                        <Input 
                                            placeholder="Ej: 0001" 
                                            value={folioStart} 
                                            onChange={e => setFolioStart(e.target.value)} 
                                            className="h-9 text-xs bg-transparent border-border/40 focus:border-primary/40 font-mono font-bold" 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Impresión */}
                <div className={cn(
                    "relative group p-6 rounded-md border transition-all duration-300",
                    enablePress 
                        ? "bg-white shadow-sm border-primary/30 ring-1 ring-primary/5" 
                        : "bg-muted/30 border-border/40 opacity-60 grayscale-[0.5]"
                )}>
                    <FormSection title="Impresión" icon={Printer} className="pt-0 pb-4" />

                    <div className="flex items-center justify-between mb-4 mt-1">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Habilitar Fase</span>
                        <Switch checked={enablePress} onCheckedChange={setEnablePress} className="scale-75 data-[state=checked]:bg-primary" />
                    </div>

                    {enablePress && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="relative group/field">
                                <label className="absolute -top-2 left-2 px-1 bg-background text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-focus-within/field:text-primary z-10">
                                    Especificaciones
                                </label>
                                <Textarea 
                                    value={pressSpecs} 
                                    onChange={e => setPressSpecs(e.target.value)} 
                                    placeholder="Tintas, papel, terminaciones..."
                                    className="min-h-[80px] text-xs bg-transparent border-border/40 focus:border-primary/40 transition-all resize-none" 
                                />
                            </div>

                            <div className="space-y-2">
                                <span className="text-[9px] uppercase text-muted-foreground font-black tracking-widest pl-1">Tecnología</span>
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/30 rounded-md border border-border/40">
                                    {['offset', 'digital', 'especial'].map(type => (
                                        <Button
                                            key={type}
                                            type="button"
                                            variant={printType === type ? "default" : "ghost"}
                                            size="sm"
                                            className={cn(
                                                "h-7 text-[10px] uppercase font-black tracking-tight transition-all",
                                                printType === type ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                                            )}
                                            onClick={() => setPrintType(type)}
                                        >
                                            {type}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Post-Impresión */}
                <div className={cn(
                    "relative group p-6 rounded-xl border transition-all duration-300",
                    enablePostpress 
                        ? "bg-white shadow-sm border-primary/30 ring-1 ring-primary/5" 
                        : "bg-muted/30 border-border/40 opacity-60 grayscale-[0.5]"
                )}>
                    <FormSection title="Post-Impresión" icon={FileText} className="pt-0 pb-4" />

                    <div className="flex items-center justify-between mb-4 mt-1">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Habilitar Fase</span>
                        <Switch checked={enablePostpress} onCheckedChange={setEnablePostpress} className="scale-75 data-[state=checked]:bg-primary" />
                    </div>

                    {enablePostpress && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="relative group/field">
                                <label className="absolute -top-2 left-2 px-1 bg-background text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-focus-within/field:text-primary z-10">
                                    Especificaciones
                                </label>
                                <Textarea 
                                    value={postpressSpecs} 
                                    onChange={e => setPostpressSpecs(e.target.value)} 
                                    placeholder="Acabados, laminado, troquel, etc."
                                    className="min-h-[80px] text-xs bg-transparent border-border/40 focus:border-primary/40 transition-all resize-none" 
                                />
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
