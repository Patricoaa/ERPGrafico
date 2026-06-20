"use client";

import { FileText, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkOrderFormValues } from "@/types/forms";

interface OriginSelectionStepProps {
  onChoose: (type: "LINKED" | "NONE", defaults: WorkOrderFormValues) => void;
  selected?: "LINKED" | "NONE" | null;
}

export function OriginSelectionStep({ onChoose, selected = null }: OriginSelectionStepProps) {
  const isLinkedSelected = selected === "LINKED";
  const isNoneSelected = selected === "NONE";

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">
          {selected
            ? "Origen ya definido para esta OT"
            : "Seleccione cómo desea crear esta Orden de Trabajo"}
        </p>
      </div>

      <div className="grid gap-6">
        <Button
          type="button"
          variant="outline"
          aria-pressed={isLinkedSelected}
          className={cn(
            "relative h-[200px] w-full rounded-md transition-all duration-300",
            isLinkedSelected
              ? "border-2 border-primary bg-primary/[0.06] ring-2 ring-primary/20 shadow-card"
              : "border border-border/30 hover:border-primary/50 hover:bg-primary/[0.03]",
            // When another card is already selected, dim this one
            selected && !isLinkedSelected && "opacity-40"
          )}
          onClick={() => onChoose("LINKED", {
            otType: "LINKED", description: "", sale_order: "", sale_line: "",
            product_description: "", contact_id: "", start_date: null, due_date: null, internal_notes: "",
          } as WorkOrderFormValues)}
        >
          {isLinkedSelected && (
            <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-primary" />
          )}
          <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
            <FileText className={cn("h-8 w-8", isLinkedSelected ? "text-primary" : "text-primary/80")} />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg text-foreground">
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
          aria-pressed={isNoneSelected}
          className={cn(
            "relative h-[200px] w-full rounded-md transition-all duration-300",
            isNoneSelected
              ? "border-2 border-warning bg-warning/[0.06] ring-2 ring-warning/20 shadow-card"
              : "border border-border/30 hover:border-warning/50 hover:bg-warning/[0.03]",
            selected && !isNoneSelected && "opacity-40"
          )}
          onClick={() => onChoose("NONE", {
            otType: "NONE", description: "", product_id: "", quantity: "",
            uom_id: "", start_date: null, due_date: null, internal_notes: "",
          } as WorkOrderFormValues)}
        >
          {isNoneSelected && (
            <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-warning" />
          )}
          <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
            <Plus className={cn("h-8 w-8", isNoneSelected ? "text-warning" : "text-warning/80")} />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg text-foreground">
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