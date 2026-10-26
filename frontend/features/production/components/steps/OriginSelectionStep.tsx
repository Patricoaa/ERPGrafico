"use client";

import { FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkOrderFormValues } from "@/types/forms";
import { getDomainConceptTitle, getDomainConceptCode } from "@/lib/entity-registry";
import { CardSurface, SelectionCheck } from "@/components/shared";

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
            : `Seleccione cómo desea crear esta ${getDomainConceptTitle('ot')}`}
        </p>
      </div>

      <div className="grid gap-6">
        <CardSurface
          layout="stacked"
          selected={isLinkedSelected}
          unavailable={selected !== null && !isLinkedSelected}
          role="button"
          onClick={() => onChoose("LINKED", {
            otType: "LINKED", description: "", sale_order: "", sale_line: "",
            product_description: "", contact_id: "", start_date: null, due_date: null, internal_notes: "",
          } as WorkOrderFormValues)}
          className="h-[200px]"
          interactive={!selected || isLinkedSelected}
        >
          <div className="relative flex h-20 w-full shrink-0 items-center justify-center overflow-hidden bg-muted">
            <FileText className={cn("h-8 w-8", isLinkedSelected ? "text-primary" : "text-primary/80")} aria-hidden />
            {isLinkedSelected && <SelectionCheck className="absolute top-3 right-3 h-5 w-5" />}
          </div>
          <div className="flex w-full flex-1 flex-col gap-1 px-3 pb-3 pt-2.5 text-center">
            <h3 className="line-clamp-2 text-center text-lg font-semibold leading-snug">
              Vincular a Venta
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Fabricación bajo demanda para una {getDomainConceptTitle('ov')} ({getDomainConceptCode('ov')})
            </p>
          </div>
        </CardSurface>

        <CardSurface
          layout="stacked"
          selected={isNoneSelected}
          unavailable={selected !== null && !isNoneSelected}
          role="button"
          onClick={() => onChoose("NONE", {
            otType: "NONE", description: "", product_id: "", quantity: "",
            uom_id: "", start_date: null, due_date: null, internal_notes: "",
          } as WorkOrderFormValues)}
          className="h-[200px]"
          interactive={!selected || isNoneSelected}
        >
          <div className="relative flex h-20 w-full shrink-0 items-center justify-center overflow-hidden bg-muted">
            <Plus className={cn("h-8 w-8", isNoneSelected ? "text-warning" : "text-warning/80")} aria-hidden />
            {isNoneSelected && <SelectionCheck className="absolute top-3 right-3 h-5 w-5" />}
          </div>
          <div className="flex w-full flex-1 flex-col gap-1 px-3 pb-3 pt-2.5 text-center">
            <h3 className="line-clamp-2 text-center text-lg font-semibold leading-snug">
              Producción para Stock
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Fabricación manual para inventario o reposición
            </p>
          </div>
        </CardSurface>
      </div>
    </div>
  );
}