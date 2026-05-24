"use client";

import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkOrderFormValues } from "@/types/forms";

interface OriginSelectionStepProps {
  onChoose: (type: "LINKED" | "NONE", defaults: WorkOrderFormValues) => void;
}

export function OriginSelectionStep({ onChoose }: OriginSelectionStepProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Origen de Fabricación
        </h2>
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">
          Seleccione cómo desea crear esta Orden de Trabajo
        </p>
      </div>

      <div className="grid gap-6">
        <Button
          type="button"
          variant="outline"
          className="group h-[200px] w-full rounded-xl border border-border/30 
                   hover:border-primary/50 hover:bg-primary/[0.03] transition-all duration-300"
          onClick={() => onChoose("LINKED", {
            otType: "LINKED", description: "", sale_order: "", sale_line: "",
            product_description: "", contact_id: "", start_date: null, due_date: null, internal_notes: "",
          } as WorkOrderFormValues)}
        >
          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-opacity pointer-events-none" />
          <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
            <FileText className="h-8 w-8 text-primary/80 group-hover:text-primary" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg text-foreground group-hover:text-primary">
                Vincular a Venta
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Fabricación bajo demanda para una Nota de Venta (NV)
              </p>
            </div>
          </div>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="group h-[200px] w-full rounded-xl border border-border/30 
                   hover:border-warning/50 hover:bg-warning/[0.03] transition-all duration-300"
          onClick={() => onChoose("NONE", {
            otType: "NONE", description: "", product_id: "", quantity: "",
            uom_id: "", start_date: null, due_date: null, internal_notes: "",
          } as WorkOrderFormValues)}
        >
          <div className="absolute inset-0 bg-warning/0 group-hover:bg-warning/5 transition-opacity pointer-events-none" />
          <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
            <Plus className="h-8 w-8 text-warning/80 group-hover:text-warning" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg text-foreground group-hover:text-warning">
                Producción para Stock
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Fabricación manual para inventario o reposición
              </p>
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}