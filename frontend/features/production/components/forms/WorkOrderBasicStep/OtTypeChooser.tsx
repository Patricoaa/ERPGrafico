"use client"
import { Plus, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkOrderFormValues } from "@/types/forms"

interface OtTypeChooserProps {
    onChoose: (type: 'LINKED' | 'NONE', defaults: WorkOrderFormValues) => void
}

export function OtTypeChooser({ onChoose }: OtTypeChooserProps) {
    return (
        <div className="flex flex-col items-center justify-center space-y-6 py-12 max-w-lg mx-auto animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-2 mb-4">
                <h3 className="text-xl font-black uppercase tracking-widest text-foreground/80">Configuración de Flujo</h3>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-tight opacity-70">
                    Seleccione el origen y protocolo de fabricación
                </p>
            </div>
            <div className="grid grid-cols-1 w-full gap-4">
                <Button
                    type="button"
                    variant="outline"
                    className="h-20 justify-start px-6 gap-6 hover:border-primary/50 hover:bg-primary/[0.03] group transition-all duration-300 border-border/60 relative overflow-hidden"
                    onClick={() => onChoose("LINKED", {
                        otType: "LINKED", description: "", sale_order: "", sale_line: "",
                        product_description: "", contact_id: "", start_date: null, due_date: null, internal_notes: "",
                    } as WorkOrderFormValues)}
                >
                    <div className="absolute left-0 top-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="bg-primary/10 p-2.5 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-black text-xs uppercase tracking-widest text-foreground/80">Vincular a Venta</span>
                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Fabricación bajo demanda para una Nota de Venta (NV)</span>
                    </div>
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    className="h-20 justify-start px-6 gap-6 hover:border-warning/50 hover:bg-warning/[0.03] group transition-all duration-300 border-border/60 relative overflow-hidden"
                    onClick={() => onChoose("NONE", {
                        otType: "NONE", description: "", product_id: "", quantity: "",
                        uom_id: "", start_date: null, due_date: null, internal_notes: "",
                    } as WorkOrderFormValues)}
                >
                    <div className="absolute left-0 top-0 w-1 h-full bg-warning opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="bg-warning/10 p-2.5 rounded-lg group-hover:bg-warning/20 transition-colors">
                        <Plus className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-black text-xs uppercase tracking-widest text-foreground/80">Producción para Stock</span>
                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Fabricación manual para inventario o reposición</span>
                    </div>
                </Button>
            </div>
        </div>
    )
}
